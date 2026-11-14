#!/usr/bin/env python3
"""
RETROGRADE font bake (DESIGN.md §2.5, law 7: bake, don't compute).

fetch (google/fonts, OFL) -> trim axes (varLib.instancer) -> subset (Latin + UI glyphs)
-> woff2 into app/fonts/  +  styles/font-fallbacks.css (mono fallback metrics)
+ app/fonts/manifest.json (sizes, budget).

Normal builds never run this; the outputs are checked into the project.
Run with:  npm run fonts:bake   (uses ./.venv if present; needs `pip install fonttools brotli`)
Exit code 1 if the DESIGN.md budget is exceeded: total <= 165 KB, preloaded <= 125 KB.
"""
from __future__ import annotations

import io
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTCollection, TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / ".cache"
OUT = ROOT / "app" / "fonts"
LICENSES = OUT / "licenses"
FALLBACK_CSS = ROOT / "styles" / "font-fallbacks.css"
RAW = "https://raw.githubusercontent.com/google/fonts/main/"

KB = 1000  # budgets in DESIGN.md are decimal kilobytes
BUDGET_TOTAL = 165 * KB
BUDGET_PRELOAD = 125 * KB


def ranges(*spans: tuple[int, int] | int) -> list[int]:
    out: list[int] = []
    for s in spans:
        if isinstance(s, int):
            out.append(s)
        else:
            out.extend(range(s[0], s[1] + 1))
    return out


# Google Fonts' "latin" subset (unicode-range used by fonts.googleapis.com).
LATIN = ranges(
    (0x0000, 0x00FF), 0x0131, (0x0152, 0x0153), (0x02BB, 0x02BC), 0x02C6, 0x02DA, 0x02DC,
    0x0304, 0x0308, 0x0329, (0x2000, 0x206F), 0x20AC, 0x2122, 0x2191, 0x2193, 0x2212,
    0x2215, 0xFEFF, 0xFFFD,
)
# UI glyphs the design uses (DESIGN.md §2.10): arrows, ≤ ≥, ×, fractions.
UI = ranges((0x2190, 0x2199), (0x2264, 0x2265), (0x2153, 0x215E), 0x00D7)
# Mono carries the machine: box drawing, blocks, geometric shapes, dingbat marks,
# corner brackets ⌜⌝⌞⌟, return ⏎, approx/prop/root, the ARCHIVE shape glyphs.
MONO_EXTRA = ranges(
    (0x2500, 0x257F), (0x2580, 0x259F), (0x25A0, 0x25FF), (0x231C, 0x231F), 0x23CE,
    0x2713, 0x2715, 0x271A, 0x2731, 0x2B22, 0x2248, 0x221D, 0x221A, 0x2318, 0x2325, 0x21E7,
)

FONTS = [
    {
        "id": "hubot-sans",
        "family": "Hubot Sans",
        "dir": "hubotsans",
        "src": "HubotSans[wdth,wght].ttf",
        "out": "HubotSans-Variable.woff2",
        "limits": {"wght": (500, 900), "wdth": (75, 125)},
        "unicodes": LATIN + UI,
        "preload": True,
    },
    {
        "id": "mona-sans",
        "family": "Mona Sans",
        "dir": "monasans",
        "src": "MonaSans[wdth,wght].ttf",
        "out": "MonaSans-Variable.woff2",
        "limits": {"wght": (300, 700), "wdth": 100},
        "unicodes": LATIN + UI,
        "preload": False,
    },
    {
        "id": "jetbrains-mono",
        "family": "JetBrains Mono",
        "dir": "jetbrainsmono",
        "src": "JetBrainsMono[wght].ttf",
        "out": "JetBrainsMono-Variable.woff2",
        "limits": {"wght": (400, 800)},
        "unicodes": LATIN + UI + MONO_EXTRA,
        "preload": True,
    },
]

# Kerning, ligatures, marks, locale forms, tabular/case/zero/fraction forms. Anything
# else (stylistic sets nobody asked for) is dropped.
LAYOUT_FEATURES = [
    "kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "rlig", "rvrn",
    "tnum", "pnum", "lnum", "case", "zero", "frac", "numr", "dnom", "sups", "subs",
]
# Keep copyright, family/style, version, PS name, license + license URL (OFL notice).
NAME_IDS = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]


def fetch(rel: str) -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / rel.replace("/", "__")
    if cached.exists():
        return cached.read_bytes()
    url = RAW + urllib.parse.quote(rel)
    with urllib.request.urlopen(url, timeout=60) as r:  # noqa: S310 (fixed https URL)
        data = r.read()
    cached.write_bytes(data)
    return data


def bake(spec: dict) -> dict:
    raw = fetch(f"ofl/{spec['dir']}/{spec['src']}")
    # recalcTimestamp=False keeps head.modified from the source: same input → same bytes
    font = TTFont(io.BytesIO(raw), recalcTimestamp=False)
    axes = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in font["fvar"].axes}

    # 1) Subset the full variable font (glyphs, features, names, no hinting).
    opts = subset.Options()
    opts.layout_features = LAYOUT_FEATURES
    opts.name_IDs = NAME_IDS
    opts.hinting = False  # macOS/iOS ignore hints; Windows renders these variable fonts fine
    opts.desubroutinize = True
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG"]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=spec["unicodes"])
    sub.subset(font)

    # 2) Trim the axes to what the design uses (pins become static axes).
    buf = io.BytesIO()
    font.save(buf)
    font = instancer.instantiateVariableFont(TTFont(io.BytesIO(buf.getvalue()), recalcTimestamp=False), spec["limits"])
    font.recalcTimestamp = False

    # 3) Ship as woff2.
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / spec["out"]
    font.flavor = "woff2"
    font.save(out)

    LICENSES.mkdir(parents=True, exist_ok=True)
    (LICENSES / f"{spec['id']}-OFL.txt").write_bytes(fetch(f"ofl/{spec['dir']}/OFL.txt"))

    kept_axes = {a.axisTag: (a.minValue, a.maxValue) for a in font["fvar"].axes} if "fvar" in font else {}
    return {
        "id": spec["id"],
        "family": spec["family"],
        "file": f"app/fonts/{spec['out']}",
        "bytes": out.stat().st_size,
        "preload": spec["preload"],
        "sourceAxes": axes,
        "axes": kept_axes,
        "glyphs": len(font.getGlyphOrder()),
        # what the font can actually render — tests/glyphs.test.ts keeps UI symbols inside it
        "codepoints": sorted(font.getBestCmap().keys()),
    }


def mono_metrics() -> dict:
    """Vertical metrics of the baked JetBrains Mono (what the fallback must imitate)."""
    font = TTFont(OUT / "JetBrainsMono-Variable.woff2")
    upm = font["head"].unitsPerEm
    hhea = font["hhea"]
    advance = font["hmtx"]["zero"][0] if "zero" in font["hmtx"].metrics else font["hmtx"]["M"][0]
    return {
        "upm": upm,
        "ascent": hhea.ascent / upm,
        "descent": abs(hhea.descent) / upm,
        "lineGap": hhea.lineGap / upm,
        "advance": advance / upm,
    }


def local_advance(path: str, glyph_char: str = "0") -> float | None:
    """Advance width (em) of a locally installed font, if present (macOS: Menlo)."""
    p = Path(path)
    if not p.exists():
        return None
    try:
        fonts = TTCollection(p).fonts if p.suffix == ".ttc" else [TTFont(p)]
        f = fonts[0]
        gname = f.getBestCmap()[ord(glyph_char)]
        return f["hmtx"][gname][0] / f["head"].unitsPerEm
    except Exception:  # noqa: BLE001 — metrics are best-effort; documented constants are the fallback
        return None


def fallback_css(m: dict) -> str:
    # Menlo and DejaVu Sans Mono share Bitstream Vera Sans Mono metrics: advance 1233/2048 em.
    menlo = local_advance("/System/Library/Fonts/Menlo.ttc") or 1233 / 2048
    consolas = 1126 / 2048  # Consolas advance width (documented; not installed on macOS)

    def face(name: str, srcs: list[str], fallback_advance: float) -> str:
        size_adjust = m["advance"] / fallback_advance
        src = ", ".join(f'local("{s}")' for s in srcs)
        return (
            "@font-face {\n"
            f'  font-family: "{name}";\n'
            f"  src: {src};\n"
            f"  size-adjust: {size_adjust * 100:.3f}%;\n"
            f"  ascent-override: {m['ascent'] / size_adjust * 100:.3f}%;\n"
            f"  descent-override: {m['descent'] / size_adjust * 100:.3f}%;\n"
            f"  line-gap-override: {m['lineGap'] / size_adjust * 100:.3f}%;\n"
            "}\n"
        )

    return (
        "/* GENERATED by scripts/fonts/bake.py — do not edit by hand.\n"
        "   Metric-matched fallbacks for JetBrains Mono (DESIGN.md §2.5): the fallback's advance\n"
        f"   width is scaled to {m['advance']:.3f} em and its vertical metrics overridden, so a\n"
        "   late font swap moves nothing. Two faces because Menlo/DejaVu and Consolas differ. */\n"
        + face("JetBrains Mono Fallback", ["Menlo", "Menlo-Regular", "DejaVu Sans Mono", "DejaVuSansMono"], menlo)
        + face("JetBrains Mono Fallback W", ["Consolas"], consolas)
    )


def main() -> int:
    results = [bake(spec) for spec in FONTS]
    FALLBACK_CSS.write_text(fallback_css(mono_metrics()))

    total = sum(r["bytes"] for r in results)
    preload = sum(r["bytes"] for r in results if r["preload"])
    manifest = {
        "generatedBy": "scripts/fonts/bake.py",
        "budget": {"totalBytes": BUDGET_TOTAL, "preloadBytes": BUDGET_PRELOAD},
        "totalBytes": total,
        "preloadBytes": preload,
        "fonts": results,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    for r in results:
        axes = " ".join(f"{k} {lo:g}–{hi:g}" for k, (lo, hi) in r["axes"].items()) or "static"
        r.pop("sourceAxes", None)
        flag = "preload" if r["preload"] else "lazy"
        print(f"  {r['family']:<15} {r['bytes'] / KB:6.1f} KB  {flag:<7}  {axes:<26} {r['glyphs']} glyphs")
    ok = total <= BUDGET_TOTAL and preload <= BUDGET_PRELOAD
    print(f"  total {total / KB:.1f} KB (≤ {BUDGET_TOTAL / KB:.0f})  ·  preloaded {preload / KB:.1f} KB (≤ {BUDGET_PRELOAD / KB:.0f})  ·  {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

"""
The OG cards' faces (PROMPTS.md Part 15): next/og (Satori) reads TTF, OTF or WOFF — not WOFF2 — and
draws a variable font at its default instance only, so the cards get static instances of the
site's own mono, pinned at the two weights they set: JetBrains Mono 400 and 700, subset to what
the site's mono carries (scripts/fonts/bake.py's LATIN + UI + MONO_EXTRA).

    .venv/bin/python scripts/fonts/og.py        (sh scripts/fonts/run.sh runs it too)

Reads the cached upstream font (scripts/fonts/.cache, fetched by bake.py) and writes
app/fonts/og/JetBrainsMono-{400,700}.ttf, deterministic (no timestamps), so a re-run with the same
source changes nothing.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

from bake import FONTS, LATIN, MONO_EXTRA, UI, fetch

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "app" / "fonts" / "og"
WEIGHTS = (400, 700)


def main() -> int:
    spec = next(f for f in FONTS if f["id"] == "jetbrains-mono")
    source = fetch(f"ofl/{spec['dir']}/{spec['src']}")
    OUT.mkdir(parents=True, exist_ok=True)
    for weight in WEIGHTS:
        font = TTFont(io.BytesIO(source), recalcTimestamp=False)
        font = instancer.instantiateVariableFont(font, {"wght": weight})
        opts = subset.Options()
        opts.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "zero", "case"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=LATIN + UI + MONO_EXTRA)
        sub.subset(font)
        out = OUT / f"JetBrainsMono-{weight}.ttf"
        buf = io.BytesIO()
        font.save(buf)
        data = buf.getvalue()
        changed = not out.exists() or out.read_bytes() != data
        if changed:
            out.write_bytes(data)
        print(f"og: {out.relative_to(ROOT)} {len(data) / 1024:.1f} KB{'' if changed else ' · unchanged'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

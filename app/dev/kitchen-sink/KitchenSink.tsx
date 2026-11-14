"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Bracket } from "@/components/ui/Bracket";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ChipToggle } from "@/components/ui/ChipToggle";
import { Counter } from "@/components/ui/Counter";
import { DitherImage } from "@/components/ui/DitherImage";
import { DataList, DataRow } from "@/components/ui/DataRow";
import { Col, Grid } from "@/components/ui/Grid";
import { Marquee } from "@/components/ui/Marquee";
import { Reveal } from "@/components/ui/Reveal";
import { Scramble } from "@/components/ui/Scramble";
import { SlideAdvance } from "@/components/ui/SlideAdvance";
import { Section } from "@/components/ui/Section";
import { STEPS, Text, type Step } from "@/components/ui/Text";
import { Tilt } from "@/components/ui/Tilt";
import { Typewriter } from "@/components/ui/Typewriter";
import { sink } from "@/content/kitchen-sink";
import { contrastOf } from "@/lib/color";
import { tear } from "@/lib/signatures";
import { useUI, type MotionOverride } from "@/lib/store";
import { THEMES, THEME_LABEL, type Theme } from "@/lib/tokens";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// ── live reads ─────────────────────────────────────────────────────────────────────────

const TOKENS = [
  "bg", "bg-raised", "bg-sunken", "bg-band", "fg-1", "fg-2", "fg-3", "line-1", "line-2",
  "accent", "accent-fill", "accent-wash", "on-accent", "hot", "warn", "focus",
] as const;
type Token = (typeof TOKENS)[number];
type TokenValues = Partial<Record<Token, string>>;
const SURFACES = ["bg", "bg-raised", "bg-sunken", "bg-band"] as const;
const TEXT_TOKENS: ReadonlySet<Token> = new Set<Token>(["fg-1", "fg-2", "fg-3", "accent", "hot", "warn"]);
const GRAPHIC_TOKENS: ReadonlySet<Token> = new Set<Token>(["line-2", "accent-fill", "focus"]);

/** Reads from the element, and re-reads whenever it resizes (fluid type changes with the viewport). */
function useLive<T>(read: (el: HTMLElement) => T, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const update = () => setValue(read(el));
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    },
    [read],
  );
  return [ref, value] as const;
}

const readTokens = (el: HTMLElement): TokenValues => {
  const cs = getComputedStyle(el);
  const out: TokenValues = {};
  for (const t of TOKENS) out[t] = cs.getPropertyValue(`--${t}`).trim();
  return out;
};
const readFontPx = (el: HTMLElement): string => `${parseFloat(getComputedStyle(el).fontSize).toFixed(1)}px`;

function ratio(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  try {
    return contrastOf(a, b);
  } catch {
    return null; // system colors (forced-colors) have no hex value
  }
}
const fmt = (r: number | null) => (r === null ? "—" : `${r.toFixed(2)}:1`);

// ── page ───────────────────────────────────────────────────────────────────────────────

export function KitchenSink() {
  const [view, setView] = useState<"matrix" | "single">("matrix");
  const theme = useUI((s) => s.theme);
  return (
    <main>
      <Toolbar view={view} onView={setView} />
      <Grid as="header" className="gap-y-4 py-16">
        <Col span={12}>
          <Text as="h1" step="title">
            {sink.title}
          </Text>
        </Col>
        <Col span={12}>
          <Text as="p" step="body" tone="fg-2" className="max-w-[68ch]">
            {sink.intro}
          </Text>
        </Col>
      </Grid>
      {(view === "matrix" ? THEMES : [theme]).map((t) => (
        <Band key={t} theme={t} />
      ))}
      <MotionDemo />
    </main>
  );
}

/** Part 4's DOM-side motion: DITHER RESOLVE (element tier), SCRAMBLE, TYPEWRITER, SLIDE ADVANCE. */
function MotionDemo() {
  const m = sink.motion;
  const [resolveKey, setResolveKey] = useState(0);
  const [scrambleRun, setScrambleRun] = useState(0);
  const [line, setLine] = useState(0);
  const [slide, setSlide] = useState({ i: 0, dir: 1 as 1 | -1 });
  const go = (dir: 1 | -1) => setSlide((s) => ({ i: (s.i + dir + m.slides.length) % m.slides.length, dir }));
  return (
    <Section id="motion" index={m.index} code={m.code} title={m.title} counts={m.counts}>
      <Grid className="gap-y-8 py-16">
        <Col span={12} className="grid min-w-0 gap-4 md:col-span-7">
          <div data-demo="dither">
            <DitherImage {...m.image} sizes="(min-width: 768px) 58vw, 100vw" resolveKey={resolveKey} skew />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={() => setResolveKey((k) => k + 1)}>{m.resolve}</Button>
            <Text as="p" step="small" tone="fg-3" className="max-w-[48ch]">
              {m.resolveNote}
            </Text>
          </div>
        </Col>
        <Col span={12} className="grid min-w-0 content-start gap-6 md:col-span-5">
          <div className="grid gap-3" data-demo="scramble">
            <Text as="p" step="title">
              <Scramble key={scrambleRun} text={m.scramble} sessionKey={`sink:${scrambleRun}`} />
            </Text>
            <div>
              <Button onClick={() => setScrambleRun((n) => n + 1)}>{m.scrambleAgain}</Button>
            </div>
          </div>
          <div className="grid gap-3" data-demo="hhold">
            {/* H-HOLD: one line of display type in a box of its own width, so nothing reflows */}
            <div className="min-w-0 overflow-hidden">
              <Text as="p" step="display" data-hhold="" className="w-max whitespace-nowrap">
                {m.hhold}
              </Text>
            </div>
            <div>
              <Button onClick={() => void tear({ seed: "sink", atCut: () => undefined })}>{m.tear}</Button>
            </div>
          </div>
          <div className="grid gap-3" data-demo="typewriter">
            <Text as="p" step="body" className="font-mono">
              <Typewriter text={m.lines[line] ?? ""} />
            </Text>
            <div>
              <Button onClick={() => setLine((l) => (l + 1) % m.lines.length)}>{m.nextLine}</Button>
            </div>
          </div>
          <div className="grid gap-3" data-demo="slide">
            <SlideAdvance slideKey={String(slide.i)} direction={slide.dir}>
              <div className="grid gap-2">
                <DitherImage {...m.image} sizes="(min-width: 768px) 40vw, 100vw" />
                <Text as="p" variant="label" tone="fg-2">
                  {m.slides[slide.i]}
                </Text>
              </div>
            </SlideAdvance>
            <div className="flex gap-3">
              <Button onClick={() => go(-1)}>{m.prev}</Button>
              <Button onClick={() => go(1)}>{m.next}</Button>
            </div>
          </div>
        </Col>
      </Grid>
    </Section>
  );
}

function Toolbar({ view, onView }: { view: "matrix" | "single"; onView: (v: "matrix" | "single") => void }) {
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const override = useUI((s) => s.motionOverride);
  const setOverride = useUI((s) => s.setMotionOverride);
  const grid = useUI((s) => s.grid);
  const toggleGrid = useUI((s) => s.toggleGrid);
  const reduced = useReducedMotion();
  const { bp, isPhone } = useBreakpoint();
  const motions: MotionOverride[] = ["system", "reduce", "full"];

  return (
    <div className="z-50 border-b border-line-1 bg-bg-raised md:sticky md:top-0">
      <Grid className="py-3">
        <div className="col-span-12 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Text variant="label" tone="accent">
            /dev/kitchen-sink
          </Text>
          <Group label="View">
            {(["matrix", "single"] as const).map((v) => (
              <ChipToggle key={v} pressed={view === v} onPressedChange={() => onView(v)}>
                {v}
              </ChipToggle>
            ))}
          </Group>
          <Group label="Page theme">
            {THEMES.map((t) => (
              <ChipToggle key={t} pressed={theme === t} onPressedChange={() => setTheme(t)}>
                {THEME_LABEL[t]}
              </ChipToggle>
            ))}
          </Group>
          <Group label="Motion">
            {motions.map((m) => (
              <ChipToggle key={m} pressed={override === m} onPressedChange={() => setOverride(m)}>
                {m}
              </ChipToggle>
            ))}
          </Group>
          <ChipToggle pressed={grid} onPressedChange={() => toggleGrid()}>
            Grid [G]
          </ChipToggle>
          <Text variant="label" tone="fg-3" aria-live="polite">
            {`motion ${reduced ? "reduced" : "full"} · bp ${bp}${isPhone ? " · phone" : ""}`}
          </Text>
        </div>
      </Grid>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <Text variant="label" tone="fg-3">
        {label}
      </Text>
      {children}
    </div>
  );
}

// ── one band per theme ─────────────────────────────────────────────────────────────────

const THEME_NAME: Record<Theme, string> = { phosphor: "Phosphor", amber: "Amber", paper: "Paper" };

function Band({ theme }: { theme: Theme }) {
  return (
    <div data-theme={theme} data-band={theme} className="bg-bg pb-section-y text-fg-1">
      <Grid as="header" className="gap-y-4 pt-24 pb-12">
        <Col span={12}>
          <Text variant="label" tone="accent">{`${THEME_LABEL[theme]} · data-theme="${theme}"`}</Text>
        </Col>
        <Col span={12}>
          <Text as="h2" step="display">
            {THEME_NAME[theme]}
          </Text>
        </Col>
      </Grid>
      <TokensSection theme={theme} />
      <TypeSection theme={theme} />
      <SpaceSection theme={theme} />
      <BracketSection theme={theme} />
      <ButtonSection theme={theme} />
      <StripSection theme={theme} />
      <GridSection theme={theme} />
      <MarqueeSection theme={theme} />
      <RevealSection theme={theme} />
      <TiltSection theme={theme} />
      <DataSection theme={theme} />
      <ChipSection theme={theme} />
      <CounterSection theme={theme} />
    </div>
  );
}

function Demo({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Grid className={`gap-y-8 py-block ${className}`}>{children}</Grid>;
}

// 01 TOKENS
function TokensSection({ theme }: { theme: Theme }) {
  const [ref, values] = useLive(readTokens, {} as TokenValues);
  return (
    <Section id={`${theme}-tokens`} index={1} code="Tokens" title="Semantic colors · §2.3" counts={["16 tokens", "live contrast"]}>
      <Demo>
        <div ref={ref} className="col-span-12 grid grid-cols-2 gap-6 md:grid-cols-4 xl:grid-cols-8">
          {TOKENS.map((t) => (
            <Swatch key={t} token={t} values={values} />
          ))}
        </div>
      </Demo>
    </Section>
  );
}

function Swatch({ token, values }: { token: Token; values: TokenValues }) {
  const value = values[token];
  const isText = TEXT_TOKENS.has(token);
  const isGraphic = GRAPHIC_TOKENS.has(token);
  const isOn = token === "on-accent";
  const vs = isOn ? ratio(value, values.accent) : ratio(value, values.bg);
  const worst = isText || isGraphic ? Math.min(...SURFACES.map((s) => ratio(value, values[s]) ?? Infinity)) : null;
  const floor = isText || isOn ? 4.5 : 3;
  // pass/fail only once real values are in (never on the SSR placeholder)
  const measured = isOn ? vs : worst === null || worst === Infinity ? null : worst;
  const pass = measured === null ? null : measured >= floor;
  return (
    <div className="flex flex-col gap-2">
      <div className="h-16 rounded-1" style={{ background: `var(--${token})`, boxShadow: "inset 0 0 0 1px var(--line-1)" }} />
      <Text step="small">{`--${token}`}</Text>
      {/* min-heights reserve two lines so live values never shift the layout */}
      <Text variant="label" tone="fg-3" className="min-h-8 break-all">
        {value || "—"}
      </Text>
      {(isText || isGraphic || isOn) && (
        <Text variant="label" tone="fg-2" className="min-h-8">
          {/* one text node: content that changes in place is not a layout shift */}
          {`${isOn ? `on accent ${fmt(vs)}` : `bg ${fmt(vs)} · min ${fmt(worst === Infinity ? null : worst)}`}${pass === null ? "" : pass ? " · pass" : " · fail ✕"}`}
        </Text>
      )}
    </div>
  );
}

// 02 TYPE
const STEP_VAR: Record<Step, string> = {
  micro: "--step--2", small: "--step--1", body: "--step-0", lead: "--step-1",
  heading: "--step-2", title: "--step-3", display: "--step-4", mega: "--step-5",
};

function sampleFor(step: Step): string {
  if (step === "body") return sink.body;
  if (step === "lead") return sink.lead;
  if (step === "micro" || step === "small") return "LABEL · 2026-11-10 · 14:32 CET · 1,284";
  return sink.display;
}

function StepRow({ step }: { step: Step }) {
  const [ref, px] = useLive(readFontPx, "—");
  return (
    <div className="col-span-12 flex flex-col gap-3 border-t border-line-1 pt-4">
      <Text variant="label" tone="fg-3">{`${STEP_VAR[step]} · ${step} · ${px}`}</Text>
      <Text ref={ref} as="p" step={step} className={step === "body" || step === "lead" ? "max-w-[68ch]" : undefined}>
        {sampleFor(step)}
      </Text>
    </div>
  );
}

function TypeSection({ theme }: { theme: Theme }) {
  return (
    <Section id={`${theme}-type`} index={2} code="Type" title="Eight steps · §2.6" counts={["Hubot Sans", "Mona Sans", "JetBrains Mono"]}>
      <Demo>
        {STEPS.map((s) => (
          <StepRow key={s} step={s} />
        ))}
        <div className="col-span-12 grid gap-8 border-t border-line-1 pt-6 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            <Text variant="label" tone="fg-3">
              variant · label
            </Text>
            <Text variant="label">Section 04 · Archive</Text>
          </div>
          <div className="flex flex-col gap-3">
            <Text variant="label" tone="fg-3">
              variant · numeral (display)
            </Text>
            <Text step="display" variant="numeral">
              1,284
            </Text>
          </div>
          <div className="flex flex-col gap-3">
            <Text variant="label" tone="fg-3">
              variant · sans (small)
            </Text>
            <Text step="small" sans>
              Caption in Mona Sans at the small step.
            </Text>
          </div>
        </div>
        <div className="col-span-12 flex flex-col gap-4 border-t border-line-1 pt-6">
          <Text variant="label" tone="fg-3">
            led material · mono numerals ≥ --step-3
          </Text>
          <div className="flex flex-wrap items-end gap-12">
            <Text step="title" variant="led">
              08
            </Text>
            <Text step="display" variant="led">
              1,284
            </Text>
            <Text step="mega" variant="led" tone="accent">
              2026
            </Text>
          </div>
        </div>
        <div className="col-span-12 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-line-1 pt-6">
          <Text variant="label" tone="fg-3">
            tones
          </Text>
          <Text step="lead" tone="fg-1">
            fg-1
          </Text>
          <Text step="lead" tone="fg-2">
            fg-2
          </Text>
          <Text step="lead" tone="fg-3">
            fg-3
          </Text>
          <Text step="lead" tone="accent">
            accent
          </Text>
          <Text step="lead" tone="hot" className="font-semibold">
            hot (≥ lead, 600)
          </Text>
          <Text step="lead" tone="warn">
            warn △
          </Text>
        </div>
      </Demo>
    </Section>
  );
}

// 03 SPACE · RADII · LINES
const SPACE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64] as const;
const RADII = ["0", "1", "card", "bezel", "dot"] as const;

function SpaceSection({ theme }: { theme: Theme }) {
  return (
    <Section id={`${theme}-space`} index={3} code="Space" title="Spacing, radii, hairlines · §2.7–2.9" counts={["4 px unit", "13 steps"]}>
      <Demo>
        <div className="col-span-12 flex flex-col gap-2 lg:col-span-6">
          {SPACE_STEPS.map((n) => (
            <div key={n} className="flex items-center gap-4">
              <Text variant="label" tone="fg-3" className="w-16">{`${n} · ${n * 4}px`}</Text>
              <div className="h-2 bg-accent-fill" style={{ width: `${n * 4}px` }} />
            </div>
          ))}
        </div>
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-6">
          <div className="flex flex-wrap gap-6">
            {RADII.map((r) => (
              <div key={r} className="flex w-24 flex-col items-center gap-2" style={{ containerType: "inline-size" }}>
                <div
                  className="h-16 w-full bg-bg-raised"
                  style={{ borderRadius: `var(--r-${r})`, boxShadow: "inset 0 0 0 1px var(--line-2)" }}
                />
                <Text variant="label" tone="fg-3">{`--r-${r}`}</Text>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <div className="w-full" style={{ height: "var(--hairline)", background: "var(--line-2)" }} />
            <Text variant="label" tone="fg-3">
              hairline = one device pixel
            </Text>
            <div className="w-full" style={{ height: "var(--hairline)", background: "var(--line-1)" }} />
            <Text variant="label" tone="fg-3">
              line-1 (decorative)
            </Text>
          </div>
        </div>
      </Demo>
    </Section>
  );
}

// 04 BRACKETS
function BracketSection({ theme }: { theme: Theme }) {
  return (
    <Section id={`${theme}-brackets`} index={4} code="Brackets" title="Solid = live · dashed = provisional · §2.9" counts={["draw-in on view"]}>
      <Demo>
        <div className="col-span-12 flex flex-wrap gap-8">
          <Bracket className="p-6">
            <Text variant="label">{sink.brackets.solid}</Text>
          </Bracket>
          <Bracket active className="p-6">
            <Text variant="label" tone="accent">
              {sink.brackets.active}
            </Text>
          </Bracket>
          <Bracket variant="dashed" className="p-6">
            <Text variant="label" tone="warn">
              {`△ ${sink.brackets.dashed}`}
            </Text>
          </Bracket>
          <Bracket size="lg" className="p-12">
            <Text variant="label">{sink.brackets.large}</Text>
          </Bracket>
          <a href={`#${theme}-brackets`} className="t-small self-center text-fg-2 underline underline-offset-4">
            {sink.brackets.focus}
          </a>
        </div>
      </Demo>
    </Section>
  );
}

// 05 BUTTONS
function ButtonSection({ theme }: { theme: Theme }) {
  const b = sink.buttons;
  return (
    <Section id={`${theme}-buttons`} index={5} code="Buttons" title="Magnetic · brackets · glow on tubes" counts={["primary", "secondary", "tertiary"]}>
      <Demo>
        <div className="col-span-12 flex flex-wrap items-center gap-8">
          <Button variant="primary" href={`#${theme}-buttons`} icon="→">
            {b.primary}
          </Button>
          <Button variant="secondary" href={`#${theme}-buttons`} icon="→">
            {b.secondary}
          </Button>
          <Button variant="tertiary" href="https://scholar.google.com">
            {b.external}
          </Button>
          <Button variant="tertiary" icon="←">
            {b.back}
          </Button>
          <Button variant="secondary" disabled>
            {b.disabled}
          </Button>
        </div>
      </Demo>
    </Section>
  );
}

// 06 SECTION STRIP
function StripSection({ theme }: { theme: Theme }) {
  const s = sink.section;
  return (
    <Section id={`${theme}-strip`} index={6} code="Section" title="Header strip · §2.9" counts={["full-bleed", "live counts"]}>
      <Demo>
        <div className="col-span-12">
          <Section id={`${theme}-strip-demo`} index={s.index} code={s.code} title={s.title} counts={s.counts}>
            <div className="h-12" />
          </Section>
        </div>
      </Demo>
    </Section>
  );
}

// 07 GRID
function GridSection({ theme }: { theme: Theme }) {
  return (
    <Section id={`${theme}-grid`} index={7} code="Grid" title="12 columns · press G for the overlay" counts={["gutter 16–32", "margin 20–80"]}>
      <Grid className="gap-y-4 py-block">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="col-span-1 flex h-12 items-end bg-bg-raised p-1" style={{ boxShadow: "inset 0 0 0 1px var(--line-1)" }}>
            <Text variant="label" tone="fg-3">
              {String(i + 1).padStart(2, "0")}
            </Text>
          </div>
        ))}
        <div className="col-span-12 bg-bg-raised p-4 md:col-span-5">
          <Text variant="label">5 / 12</Text>
        </div>
        <div className="col-span-12 bg-bg-raised p-4 md:col-span-7">
          <Text variant="label">7 / 12 · the About split</Text>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="col-span-12 bg-bg-sunken p-4 md:col-span-4">
            <Text variant="label" tone="fg-2">
              4 / 12
            </Text>
          </div>
        ))}
      </Grid>
    </Section>
  );
}

// 08 MARQUEE
function MarqueeSection({ theme }: { theme: Theme }) {
  return (
    <Section id={`${theme}-marquee`} index={8} code="Marquee" title="Velocity-reactive · pauses on hover" counts={["40 px/s", "≤ 4×"]}>
      <div className="py-block">
        <Marquee label="Ticker sample">
          {sink.marquee.map((m) => (
            <Text key={m} step="heading" upper>
              {m} ·
            </Text>
          ))}
        </Marquee>
      </div>
    </Section>
  );
}

// 09 REVEAL
function RevealSection({ theme }: { theme: Theme }) {
  const [run, setRun] = useState(0);
  return (
    <Section id={`${theme}-reveal`} index={9} code="Reveal" title="Rail reveal · clip-path, never opacity" counts={["60 ms / line", "≤ 28 ms / char"]}>
      <Demo>
        <div key={`l${run}`} className="col-span-12 md:col-span-7">
          <Reveal as="p" mode="lines" className="t-lead max-w-[38ch]">
            {sink.revealLines}
          </Reveal>
        </div>
        <div key={`c${run}`} className="col-span-12 md:col-span-5">
          <Reveal as="h3" mode="chars" className="t-title">
            {sink.revealChars}
          </Reveal>
        </div>
        <div className="col-span-12">
          <Button variant="tertiary" icon={null} onClick={() => setRun((n) => n + 1)}>
            Replay (dev only)
          </Button>
        </div>
      </Demo>
    </Section>
  );
}

// 10 TILT
function TiltSection({ theme }: { theme: Theme }) {
  const t = sink.tilt;
  return (
    <Section id={`${theme}-tilt`} index={10} code="Tilt" title="Tier B · one lamp · §4.4" counts={["spring tilt", "max 8°"]}>
      <Demo>
        <Tilt className="col-span-12 md:col-span-6 xl:col-span-4" style={{ containerType: "inline-size" }}>
          <Bracket className="lamp-shadow lamp-highlight flex aspect-[1.586] flex-col justify-between bg-bg-raised p-6" style={{ borderRadius: "var(--r-card)" }}>
            <Text variant="label" tone="accent">
              {t.kicker}
            </Text>
            <div className="flex flex-col gap-2">
              <Text as="h3" step="heading">
                {t.title}
              </Text>
              <Text as="p" step="small" sans tone="fg-2">
                {t.body}
              </Text>
            </div>
          </Bracket>
        </Tilt>
      </Demo>
    </Section>
  );
}

// 11 DATAROW
function DataSection({ theme }: { theme: Theme }) {
  return (
    <Section id={`${theme}-data`} index={11} code="DataRow" title="The datasheet primitive" counts={["leader dots", "valid <dl>"]}>
      <Demo>
        <DataList className="col-span-12 md:col-span-7 xl:col-span-5">
          {sink.datasheet.map(([label, value]) => (
            <DataRow key={label} label={label}>
              {value}
            </DataRow>
          ))}
        </DataList>
      </Demo>
    </Section>
  );
}

// 12 CHIPS
function ChipSection({ theme }: { theme: Theme }) {
  const [on, setOn] = useState<Record<string, boolean>>({ Journal: true });
  return (
    <Section id={`${theme}-chips`} index={12} code="Chips" title="Tags and filter toggles" counts={["■ / □ + aria-pressed"]}>
      <Demo>
        <div className="col-span-12 flex flex-wrap gap-3">
          {sink.chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
        <div role="group" aria-label="Venue filter" className="col-span-12 flex flex-wrap gap-3">
          {sink.filters.map((f) => (
            <ChipToggle key={f} pressed={!!on[f]} onPressedChange={(p) => setOn((s) => ({ ...s, [f]: p }))}>
              {f}
            </ChipToggle>
          ))}
        </div>
      </Demo>
    </Section>
  );
}

// 13 COUNTERS
function CounterSection({ theme }: { theme: Theme }) {
  return (
    <Section id={`${theme}-counters`} index={13} code="Counter" title="Count-up at 50 % · stepped at 30 fps" counts={["final value in SSR"]}>
      <Demo>
        <div className="col-span-12 flex flex-wrap gap-x-12 gap-y-6">
          {sink.stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <Text variant="label" tone="fg-3">
                {s.label}
              </Text>
              <Text step="heading" variant="numeral">
                <Counter value={s.value} />
              </Text>
            </div>
          ))}
        </div>
        <div className="col-span-12 flex flex-col gap-2">
          <Text variant="label" tone="fg-3">
            {sink.hero.label}
          </Text>
          <Text step="mega" variant="led" tone="accent">
            <Counter value={sink.hero.value} />
          </Text>
        </div>
        <div className="col-span-12 flex flex-col gap-1">
          <Text variant="label" tone="fg-3">
            decimals + suffix
          </Text>
          <Text step="title" variant="numeral">
            <Counter value={4.2} decimals={1} suffix=" MB" />
          </Text>
        </div>
      </Demo>
    </Section>
  );
}

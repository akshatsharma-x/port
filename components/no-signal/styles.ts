/**
 * NO SIGNAL's styles (DESIGN.md §7.4): the empty tube and its drifting on-screen box. A string the
 * screen renders as a <style> that React hoists into the head (deduped by its href), so they come
 * only where NO SIGNAL is drawn: the 404's HTML, and global-error's lazy chunk.
 *
 * Not a CSS module: the root not-found is every route's not-found boundary, so Next preloaded its
 * stylesheet on every page — one more request on Slow 4G. As a string it rides in every page's
 * payload instead (Next serializes the boundary's tree): 0.9–1.3 KB gz of HTML, and measured 5–15 ms
 * better LCP on a case study and a paper than the preload, home's the same as Part 13's (Part 14).
 */
export const NO_SIGNAL_CSS = `
.no-signal {
  position: relative;
  height: 100svh;
  overflow: hidden;
  background: var(--bg);
  color: var(--accent);
  outline: none;
}
/* the box wanders inside the HUD's bands */
.no-signal__field {
  position: absolute;
  inset: calc(var(--hud-inset) + var(--spacing) * 16) var(--margin) var(--hud-band-bottom);
  container-type: size;
}
.no-signal__x {
  position: absolute;
  inset: 0 auto auto 0;
  width: max-content;
  max-width: 100%;
  animation: no-signal-x var(--drift-x) linear infinite alternate;
}
.no-signal__y {
  animation: no-signal-y var(--drift-y) linear infinite alternate;
}
@keyframes no-signal-x {
  to {
    translate: calc(100cqw - 100%) 0;
  }
}
@keyframes no-signal-y {
  to {
    translate: 0 calc(100cqh - 100%);
  }
}
.no-signal__osd {
  display: grid;
  gap: calc(var(--spacing) * 3);
  max-width: min(36rem, 100cqw);
  padding: calc(var(--spacing) * 6) calc(var(--spacing) * 8);
  background: var(--bg-sunken);
  box-shadow:
    inset 0 0 0 var(--hairline) var(--accent),
    0 0 calc(var(--glow) * 24px) color-mix(in oklch, var(--accent) calc(var(--glow) * 30%), transparent);
  font-family: var(--ff-mono);
}
.no-signal__title {
  margin: 0;
  font-size: var(--step-3);
  line-height: 1.05;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  text-shadow: 0 0 calc(var(--glow) * 10px) var(--accent);
}
.no-signal__line,
.no-signal__hint,
.no-signal__note {
  margin: 0;
  font-size: var(--step--1);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-2);
}
.no-signal__code {
  margin-inline-end: 1ch;
  color: var(--fg-1);
}
.no-signal__link {
  display: inline-flex;
  align-items: center;
  min-height: var(--target-touch);
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: var(--hairline);
  text-underline-offset: 0.2em;
}
.no-signal__note {
  color: var(--fg-3);
}
html[data-theme="paper"] .no-signal,
html[data-theme="paper"] .no-signal__title {
  color: var(--fg-1);
}
html[data-theme="paper"] .no-signal__osd {
  background: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--hairline) var(--fg-1);
}
/* reduced motion: the box stays where it is, in the middle — from the edition, and from the
   preference itself (the error screen brings its own <html>, which can't know the edition) */
html[data-motion="reduce"] .no-signal__x,
html[data-motion="reduce"] .no-signal__y {
  animation: none;
}
html[data-motion="reduce"] .no-signal__x {
  inset: 50% auto auto 50%;
  translate: -50% -50%;
}
@media (prefers-reduced-motion: reduce) {
  .no-signal__x,
  .no-signal__y {
    animation: none;
  }
  .no-signal__x {
    inset: 50% auto auto 50%;
    translate: -50% -50%;
  }
}
`;

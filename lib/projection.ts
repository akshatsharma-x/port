/**
 * PROJECTION's meeting point (DESIGN.md §7.4 WORK, §3.6 continuity), in first-load JS and tiny: the
 * WORK scene installs its projector here while it's resident (components/stage/work/projector.ts);
 * the carousel's HTML layer asks it to project a slide; lib/navigation.ts asks it to fly one home on
 * Back; the case study's hero reads `active` so it shows itself whole, not through its own dither,
 * under a picture that's already full color.
 */
export interface Projector {
  /** Out: the slide in the gate flies to fill the viewport and the route swaps under it. False when it can't (navigate plainly). */
  forward(slug: string, href: string): Promise<boolean>;
  /** Back from a case study: can this slide fly home? */
  canReverse(slug: string): boolean;
  /** …then do it: `restore` swaps the route and scroll under the cover, before the flight home. */
  reverse(slug: string, restore: () => Promise<void>): Promise<void>;
}

let current: Projector | null = null;

export const setProjector = (p: Projector | null): void => {
  current = p;
};

export const projector = (): Projector | null => current;

/** A projection is on screen: the stage holds the viewport. `trace` (debug): what each step did. */
export const projection = { active: false, trace: null as string[] | null };

export const traceProjection = (step: string): void => {
  projection.trace?.push(`${Math.round(performance.now())} ${step}`);
};

import { CARD, punchable } from "./hollerith";

/**
 * A2 · EXPERIENCE "LOG" (DESIGN.md §4.3 A2, §7.4): the punch-card rail — design constants and the
 * contract between the content, the atlas bake (scripts/bake/atlases.ts) and the scene
 * (components/stage/scenes/log.tsx). World units are inches, the card's own (lib/hollerith CARD).
 *
 * The deck stands along a Catmull-Rom rail, newest role first, with blank leader cards at both
 * ends. The camera rides the rail toward the active card; each card it passes hinges at its bottom
 * edge and flips down out of the way, like a card file being riffled, so the camera never cuts
 * through one. Light behind the deck shines through the standing cards' holes, glows through the
 * stock of the card in front (the projected mask), and draws shafts in the fog.
 */
export const LOG = {
  /** blank cards before and after the roles: the deck's ends, which the fog swallows */
  leaders: 2,
  /** card to card along the rail (in) */
  spacing: 2.6,
  /** the rail's sway across the deck: x and y amplitude (in), and how many cards one swing spans */
  sway: { x: 0.9, y: 0.25, period: 7 },
  camera: {
    /**
     * how far before the active card it rides, and above its center (in): above the cards' tops,
     * so the deck behind shows as a file of top edges, each with its company's name
     */
    back: 16,
    lift: 2.6,
    /**
     * by the screen's aspect: it backs off (from `back`) until the card fills at most `fill` of the
     * width, and rides `offset` of the visible width right of the rail, looking straight down it —
     * the card square-on, left of the HTML panel, on a wide screen or a portrait tablet alike
     */
    fill: 0.5,
    offset: 0.16,
    /**
     * banking on curves: at most ±6° (§4.3) — from the rail's lateral curvature times the camera's
     * speed along it, full at bankSpeed cards/s, so it banks as it travels and levels at rest
     */
    bankDeg: 6,
    bankSpeed: 1.5,
  },
  flip: {
    /** a passed card lies forward and down, past flat */
    angleDeg: 104,
    /** the share of a step a card takes to flip: it starts as the camera leaves it */
    span: 0.8,
  },
  /** exponential-squared fog by view depth (in): clear in front, the deck's far end swallowed */
  fog: { density: 0.045, start: 17 },
  /** how far a passed card fades into the ground as it falls: all the way (a ghost of it read as a smudge on Paper) */
  fallenFade: 1,
  light: {
    /** HDR intensity of the backlight seen through a hole: above bloom's threshold of 1.0 */
    hole: 3.4,
    /** the stock's translucency: how much of the card behind's hole pattern glows through */
    glow: 0.35,
    /** additive shafts in the fog, per hole */
    shaft: { intensity: 0.07, length: 2.4 },
    /** the light panel behind the deck, and how far past the last card it stands (cards) */
    panel: 0.75,
    panelBack: 3,
  },
  hover: {
    /** the card's bow under the cursor (in), and its backlight's gain */
    bend: 0.32,
    lightGain: 1.7,
  },
  /**
   * The dark tubes' card: --bg-raised is barely above the ground, so the stock is lifted this far
   * toward the print's tone to read as a card; the print is set this far from stock to ink. Paper's
   * card is --bg-sunken taken paperStock toward the print: on a light table a card is a darker
   * silhouette (at --bg-sunken alone it sat 4% under the paper, beige on beige); its holes are
   * --bg-raised, brighter than the paper.
   */
  tone: { stockLift: 0.1, inkStrength: 0.55, paperStock: 0.16 },
  /** the card-face atlas: 2048 × 1024, 4 × 4 cells; each card centered in its cell with room for mips */
  atlas: {
    url: "/textures/log-cards.webp",
    width: 2048,
    height: 1024,
    cols: 4,
    rows: 4,
    /** the card in its cell, px (7⅜ × 3¼ in at 67.25 px/in) */
    card: { width: 496, height: 219 },
    /** the leader cards' face: the last cell */
    blankCell: 15,
  },
} as const;

/** The deck's slots: the shafts' uniform array holds one card matrix per slot (shaders/log.ts). */
export const MAX_SLOTS = 16;
/** Role cards the deck holds: its slots less the leaders at both ends — 12, DESIGN.md §4.3 A2's
 *  "≤ 12 cards" — within the atlas's cells less the blank's (15). scripts/bake/atlases.ts refuses
 *  more, so a long career fails the build instead of the deck dropping its oldest cards. */
export const MAX_ROLE_CARDS = Math.min(LOG.atlas.cols * LOG.atlas.rows - 1, MAX_SLOTS - 2 * LOG.leaders);
/** px per inch on the atlas */
export const ATLAS_DPI = LOG.atlas.card.width / CARD.width;

export interface CardRole {
  company: string;
  start: string;
  end: string;
}

/**
 * What a role's card says along its top edge — and so what its holes punch: the company and its
 * years ("UNITED AIRLINES 2026-PRESENT", "WALKINGTREE TECHNOLOGIES 2025"), as a keypunch writes it.
 */
export function cardText(role: CardRole, present: string): string {
  const from = role.start.slice(0, 4);
  const to = role.end === "present" ? present : role.end.slice(0, 4);
  return punchable(`${role.company} ${from === to ? from : `${from}-${to}`}`);
}

/** The atlas cell (column, row) of card k, 0-based. */
export const atlasCell = (k: number): [number, number] => [k % LOG.atlas.cols, Math.floor(k / LOG.atlas.cols)];

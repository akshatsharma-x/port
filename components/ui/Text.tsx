import type { ElementType, HTMLAttributes, Ref } from "react";
import { cx } from "@/lib/cx";

/** DESIGN.md §2.6 — the eight steps, smallest to largest. */
export const STEPS = ["micro", "small", "body", "lead", "heading", "title", "display", "mega"] as const;
export type Step = (typeof STEPS)[number];

export type Tone = "fg-1" | "fg-2" | "fg-3" | "accent" | "hot" | "warn";

export type TextTag =
  | "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "strong" | "em" | "small"
  | "label" | "dt" | "dd" | "li" | "figcaption" | "blockquote" | "output" | "time" | "abbr" | "cite";

const STEP_CLASS: Record<Step, string> = {
  micro: "t-micro",
  small: "t-small",
  body: "t-body",
  lead: "t-lead",
  heading: "t-heading",
  title: "t-title",
  display: "t-display",
  mega: "t-mega",
};

const TONE_CLASS: Record<Tone, string> = {
  "fg-1": "text-fg-1",
  "fg-2": "text-fg-2",
  "fg-3": "text-fg-3",
  accent: "text-accent",
  hot: "text-hot",
  warn: "text-warn",
};

const LED_STEPS: ReadonlySet<Step> = new Set<Step>(["title", "display", "mega"]);
const TOO_SMALL_FOR_HOT: ReadonlySet<Step> = new Set<Step>(["micro", "small", "body"]);

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: TextTag;
  ref?: Ref<HTMLElement>;
  /** defaults to body (or micro for the label variant) */
  step?: Step;
  tone?: Tone;
  /**
   * label   — the uppercase micro mono label
   * numeral — mono, tabular: numbers that change are mono (§2.5)
   * led     — numeral through the LED dot mask; mono numerals at --step-3 and up only (§2.6)
   */
  variant?: "label" | "numeral" | "led";
  /** the small step in Mona Sans (captions) instead of mono */
  sans?: boolean;
  /** force uppercase — the machine speaks in caps; humans in sentence case */
  upper?: boolean;
}

export function Text({ as = "span", step, tone, variant, sans = false, upper = false, className, ...rest }: TextProps) {
  const s: Step = step ?? (variant === "label" ? "micro" : "body");
  if (process.env.NODE_ENV !== "production") {
    if (variant === "led" && !LED_STEPS.has(s)) {
      console.warn(`[Text] LED needs --step-3 or larger, got "${s}" (DESIGN.md §2.6)`);
    }
    if (tone === "hot" && TOO_SMALL_FOR_HOT.has(s)) {
      console.warn(`[Text] --hot as text needs --step-1+ at weight ≥ 600, got "${s}" (DESIGN.md §2.2)`);
    }
  }
  const Tag = as as ElementType;
  return (
    <Tag
      className={cx(
        STEP_CLASS[s],
        sans && s === "small" && "t-sans",
        (variant === "numeral" || variant === "led") && "numeral",
        variant === "led" && "led",
        upper && "uppercase",
        tone && TONE_CLASS[tone],
        className,
      )}
      {...rest}
    />
  );
}

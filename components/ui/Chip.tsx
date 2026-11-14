import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** A mono tag (stack, keyword, venue badge). For filters use <ChipToggle>. */
export function Chip({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("chip", className)} {...rest} />;
}

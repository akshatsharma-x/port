"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface ChipToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
}

/**
 * Filter chip. aria-pressed carries the state; ■ / □ carries it visually too, so it never relies
 * on color alone (DESIGN.md §2.4).
 */
export function ChipToggle({ pressed, onPressedChange, className, children, ...rest }: ChipToggleProps) {
  return (
    <button type="button" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)} className={cx("chip chip--toggle", className)} {...rest}>
      <span aria-hidden="true">{pressed ? "■" : "□"}</span>
      {children}
    </button>
  );
}

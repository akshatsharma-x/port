"use client";

import { useEffect, useRef, useState, type ElementType, type HTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { vars } from "@/lib/css";

export interface BracketProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "span" | "section" | "article" | "figure" | "li" | "aside";
  /** solid = live / interactive · dashed = provisional (under review, in prep) — DESIGN.md §2.9 */
  variant?: "solid" | "dashed";
  /** 12 px arms, or 16 px for panels ≥ 1024 px */
  size?: "sm" | "lg";
  /** accent color without hover/focus (e.g. the selected record) */
  active?: boolean;
  /** draw the arms in when the element first enters the viewport (default), or right away */
  draw?: "view" | "now";
  /** px outside the element where the corners sit */
  inset?: number;
}

/** Corner brackets: one pseudo-element, eight gradient arms; draws in on reveal (micro, relay). */
export function Bracket({
  as = "div",
  variant = "solid",
  size = "sm",
  active = false,
  draw = "view",
  inset = 0,
  className,
  style,
  children,
  ...rest
}: BracketProps) {
  const ref = useRef<HTMLElement>(null);
  const [drawn, setDrawn] = useState(draw === "now");

  useEffect(() => {
    if (draw === "now") return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [draw]);

  const Tag = as as ElementType;
  return (
    <Tag
      ref={ref}
      className={cx("bracket", className)}
      data-variant={variant}
      data-size={size === "lg" ? "lg" : undefined}
      data-active={active ? "" : undefined}
      data-drawn={drawn ? "" : undefined}
      style={inset ? { ...style, ...vars({ "--bracket-inset": `${inset}px` }) } : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}

"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "@/lib/cx";
import { useMagnetic } from "@/hooks/useMagnetic";

export type ButtonVariant = "primary" | "secondary" | "tertiary";
export type ButtonGlyph = "→" | "↗" | "←";

interface BaseProps {
  variant?: ButtonVariant;
  /** trailing glyph; external links default to ↗ (DESIGN.md §2.10: ↗ leaves the site, → goes deeper) */
  icon?: ButtonGlyph | null;
  magnetic?: boolean;
  children: ReactNode;
  className?: string;
}

type LinkButtonProps = BaseProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & { href: string };
type NativeButtonProps = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
export type ButtonProps = LinkButtonProps | NativeButtonProps;

const isExternal = (href: string) => /^(https?:)?\/\//.test(href);

/**
 * Mono label, bracket corners, magnetic hover (spring magnetic, ≤ 6 px, label parallax 1.5×),
 * phosphor glow on tubes only. Renders <Link>, an external <a> (new tab) or a <button>.
 */
export function Button(props: ButtonProps) {
  const { variant = "secondary", icon, magnetic = true, children, className, ...rest } = props;
  const ref = useMagnetic<HTMLElement>(magnetic);
  const external = typeof props.href === "string" && isExternal(props.href);
  // a site file opened in a new tab (the résumé) is a plain link too: not a route Next should prefetch
  const newTab = external || (rest as { target?: string }).target === "_blank";
  const glyph = icon === undefined ? (external ? "↗" : null) : icon;
  const classes = cx("btn bracket", `btn--${variant}`, className);

  const label = (
    <span className="btn__label">
      <span>{children}</span>
      {glyph && (
        <span aria-hidden="true" className="btn__icon" data-glyph={glyph}>
          {glyph}
        </span>
      )}
      {newTab && <span className="sr-only"> (opens in a new tab)</span>}
    </span>
  );

  if (typeof props.href === "string") {
    const { href, ...anchor } = rest as Omit<LinkButtonProps, keyof BaseProps>;
    if (newTab) {
      return (
        <a ref={ref as Ref<HTMLAnchorElement>} href={href} target="_blank" rel="noopener noreferrer" className={classes} data-drawn="" {...anchor}>
          {label}
        </a>
      );
    }
    return (
      <Link ref={ref as Ref<HTMLAnchorElement>} href={href} className={classes} data-drawn="" {...anchor}>
        {label}
      </Link>
    );
  }

  const { type = "button", ...button } = rest as Omit<NativeButtonProps, keyof BaseProps>;
  return (
    <button ref={ref as Ref<HTMLButtonElement>} type={type} className={classes} data-drawn="" {...button}>
      {label}
    </button>
  );
}

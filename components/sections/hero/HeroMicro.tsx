"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { clockCells, HUD_HZ, localClock, onHud, setText } from "@/lib/hud";

export interface HeroMicroProps {
  labels: { label: string; location: string; time: string; availability: string };
  location: string;
  timeZone: string;
  countryCode: string;
  status: "open" | "limited" | "closed";
  statusLabel: string;
  note: string;
}

/**
 * The hero's mono micro-block (DESIGN.md §7.4 SYSTEM): location · live local time · availability,
 * with a pulsing --accent dot. The time is the HUD's own clock, written on the HUD's own flush, so
 * the two never disagree by a second; its field is a fixed width of mono cells (no layout shift).
 * The dot only carries the state alongside its label (never color alone, §2.2).
 */
export function HeroMicro({ labels, location, timeZone, countryCode, status, statusLabel, note }: HeroMicroProps) {
  const timeRef = useRef<HTMLTimeElement>(null);
  useEffect(() => {
    const clock = localClock(timeZone, countryCode);
    return onHud(HUD_HZ.text, () => setText(timeRef.current, clock.format(new Date())));
  }, [timeZone, countryCode]);

  return (
    <dl className="hero-micro t-micro" aria-label={labels.label} style={{ "--clock-n": clockCells(timeZone, countryCode) } as CSSProperties}>
      <div className="hero-micro__row">
        <dt>{labels.location}</dt>
        <dd>{location}</dd>
      </div>
      <div className="hero-micro__row">
        <dt>{labels.time}</dt>
        <dd>
          <time ref={timeRef} className="hero-micro__time" suppressHydrationWarning />
        </dd>
      </div>
      <div className="hero-micro__row">
        <dt>{labels.availability}</dt>
        <dd>
          <span className="hero-micro__dot" data-status={status} aria-hidden="true" />
          {statusLabel}
        </dd>
        <dd className="hero-micro__note">{note}</dd>
      </div>
    </dl>
  );
}

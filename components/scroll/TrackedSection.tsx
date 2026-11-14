"use client";

import { useEffect, useRef } from "react";
import { Section, type SectionProps } from "@/components/ui/Section";
import { trackSection } from "@/lib/scroll";

/**
 * A page section the scroll layer knows about: the HUD readout, the section rail, the shallow
 * #hash and the SECTION cue follow it (lib/scroll.ts). Declarative — no ScrollTrigger here.
 */
export function TrackedSection(props: SectionProps) {
  const ref = useRef<HTMLElement>(null);
  const { id } = props;
  useEffect(() => {
    const el = ref.current;
    return el ? trackSection({ id, el }) : undefined;
  }, [id]);
  return <Section ref={ref} {...props} />;
}

import { getImageProps } from "next/image";
import { DitherFrame, type DitherFrameProps } from "./DitherFrame";

export interface DitherImageProps extends Omit<DitherFrameProps, "img"> {
  src: string;
  alt: string;
  /** intrinsic size: reserves the box (no layout shift) and feeds the srcset */
  width: number;
  height: number;
  /** the rendered width, e.g. "(min-width: 1024px) 50vw, 100vw" */
  sizes?: string;
  quality?: number;
  /** above-the-fold images: fetched early, decoded eagerly */
  preload?: boolean;
}

/**
 * Every raster image on the site goes through here (DESIGN.md §3.6 ③): a responsive <img> from
 * next/image's getImageProps(), resolved from 1-bit to full fidelity by <DitherFrame>.
 * getImageProps runs wherever this renders, so next/image's component never ships to the client.
 */
export function DitherImage({ src, alt, width, height, sizes, quality, preload, ...frame }: DitherImageProps) {
  const { props } = getImageProps({ src, alt, width, height, sizes, quality, ...(preload ? { preload: true } : { loading: "lazy" as const }) });
  return (
    <DitherFrame
      {...frame}
      img={{ src: props.src, srcSet: props.srcSet, sizes: props.sizes, alt, width, height, loading: props.loading, decoding: props.decoding ?? "async", fetchPriority: props.fetchPriority }}
    />
  );
}

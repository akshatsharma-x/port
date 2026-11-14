import { getImageProps } from "next/image";
import { StageSlot } from "@/components/stage/StageSlot";
import { Grid } from "@/components/ui/Grid";
import { derived } from "@/content/derive";
import { COVER } from "@/lib/covers";
import { routes } from "@/lib/routes";
import { slideNumber, WORK } from "@/lib/work";
import { CssCarousel } from "./CssCarousel";
import { StageBand } from "../StageBand";
import { WorkIndex, type IndexRow } from "./WorkIndex";

/** A cover as a responsive <img>'s attributes, from next/image (no component ships to the client). */
export interface CoverImg {
  src: string;
  srcSet: string | undefined;
  sizes: string | undefined;
  width: number;
  height: number;
  alt: string;
}

export interface SlideItem {
  slug: string;
  href: string;
  number: string;
  title: string;
  category: string;
  year: number | null;
  cover: CoverImg;
}

function coverImg(src: string, alt: string, sizes: string): CoverImg {
  const { width, height } = COVER.master;
  const { props } = getImageProps({ src, alt, width, height, sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes, width, height, alt };
}

/**
 * 05 · WORK — Projects (DESIGN.md §7.4, §4.3 A4, §4.4 B4): a 100 svh band, then the document.
 *   - the band: the A4 slide carousel (the stage), its HTML layer (every slide a link, the keys,
 *     the drag and the sideways wheel; loaded with the scene), and the stage-less edition — a CSS
 *     curved carousel for tier OFF, reduced motion and no JS — in the same box
 *   - INDEX (the interlock to CAPABILITIES): every project in a dense table, filterable, with the
 *     cover following the cursor
 */
export function Work() {
  const d = derived;
  const L = d.site.labels.work;
  const featured = d.projects.filter((p) => p.featured).slice(0, WORK.maxSlides);
  const cover = (p: (typeof d.projects)[number], sizes: string) => {
    const m = p.media.find((x) => x.type === "image");
    return coverImg(m?.src ?? "", m?.alt ?? p.title, sizes);
  };
  const slides: SlideItem[] = featured.map((p, i) => ({
    slug: p.slug,
    href: routes.project(p.slug),
    number: slideNumber(i, featured.length),
    title: p.title,
    category: p.category,
    year: p.year,
    cover: cover(p, "(min-width: 48rem) 40vw, 78vw"),
  }));
  const rows: IndexRow[] = d.projects.map((p) => ({
    slug: p.slug,
    href: routes.project(p.slug),
    number: String(p.index).padStart(2, "0"),
    title: p.title,
    role: p.role,
    year: p.year,
    category: p.category,
    stack: p.stack,
    slide: featured.findIndex((f) => f.slug === p.slug),
    cover: cover(p, `${WORK.preview.width}px`),
  }));
  return (
    <>
      <StageBand className="work-band" layer={{ id: "work", props: { slides: slides.map((s) => ({ slug: s.slug, href: s.href, number: s.number, title: s.title, category: s.category, year: s.year })), labels: { ...L.carousel, pending: L.pending } } }}>
        <StageSlot id="work" className="h-[100svh]" />
        <CssCarousel slides={slides} label={L.carousel.label} />
        <p className="sr-only">{L.carousel.stage}</p>
      </StageBand>
      <Grid className="work-doc">
        <WorkIndex rows={rows} labels={L.index} pending={L.pending} />
      </Grid>
    </>
  );
}

import { describe, expect, it } from "vitest";
import { classifyLink, type LinkFacts } from "@/lib/navigation";

const HERE = "https://retrograde.example/?q=1#system";
const link = (href: string, over: Partial<LinkFacts> = {}): LinkFacts => ({ href, target: null, download: false, transition: null, button: 0, modified: false, defaultPrevented: false, ...over });

/** DESIGN.md §3.6 ②: which clicks are discontinuous jumps (a TRACKING TEAR) and which aren't ours. */
describe("navigation — link classification", () => {
  it("a same-document #hash link is a hash jump", () => {
    expect(classifyLink(link("https://retrograde.example/?q=1#archive"), HERE)).toBe("hash");
    expect(classifyLink(link("/?q=1#log"), HERE)).toBe("hash");
  });

  it("another route on this origin is a route jump (tear, then router.push at the cut)", () => {
    expect(classifyLink(link("/work/atlas"), HERE)).toBe("route");
    expect(classifyLink(link("/?q=2#archive"), HERE)).toBe("route"); // a different search is a different document
  });

  it("leaves everything else to the browser", () => {
    expect(classifyLink(link("https://elsewhere.example/"), HERE)).toBeNull();
    expect(classifyLink(link("/work/atlas", { target: "_blank" }), HERE)).toBeNull();
    expect(classifyLink(link("/work/atlas", { target: "_self" }), HERE)).toBe("route");
    expect(classifyLink(link("/cv.pdf", { download: true }), HERE)).toBeNull();
    expect(classifyLink(link("/work/atlas", { modified: true }), HERE)).toBeNull();
    expect(classifyLink(link("/work/atlas", { button: 1 }), HERE)).toBeNull();
    expect(classifyLink(link("/work/atlas", { defaultPrevented: true }), HERE)).toBeNull();
    expect(classifyLink(link("mailto:hello@retrograde.example"), HERE)).toBeNull();
  });

  it("honors the opt-outs: none, and continuity for routes (a shared element survives — PROJECTION)", () => {
    expect(classifyLink(link("#log", { transition: "none" }), HERE)).toBeNull();
    expect(classifyLink(link("/work/atlas", { transition: "continuity" }), HERE)).toBeNull();
    expect(classifyLink(link("#log", { transition: "continuity" }), HERE)).toBe("hash");
  });
});

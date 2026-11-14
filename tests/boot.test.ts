import { describe, expect, it } from "vitest";
import { bootFraction, cleanRenderer, megabytes, meter, onBootTask, registerBootTask } from "@/lib/boot";
import { boot, signature } from "@/lib/motion";

/** DESIGN.md §7.4 POST — the boot's clock, its arithmetic and the truth of its lines. */
describe("boot", () => {
  it("runs on the bible's clock: P1 250 ms, lines ≥ 40 ms apart, POWER ON by 1.6 s, the hero by 2.2 s", () => {
    expect(boot).toMatchObject({ p1Ms: 250, lineGapMs: 40, powerAtMs: 1600, capMs: 2200 });
    // POWER ON (600 ms) started at 1.6 s ends exactly at the cap
    expect(boot.powerAtMs + signature.power.onMs).toBe(boot.capMs);
    // the ≤ 3% flicker is far below WCAG 2.3.1's 10%
    expect(boot.flickerMs).toBeGreaterThan(1000 / 3);
  });

  it("counts real bytes when any task declares them, else tasks", () => {
    expect(bootFraction({ bytes: { loaded: 250, total: 1000 }, tasks: { done: 0, total: 4 } })).toBe(0.25);
    expect(bootFraction({ bytes: { loaded: 0, total: 0 }, tasks: { done: 3, total: 4 } })).toBe(0.75);
    expect(bootFraction({ bytes: { loaded: 2000, total: 1000 }, tasks: { done: 0, total: 1 } })).toBe(1);
    expect(megabytes(1_420_000)).toBe("1.42");
    expect(meter(0.5, 10)).toBe("▕█████░░░░░▏");
    expect(meter(1.4, 4)).toBe("▕████▏");
  });

  it("never loses a line: tasks settled before a listener are replayed, failures settle silently", async () => {
    registerBootTask("t-ok", Promise.resolve({ key: "t-ok", tag: "T", text: "ok", status: "OK" }), 10);
    registerBootTask("t-fail", Promise.reject(new Error("no")), 5);
    await new Promise((r) => setTimeout(r, 0));
    const seen: [string, string | null][] = [];
    onBootTask((id, line) => seen.push([id, line?.text ?? null]));
    expect(seen).toContainEqual(["t-ok", "ok"]);
    expect(seen).toContainEqual(["t-fail", null]);
  });

  it("prints the GPU WebGL names — or admits the browser masked it", () => {
    expect(cleanRenderer("ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, Unspecified Version)")).toBe("Apple M5 Pro");
    expect(cleanRenderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("NVIDIA GeForce RTX 3080");
    expect(cleanRenderer("Mali-G68 MP5")).toBe("Mali-G68 MP5");
    expect(cleanRenderer("Apple GPU")).toBeNull(); // Safari's bucket names nothing
    expect(cleanRenderer("WebKit WebGL")).toBeNull();
    expect(cleanRenderer("")).toBeNull();
    expect(cleanRenderer(null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { isSoftwareRenderer } from "@/lib/gl";

/** A software rasterizer is OFF (Part 16): the renderer strings the stage refuses, and the ones it keeps. */
describe("isSoftwareRenderer", () => {
  it("names the software rasterizers", () => {
    for (const r of [
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)",
      "Google SwiftShader",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
      "softpipe",
      "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)",
      "WARP",
    ])
      expect(isSoftwareRenderer(r), r).toBe(true);
  });
  it("keeps every GPU", () => {
    for (const r of [null, "", "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, Unspecified Version)", "Apple GPU", "Adreno (TM) 740", "Mali-G78", "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)", "Intel(R) Iris(R) Xe Graphics"])
      expect(isSoftwareRenderer(r), String(r)).toBe(false);
  });
});

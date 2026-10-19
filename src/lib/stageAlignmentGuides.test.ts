import { describe, expect, it } from "vitest";
import { resolveAlignmentGuides } from "./stageAlignmentGuides";

describe("resolveAlignmentGuides", () => {
  it("shows a guide near another dancer's x without requiring a snap", () => {
    // 150cm peer on a 12m stage ≈ ±12.5% from center → x≈37.5 or 62.5
    const peerX = 37.5;
    const near = resolveAlignmentGuides(38.2, 40, [peerX], [20]);
    expect(near.guideX).toBe(peerX);
    expect(near.guideY).toBeNull();
  });

  it("does not guide when farther than the threshold", () => {
    const far = resolveAlignmentGuides(45, 40, [37.5], [20]);
    expect(far.guideX).toBeNull();
  });

  it("prefers the closer candidate within threshold", () => {
    const g = resolveAlignmentGuides(49.5, 40, [48.8, 37.5], []);
    expect(g.guideX).toBe(50);
  });
});

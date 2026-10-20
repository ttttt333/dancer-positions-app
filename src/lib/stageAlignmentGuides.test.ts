import { describe, expect, it } from "vitest";
import {
  ALIGNMENT_GUIDE_THRESHOLD_PCT,
  resolveAlignmentGuides,
  resolveAlignmentGuidesWithSnap,
} from "./stageAlignmentGuides";

describe("resolveAlignmentGuides", () => {
  it("shows a guide only when nearly exact to another dancer", () => {
    const peerX = 37.5;
    const near = resolveAlignmentGuides(37.7, 40, [peerX], [20]);
    expect(near.guideX).toBe(peerX);
    expect(near.guideY).toBeNull();
  });

  it("does not guide when slightly off beyond the tight threshold", () => {
    const peerX = 37.5;
    // 旧しきい値 1.2 では出ていた距離でも、いまは出ない
    const slightlyOff = resolveAlignmentGuides(38.2, 40, [peerX], [20]);
    expect(slightlyOff.guideX).toBeNull();
    expect(ALIGNMENT_GUIDE_THRESHOLD_PCT).toBeLessThan(0.8);
  });

  it("does not guide when farther than the threshold", () => {
    const far = resolveAlignmentGuides(45, 40, [37.5], [20]);
    expect(far.guideX).toBeNull();
  });

  it("prefers the closer candidate within threshold", () => {
    const g = resolveAlignmentGuides(49.85, 40, [49.7, 37.5], []);
    expect(g.guideX).toBe(50);
  });
});

describe("resolveAlignmentGuidesWithSnap", () => {
  it("snaps onto the guide when inside the tight threshold", () => {
    const snapped = resolveAlignmentGuidesWithSnap(50.25, 40.2, [37.5], [40]);
    expect(snapped.guideX).toBe(50);
    expect(snapped.guideY).toBe(40);
    expect(snapped.xPct).toBe(50);
    expect(snapped.yPct).toBe(40);
  });

  it("leaves position unchanged when no guide is near", () => {
    const free = resolveAlignmentGuidesWithSnap(33, 22, [10], [80]);
    expect(free.guideX).toBeNull();
    expect(free.guideY).toBeNull();
    expect(free.xPct).toBe(33);
    expect(free.yPct).toBe(22);
  });
});

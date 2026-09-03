import { describe, expect, it } from "vitest";
import {
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "./projectDefaults";
import {
  computeMarkerResizeDraftSizes,
  poseLevelLabelJa,
  poseLevelMarkerScale,
} from "./stageMarkerSizing";

describe("computeMarkerResizeDraftSizes", () => {
  it("単体選択は差分で拡縮する", () => {
    const draft = computeMarkerResizeDraftSizes({
      startSizes: new Map([["a", 20]]),
      delta: 4,
      minPx: MARKER_DIAMETER_PX_MIN,
      maxPx: MARKER_DIAMETER_PX_MAX,
      bulk: false,
    });
    expect(draft.get("a")).toBe(24);
  });

  it("複数選択は同一直径になる", () => {
    const draft = computeMarkerResizeDraftSizes({
      startSizes: new Map([
        ["a", 18],
        ["b", 24],
      ]),
      delta: 6,
      minPx: MARKER_DIAMETER_PX_MIN,
      maxPx: MARKER_DIAMETER_PX_MAX,
      bulk: true,
      anchorSizePx: 24,
    });
    expect(draft.get("a")).toBe(30);
    expect(draft.get("b")).toBe(30);
  });

  it("複数選択は上限でクランプしても全員同じ", () => {
    const draft = computeMarkerResizeDraftSizes({
      startSizes: new Map([
        ["a", 30],
        ["b", 40],
      ]),
      delta: 200,
      minPx: MARKER_DIAMETER_PX_MIN,
      maxPx: 48,
      bulk: true,
      anchorSizePx: 40,
    });
    expect(draft.get("a")).toBe(48);
    expect(draft.get("b")).toBe(48);
  });
});

describe("poseLevelMarkerScale", () => {
  it("shrinks crouch and sit without changing stand", () => {
    expect(poseLevelMarkerScale(undefined)).toBe(1);
    expect(poseLevelMarkerScale("stand")).toBe(1);
    expect(poseLevelMarkerScale("crouch")).toBeLessThan(1);
    expect(poseLevelMarkerScale("sit")).toBeLessThan(
      poseLevelMarkerScale("crouch")
    );
    expect(poseLevelLabelJa("crouch")).toBe("しゃがみ");
    expect(poseLevelLabelJa("sit")).toBe("座り");
  });
});

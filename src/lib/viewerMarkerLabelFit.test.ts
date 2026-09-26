import { describe, expect, it } from "vitest";
import {
  computeViewerNameOverlapFitScale,
  countViewerNameLabelOverlaps,
} from "./viewerMarkerLabelFit";
import {
  clampViewerMarkerScale,
  clampViewerNameScale,
  PUBLIC_VIEWER_MARKER_DISPLAY_SCALE,
  stepViewerScale,
  VIEWER_MARKER_SCALE_STEPS,
  VIEWER_NAME_SCALE_STEPS,
} from "./viewerMarkerDisplay";

describe("viewerMarkerDisplay", () => {
  it("clamps scales", () => {
    expect(clampViewerMarkerScale(PUBLIC_VIEWER_MARKER_DISPLAY_SCALE)).toBeCloseTo(
      2 / 3,
      2
    );
    expect(clampViewerMarkerScale(0.1)).toBe(0.4);
    expect(clampViewerNameScale(3)).toBe(1.35);
  });

  it("steps scales", () => {
    expect(stepViewerScale(0.67, VIEWER_MARKER_SCALE_STEPS, 1)).toBe(0.8);
    expect(stepViewerScale(1, VIEWER_NAME_SCALE_STEPS, -1)).toBe(0.8);
  });
});

describe("computeViewerNameOverlapFitScale", () => {
  it("returns 1 when few dancers or no overlap", () => {
    expect(
      computeViewerNameOverlapFitScale({
        dancers: [{ xPct: 20, yPct: 40, label: "あ" }],
        floorW: 320,
        floorH: 480,
        markerPx: 14,
        nameFontPx: 14,
        labelOffsetPx: 20,
      })
    ).toBe(1);

    expect(
      computeViewerNameOverlapFitScale({
        dancers: [
          { xPct: 10, yPct: 20, label: "太郎" },
          { xPct: 90, yPct: 80, label: "花子" },
        ],
        floorW: 320,
        floorH: 480,
        markerPx: 14,
        nameFontPx: 14,
        labelOffsetPx: 20,
      })
    ).toBe(1);
  });

  it("shrinks when labels cluster", () => {
    const dancers = Array.from({ length: 8 }, (_, i) => ({
      xPct: 48 + (i % 2) * 2,
      yPct: 48 + Math.floor(i / 2) * 2,
      label: `メンバー${i + 1}`,
    }));
    const input = {
      dancers,
      floorW: 300,
      floorH: 420,
      markerPx: 16,
      nameFontPx: 16,
      labelOffsetPx: 22,
    };
    const before = countViewerNameLabelOverlaps(input, 1);
    expect(before).toBeGreaterThan(0);
    const scale = computeViewerNameOverlapFitScale(input);
    expect(scale).toBeLessThan(1);
    expect(countViewerNameLabelOverlaps(input, scale)).toBeLessThanOrEqual(
      before
    );
  });
});

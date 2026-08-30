import { describe, expect, it } from "vitest";
import { placeStageContextToolbar } from "./placeStageContextToolbar";

describe("placeStageContextToolbar", () => {
  it("places the toolbar above a centered dancer", () => {
    const p = placeStageContextToolbar({
      xPct: 50,
      yPct: 50,
      markerRadiusPx: 16,
      toolbarW: 220,
      toolbarH: 40,
      stageW: 800,
      stageH: 500,
    });
    expect(p.placeAbove).toBe(true);
    expect(p.leftPx).toBeGreaterThan(0);
    expect(p.leftPx + 220).toBeLessThanOrEqual(800);
    expect(p.topPx).toBeLessThan(250);
  });

  it("flips below when the dancer is near the top edge", () => {
    const p = placeStageContextToolbar({
      xPct: 50,
      yPct: 4,
      markerRadiusPx: 20,
      toolbarW: 220,
      toolbarH: 40,
      stageW: 800,
      stageH: 500,
    });
    expect(p.placeAbove).toBe(false);
    expect(p.topPx).toBeGreaterThan(20);
  });

  it("keeps the toolbar inside the left and right edges", () => {
    const left = placeStageContextToolbar({
      xPct: 1,
      yPct: 50,
      markerRadiusPx: 16,
      toolbarW: 220,
      toolbarH: 40,
      stageW: 800,
      stageH: 500,
      padPx: 8,
    });
    expect(left.leftPx).toBe(8);
    const right = placeStageContextToolbar({
      xPct: 99,
      yPct: 50,
      markerRadiusPx: 16,
      toolbarW: 220,
      toolbarH: 40,
      stageW: 800,
      stageH: 500,
      padPx: 8,
    });
    expect(right.leftPx + 220).toBeLessThanOrEqual(792);
  });

  it("keeps the toolbar inside the bottom edge", () => {
    const p = placeStageContextToolbar({
      xPct: 50,
      yPct: 96,
      markerRadiusPx: 20,
      toolbarW: 220,
      toolbarH: 40,
      stageW: 800,
      stageH: 500,
      padPx: 8,
    });
    expect(p.topPx).toBeGreaterThanOrEqual(8);
    expect(p.topPx + 40).toBeLessThanOrEqual(492);
  });
});

import { describe, expect, it } from "vitest";
import {
  TOP_DOCK_HEIGHT_WIDE_PX,
  TOP_DOCK_ROW_MIN_WIDE_PX,
  clampWideTopDockRowToViewport,
  resolveAdaptiveWideTopDockDefaultPx,
} from "./waveDockMetrics";

describe("resolveAdaptiveWideTopDockDefaultPx", () => {
  it("keeps the Mac-Air-sized default on tall viewports", () => {
    expect(resolveAdaptiveWideTopDockDefaultPx(980)).toBe(TOP_DOCK_HEIGHT_WIDE_PX);
  });

  it("shrinks on short CSS heights (Windows 150% / small laptop)", () => {
    const h = resolveAdaptiveWideTopDockDefaultPx(720);
    expect(h).toBeLessThan(TOP_DOCK_HEIGHT_WIDE_PX);
    expect(h).toBeGreaterThanOrEqual(TOP_DOCK_ROW_MIN_WIDE_PX);
  });
});

describe("clampWideTopDockRowToViewport", () => {
  it("clamps oversized stored docks so the stage still fits", () => {
    const next = clampWideTopDockRowToViewport(480, 700, 480);
    expect(next).toBeLessThanOrEqual(700 - 260);
    expect(next).toBeGreaterThanOrEqual(TOP_DOCK_ROW_MIN_WIDE_PX);
  });
});

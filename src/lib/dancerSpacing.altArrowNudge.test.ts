import { describe, expect, it } from "vitest";
import {
  nudgeXPctForAltArrow,
  nudgeYPctForAltArrow,
  resolveStageArrowNudgeKey,
  snapYPctToDepthMmGrid,
} from "./dancerSpacing";

describe("resolveStageArrowNudgeKey", () => {
  it("prefers code when Option turns key into a symbol", () => {
    expect(
      resolveStageArrowNudgeKey({ key: "˚", code: "ArrowUp" })
    ).toBe("ArrowUp");
    expect(
      resolveStageArrowNudgeKey({ key: "ArrowDown", code: "ArrowDown" })
    ).toBe("ArrowDown");
    expect(resolveStageArrowNudgeKey({ key: "a", code: "KeyA" })).toBeNull();
  });
});

describe("snapYPctToDepthMmGrid", () => {
  it("snaps depth to 50mm steps from the front", () => {
    const D = 8_000;
    const y = snapYPctToDepthMmGrid(12.3, D, 50);
    const mm = (y / 100) * D;
    expect(mm % 50).toBe(0);
  });
});

describe("nudgeYPctForAltArrow", () => {
  it("moves one 50mm depth cell so Option+Up/Down always change position", () => {
    const D = 8_000;
    // 奥行 0% から下へ → 50mm = 0.625%
    const next = nudgeYPctForAltArrow(0, 1, { stageDepthMm: D, stepPct: 0.25 });
    expect(next).toBeCloseTo((50 / D) * 100, 5);
    const back = nudgeYPctForAltArrow(next, -1, {
      stageDepthMm: D,
      stepPct: 0.25,
    });
    expect(back).toBeCloseTo(0, 5);
  });

  it("falls back to pct step when depth is unknown", () => {
    expect(nudgeYPctForAltArrow(40, -1, { stepPct: 0.25 })).toBeCloseTo(
      39.75,
      5
    );
  });
});

describe("nudgeXPctForAltArrow", () => {
  it("moves one 50mm center-distance cell", () => {
    const W = 12_000;
    const atCenter = nudgeXPctForAltArrow(50, 1, {
      stageWidthMm: W,
      stepPct: 0.25,
    });
    expect(atCenter).toBeCloseTo(50 + (50 / W) * 100, 5);
  });
});

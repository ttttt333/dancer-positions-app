import { describe, expect, it } from "vitest";
import {
  screenDeltaPctToStageDelta,
  screenPctToStagePct,
  stagePctToScreenPct,
} from "./stageRotationCoordinates";

describe("stageRotationCoordinates", () => {
  it("keeps points and deltas unchanged at zero degrees", () => {
    expect(screenPctToStagePct({ xPct: 20, yPct: 35 }, 0)).toEqual({
      xPct: 20,
      yPct: 35,
    });
    expect(screenDeltaPctToStageDelta({ xPct: 8, yPct: -4 }, 0)).toEqual({
      xPct: 8,
      yPct: -4,
    });
  });

  it("inverts both axes at 180 degrees", () => {
    expect(screenPctToStagePct({ xPct: 20, yPct: 35 }, 180)).toEqual({
      xPct: 80,
      yPct: 65,
    });
    expect(screenDeltaPctToStageDelta({ xPct: 8, yPct: -4 }, 180)).toEqual({
      xPct: -8,
      yPct: 4,
    });
  });

  it("round-trips stage and screen points when flipped", () => {
    const stagePoint = { xPct: 23.5, yPct: 81.25 };
    const screenPoint = stagePctToScreenPct(stagePoint, -180);
    expect(screenPctToStagePct(screenPoint, -180)).toEqual(stagePoint);
  });
});

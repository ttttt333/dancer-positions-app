import { describe, expect, it } from "vitest";
import {
  cueWindowsForHits,
  ensureTravelGaps,
  minHitGapSec,
  travelDurationSec,
} from "./suggestTravelTiming";

describe("suggestTravelTiming", () => {
  it("leaves a 4-count travel gap before the next hit", () => {
    const bpm = 120;
    const travel = travelDurationSec(bpm);
    expect(travel).toBeCloseTo(2, 5);
    const windows = cueWindowsForHits([0, 16, 32], 80, bpm);
    expect(windows).toHaveLength(3);
    expect(windows[0]!.tStartSec).toBe(0);
    expect(windows[0]!.tEndSec).toBeCloseTo(16 - travel, 5);
    expect(windows[1]!.tStartSec).toBe(16);
    expect(windows[1]!.tEndSec).toBeCloseTo(32 - travel, 5);
    expect(windows[1]!.tStartSec - windows[0]!.tEndSec).toBeCloseTo(travel, 5);
  });

  it("keeps a 4-count hold even when the next hit is far", () => {
    const windows = cueWindowsForHits([0], 10, 120);
    expect(windows[0]!.tEndSec).toBe(10);
  });

  it("ensureTravelGaps never lets cues abut", () => {
    const bpm = 120;
    const travel = travelDurationSec(bpm);
    const fixed = ensureTravelGaps(
      [
        { tStartSec: 0, tEndSec: 16 },
        { tStartSec: 16, tEndSec: 32 },
      ],
      bpm
    );
    expect(fixed[1]!.tStartSec - fixed[0]!.tEndSec).toBeCloseTo(travel, 5);
  });

  it("min hit gap is hold plus travel", () => {
    expect(minHitGapSec(120)).toBeCloseTo(4, 5);
  });
});

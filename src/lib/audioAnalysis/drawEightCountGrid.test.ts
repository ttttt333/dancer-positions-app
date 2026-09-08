import { describe, expect, it } from "vitest";
import type { BeatInfo } from "../../types/audioAnalysis";
import {
  countVisibleEightCountBeats,
  drawEightCountGrid,
} from "./drawEightCountGrid";

function makeBeats(): BeatInfo[] {
  const out: BeatInfo[] = [];
  for (let eight = 0; eight < 4; eight += 1) {
    for (let n = 1; n <= 8; n += 1) {
      out.push({
        timestamp: eight * 2 + (n - 1) * 0.25,
        isDownbeat: n === 1,
        beatNumber: n,
      });
    }
  }
  return out;
}

describe("drawEightCountGrid", () => {
  it("culls to viewport and drops sub-beats when zoomed out", () => {
    const beats = makeBeats();
    // 広域: 8秒を 100px → px/sec = 12.5 < 32 → downbeat only
    const wide = countVisibleEightCountBeats(beats, 0, 8, 100, 32);
    expect(wide.downbeats).toBe(4);
    expect(wide.subBeats).toBe(0);

    // 拡大: [0, 1.9] 秒を 200px → 最初の8カウントのみ
    const zoom = countVisibleEightCountBeats(beats, 0, 1.9, 200, 32);
    expect(zoom.downbeats).toBe(1);
    expect(zoom.subBeats).toBe(7);
  });

  it("exports drawEightCountGrid as a function", () => {
    expect(typeof drawEightCountGrid).toBe("function");
  });
});

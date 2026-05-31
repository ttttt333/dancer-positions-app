import { describe, expect, it } from "vitest";
import type { Cue } from "../types/choreography";
import { pickCueDragKindAtWave, pickCueIdAtWave, resolveWaveViewForPointerHit } from "./timelineWaveGeometry";

function mockCanvas(width: number, height: number, left = 0, top = 0): HTMLCanvasElement {
  return {
    getBoundingClientRect: () =>
      ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
      }) as DOMRect,
  } as HTMLCanvasElement;
}

describe("pickCueDragKindAtWave", () => {
  const cues: Cue[] = [
    { id: "a", tStartSec: 10, tEndSec: 20, formationId: "f1" },
    { id: "b", tStartSec: 20, tEndSec: 30, formationId: "f2" },
  ];

  it("detects move in the center of a cue band", () => {
    const canvas = mockCanvas(1000, 80);
    const hit = pickCueDragKindAtWave(
      150,
      40,
      canvas,
      cues,
      0,
      100,
      null
    );
    expect(hit).toEqual({ cueId: "a", mode: "move" });
  });

  it("detects start/end resize zones including outside the drawn edge", () => {
    const canvas = mockCanvas(1000, 80);
    const startHit = pickCueDragKindAtWave(
      92,
      40,
      canvas,
      cues,
      0,
      100,
      null
    );
    expect(startHit?.cueId).toBe("a");
    expect(startHit?.mode).toBe("start");

    const endHit = pickCueDragKindAtWave(
      208,
      40,
      canvas,
      cues,
      0,
      100,
      null
    );
    expect(endHit?.cueId).toBe("a");
    expect(endHit?.mode).toBe("end");
  });

  it("prefers cue resize at adjacent cue junction over gap-only hit", () => {
    const canvas = mockCanvas(1000, 80);
    const hit = pickCueDragKindAtWave(
      200,
      40,
      canvas,
      cues,
      0,
      100,
      null
    );
    expect(hit?.mode === "start" || hit?.mode === "end").toBe(true);
  });
});

describe("resolveWaveViewForPointerHit", () => {
  it("matches live zoom state instead of stale lastDrawRange", () => {
    const live = resolveWaveViewForPointerHit({
      durationSec: 100,
      viewPortion: 0.2,
      isPlaying: false,
      viewStartOverride: 40,
      anchorTimeSec: 50,
    });
    expect(live.viewStart).toBe(40);
    expect(live.viewSpan).toBeCloseTo(20, 5);

    const stale = resolveWaveViewForPointerHit({
      durationSec: 100,
      viewPortion: 1,
      isPlaying: false,
      viewStartOverride: null,
      anchorTimeSec: 0,
    });
    expect(stale.viewSpan).toBe(100);
  });
});

describe("pickCueIdAtWave", () => {
  it("matches the full drawn cue height", () => {
    const cues: Cue[] = [
      { id: "a", tStartSec: 0, tEndSec: 50, formationId: "f1" },
    ];
    const canvas = mockCanvas(400, 60);
    expect(
      pickCueIdAtWave(200, 2, canvas, cues, 0, 100, null)
    ).toBe("a");
    expect(
      pickCueIdAtWave(200, 58, canvas, cues, 0, 100, null)
    ).toBe("a");
  });
});

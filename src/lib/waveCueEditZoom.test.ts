import { describe, expect, it } from "vitest";
import { computeZoomToSelectedCue } from "./waveCueEditZoom";

describe("computeZoomToSelectedCue", () => {
  it("zooms more for a short cue than a long cue", () => {
    const short = computeZoomToSelectedCue({
      durationSec: 180,
      cueStartSec: 40,
      cueEndSec: 42,
      canvasCssWidthPx: 360,
    });
    const long = computeZoomToSelectedCue({
      durationSec: 180,
      cueStartSec: 40,
      cueEndSec: 70,
      canvasCssWidthPx: 360,
    });
    expect(short.zoom).toBeGreaterThan(long.zoom);
    expect(short.zoom).toBeGreaterThan(8);
  });

  it("centers the view on the cue", () => {
    const r = computeZoomToSelectedCue({
      durationSec: 120,
      cueStartSec: 50,
      cueEndSec: 56,
      canvasCssWidthPx: 360,
    });
    const mid = r.viewStartSec + 120 / r.zoom / 2;
    expect(mid).toBeCloseTo(53, 0);
  });

  it("clamps to full-song when duration is tiny", () => {
    const r = computeZoomToSelectedCue({
      durationSec: 2,
      cueStartSec: 0,
      cueEndSec: 2,
    });
    expect(r.zoom).toBe(1);
    expect(r.viewStartSec).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  CUE_DRAG_EDGE_SCROLL_PAN_STRENGTH,
  panWaveViewStartAtClientX,
  WAVE_EDGE_SCROLL_PAN_STRENGTH,
} from "./waveEdgeScrollDuringScrub";

describe("panWaveViewStartAtClientX", () => {
  const rect = { left: 0, right: 400, width: 400, top: 0, bottom: 80 } as DOMRect;
  const base = {
    canvasRect: rect,
    viewStart: 10,
    viewSpan: 40,
    durationSec: 120,
    viewPortion: 0.33,
  };

  it("pans left when pointer is in the left edge zone", () => {
    const next = panWaveViewStartAtClientX({
      ...base,
      clientX: 8,
    });
    expect(next).not.toBeNull();
    expect(next!).toBeLessThan(base.viewStart);
  });

  it("uses weaker pan strength for cue drag than default scrub", () => {
    const defaultPan = panWaveViewStartAtClientX({
      ...base,
      clientX: 8,
      panStrength: WAVE_EDGE_SCROLL_PAN_STRENGTH,
    });
    const cuePan = panWaveViewStartAtClientX({
      ...base,
      clientX: 8,
      panStrength: CUE_DRAG_EDGE_SCROLL_PAN_STRENGTH,
    });
    expect(defaultPan).not.toBeNull();
    expect(cuePan).not.toBeNull();
    expect(Math.abs(base.viewStart - cuePan!)).toBeLessThan(
      Math.abs(base.viewStart - defaultPan!)
    );
  });
});

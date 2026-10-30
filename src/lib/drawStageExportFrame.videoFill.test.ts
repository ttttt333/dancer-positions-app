import { describe, expect, it } from "vitest";
import {
  exportDancerMarkerPx,
  exportNameBelowFontPx,
  layoutStageExportFrame,
} from "./drawStageExportFrame";
import type { StageExportAppearance } from "./stageExportAppearance";

function appearance(videoFill: boolean): StageExportAppearance {
  return {
    rotDeg: 0,
    Wmm: 12_000,
    Dmm: 8_000,
    Smm: 2_500,
    Bmm: 2_000,
    showShell: true,
    dancerLabelBelow: true,
    stageGridLinesVertical: false,
    stageGridLinesHorizontal: false,
    stepXPct: null,
    stepYPct: null,
    centerFieldGuideIntervalMm: null,
    videoFill,
  };
}

const dancer = {
  name: "山田",
  color: "#38bdf8",
  x: 0.5,
  y: 0.5,
  sizePx: 18,
};

describe("video export framing", () => {
  it("fills the frame with the main floor and keeps its aspect", () => {
    const video = layoutStageExportFrame(1920, 1080, appearance(true));
    const print = layoutStageExportFrame(1920, 1080, appearance(false));
    expect(video.main.w * video.main.h).toBeGreaterThan(
      print.main.w * print.main.h * 1.15
    );
    expect(video.main.w / 1920).toBeGreaterThan(0.72);
    expect(video.main.h / 1080).toBeGreaterThan(0.85);
    expect(video.main.w / video.main.h).toBeCloseTo(12_000 / 8_000, 2);
    expect(video.main.y + video.main.h).toBeLessThan(1080 - 20);
  });

  it("still fills a 360p frame", () => {
    const video = layoutStageExportFrame(640, 360, appearance(true));
    expect(video.main.w / 640).toBeGreaterThan(0.7);
    expect(video.main.h / 360).toBeGreaterThan(0.8);
  });

  it("draws markers and names larger than the editor pixel size", () => {
    const { main } = layoutStageExportFrame(1920, 1080, appearance(true));
    const marker = exportDancerMarkerPx(main, dancer, true);
    const printMarker = exportDancerMarkerPx(main, dancer, false);
    expect(printMarker).toBe(18);
    expect(marker).toBeGreaterThan(70);
    expect(marker).toBeLessThan(main.w * 0.12);

    const bigger = exportDancerMarkerPx(main, { ...dancer, sizePx: 36 }, true);
    expect(bigger).toBeGreaterThan(marker);

    const namePx = exportNameBelowFontPx(marker, undefined, true);
    expect(namePx).toBeGreaterThan(28);
    expect(namePx).toBeLessThan(marker);

    const custom = exportNameBelowFontPx(marker, 40, true);
    expect(custom).toBeGreaterThan(namePx);
  });
});

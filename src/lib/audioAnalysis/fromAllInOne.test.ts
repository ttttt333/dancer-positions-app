import { describe, expect, it } from "vitest";
import {
  audioAnalysisFromAllInOne,
  beatInfosFromAllInOne,
  japaneseLabelForAllInOne,
  mockAllInOneRawResult,
  structureV2FromAllInOne,
} from "./fromAllInOne";

describe("japaneseLabelForAllInOne", () => {
  it("maps dancer-facing Japanese labels", () => {
    expect(japaneseLabelForAllInOne("verse")).toBe("Aメロ");
    expect(japaneseLabelForAllInOne("chorus")).toBe("サビ");
    expect(japaneseLabelForAllInOne("bridge")).toBe("Cメロ");
    expect(japaneseLabelForAllInOne("interlude")).toBe("間奏");
    expect(japaneseLabelForAllInOne("intro")).toBe("イントロ");
  });
});

describe("beatInfosFromAllInOne", () => {
  it("marks model downbeats precisely", () => {
    const beats = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
    const downbeats = [0, 4];
    const infos = beatInfosFromAllInOne(beats, downbeats, 8);
    expect(infos.filter((b) => b.isDownbeat).map((b) => b.timestamp)).toEqual([
      0, 4,
    ]);
  });
});

describe("audioAnalysisFromAllInOne", () => {
  it("builds snapped sections with Japanese labels from mock", () => {
    const raw = mockAllInOneRawResult(96);
    const analysis = audioAnalysisFromAllInOne(raw);
    expect(analysis).toBeTruthy();
    expect(analysis!.sourceLabel).toBe("all-in-one");
    expect(analysis!.beats.length).toBeGreaterThan(50);
    expect(analysis!.sections.some((s) => s.label === "サビ")).toBe(true);
    expect(analysis!.sections.some((s) => s.label === "Aメロ")).toBe(true);
    expect(analysis!.sections.length).toBeGreaterThanOrEqual(4);
    // 細切れでない
    expect(
      analysis!.sections.every((s) => s.endTime - s.startTime >= 4)
    ).toBe(true);
  });

  it("structureV2 carries beats and downbeats", () => {
    const v2 = structureV2FromAllInOne(mockAllInOneRawResult(64));
    expect(v2?.beats?.length).toBeGreaterThan(0);
    expect(v2?.downbeats?.length).toBeGreaterThan(0);
    expect(v2?.source).toBe("all-in-one");
  });
});

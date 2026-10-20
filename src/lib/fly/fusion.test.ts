import { describe, expect, it } from "vitest";
import type { StructureResultV2 } from "../choreocore/types/songStructure";
import { fuseToFlyAnalysis, fuseToStructureV2 } from "./fusion";
import { structureV2FromFlyAnalysis } from "./toStructureV2";

const sampleV2: StructureResultV2 = {
  bpm: 120,
  duration: 64,
  eight_times: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
  sections: [
    {
      label: "INTRO",
      start_eight: 0,
      end_eight: 2,
      start_time: 0,
      end_time: 8,
      cluster_id: 0,
      mean_energy: 0.3,
      energy_trend: 0.1,
      repeat_count: 1,
      confidence: 0.8,
    },
    {
      label: "CHORUS",
      start_eight: 2,
      end_eight: 6,
      start_time: 8,
      end_time: 24,
      cluster_id: 1,
      mean_energy: 0.9,
      energy_trend: 0.4,
      repeat_count: 1,
      confidence: 0.92,
    },
  ],
  change_points: [
    {
      time: 8,
      eight_index: 2,
      type: "CHORUS",
      is_major: true,
      confidence: 0.9,
    },
  ],
  source: "chroma-ssm",
  beats: Array.from({ length: 128 }, (_, i) => i * 0.5),
};

describe("FLY fusion Phase1–3", () => {
  it("projects StructureResultV2 into FlyAnalysisResult with confidence", () => {
    const fly = fuseToFlyAnalysis({
      structureV2: sampleV2,
      audioHash: "hash-test",
      songDynamism: 0.7,
    });
    expect(fly.structureV2Compatible).toBe(true);
    expect(fly.tempo.estimatedBpm).toBe(120);
    expect(fly.sections.length).toBe(2);
    expect(fly.sections[1]!.type).toBe("chorus");
    expect(fly.formationChangePoints.length).toBe(1);
    expect(fly.formationChangePoints[0]!.tier).toBe("MAJOR");
    expect(fly.quality.overall).toBeGreaterThan(0.4);
    expect(fly.sources.some((s) => s.id === "essentia" && !s.available)).toBe(
      true
    );
  });

  it("round-trips to StructureResultV2 for Formation Engine", () => {
    const fly = fuseToFlyAnalysis({ structureV2: sampleV2, audioHash: "h" });
    const back = structureV2FromFlyAnalysis(fly);
    expect(back.bpm).toBe(120);
    expect(back.sections.length).toBe(2);
    expect(back.change_points.length).toBe(1);
    const viaFuse = fuseToStructureV2({ structureV2: sampleV2 });
    expect(viaFuse.eight_times.length).toBeGreaterThan(0);
  });

  it("marks low-confidence sections as unknown", () => {
    const weak: StructureResultV2 = {
      ...sampleV2,
      sections: [
        {
          ...sampleV2.sections[0]!,
          label: "CHORUS",
          confidence: 0.2,
        },
      ],
    };
    const fly = fuseToFlyAnalysis({ structureV2: weak, audioHash: "h" });
    expect(fly.sections[0]!.type).toBe("unknown");
  });
});

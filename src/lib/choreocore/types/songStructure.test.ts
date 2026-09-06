import { describe, expect, it } from "vitest";
import {
  approximateSongSectionV2FromLegacy,
  findSongSectionV2AtTime,
  mapLegacyTypeToSectionLabelV2,
  resolveSongSectionV2,
  type StructureResultV2,
} from "../types/songStructure";

describe("songStructure v2 types/helpers", () => {
  it("maps legacy types onto v2 labels", () => {
    expect(mapLegacyTypeToSectionLabelV2("PRE_CHORUS")).toBe("B_MELO");
    expect(mapLegacyTypeToSectionLabelV2("BREAK")).toBe("BREAKDOWN");
    expect(mapLegacyTypeToSectionLabelV2("CHORUS_START")).toBe("CHORUS");
    expect(mapLegacyTypeToSectionLabelV2("VERSE")).toBe("A_MELO");
  });

  it("finds section by time and prefers structureV2 over legacy", () => {
    const structureV2: StructureResultV2 = {
      bpm: 120,
      duration: 100,
      eight_times: [0, 4, 8],
      sections: [
        {
          label: "CHORUS",
          start_eight: 2,
          end_eight: 4,
          start_time: 16,
          end_time: 32,
          cluster_id: 7,
          mean_energy: 0.9,
          energy_trend: 0.01,
          repeat_count: 2,
          confidence: 0.95,
        },
      ],
      change_points: [],
      source: "chroma-ssm-v2",
    };
    expect(findSongSectionV2AtTime(structureV2.sections, 20)?.cluster_id).toBe(
      7
    );
    const resolved = resolveSongSectionV2({
      timeSec: 20,
      structureV2,
      legacySection: {
        type: "VERSE",
        startTime: 16,
        endTime: 32,
        energyMean: 0.4,
      },
    });
    expect(resolved?.cluster_id).toBe(7);
    expect(resolved?.label).toBe("CHORUS");
  });

  it("approximates SongSectionV2 from legacy MusicSection", () => {
    const approx = approximateSongSectionV2FromLegacy({
      type: "CHORUS",
      startTime: 40,
      endTime: 56,
      energyMean: 0.85,
      energyDelta: 0.02,
    });
    expect(approx?.label).toBe("CHORUS");
    expect(approx?.cluster_id).toBe(40);
    expect(approx?.energy_trend).toBe(0.02);
  });
});

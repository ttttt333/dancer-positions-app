import { describe, expect, it } from "vitest";
import {
  appChangePointsFromStructureV2,
  mergeAdjacentSongSectionsV2,
  preferStructuralChangePoints,
  EARLY_CHORUS_GUARD_SEC,
} from "./productionChangePointAdapter";
import type { StructureResultV2 } from "../types/songStructure";
import type { ChangePoint as AppChangePoint } from "../types";

function section(
  label: StructureResultV2["sections"][number]["label"],
  start: number,
  end: number,
  cluster = 1
): StructureResultV2["sections"][number] {
  return {
    label,
    start_eight: 0,
    end_eight: 0,
    start_time: start,
    end_time: end,
    cluster_id: cluster,
    mean_energy: label === "CHORUS" ? 0.85 : 0.4,
    energy_trend: 0,
    repeat_count: 2,
    confidence: 0.9,
  };
}

describe("appChangePointsFromStructureV2", () => {
  it("maps B_MELO to PRE_CHORUS and first real CHORUS to CHORUS_START", () => {
    const v2: StructureResultV2 = {
      bpm: 120,
      duration: 90,
      eight_times: [],
      sections: [
        section("INTRO", 0, 8),
        section("A_MELO", 8, 24),
        section("B_MELO", 24, 32),
        section("CHORUS", 32, 48, 2),
        section("CHORUS", 64, 80, 2),
      ],
      change_points: [],
      source: "chroma-ssm-v2",
    };
    const cps = appChangePointsFromStructureV2(v2)!;
    expect(cps.map((c) => c.section_type)).toEqual([
      "INTRO",
      "VERSE",
      "PRE_CHORUS",
      "CHORUS_START",
      "CHORUS",
    ]);
  });

  it("demotes early false CHORUS when a later chorus exists", () => {
    const v2: StructureResultV2 = {
      bpm: 129,
      duration: 120,
      eight_times: [],
      sections: [
        section("CHORUS", 4, 12, 9), // early loud motif
        section("A_MELO", 12, 40, 1),
        section("B_MELO", 40, 48, 3),
        section("CHORUS", 48, 64, 2),
      ],
      change_points: [],
    };
    const cps = appChangePointsFromStructureV2(v2)!;
    const early = cps.find((c) => c.time < EARLY_CHORUS_GUARD_SEC)!;
    expect(early.section_type).toBe("VERSE");
    const firstReal = cps.find((c) => c.time >= EARLY_CHORUS_GUARD_SEC && c.section_type === "CHORUS_START");
    expect(firstReal?.time).toBe(48);
  });

  it("merges adjacent same-label same-cluster sections", () => {
    const merged = mergeAdjacentSongSectionsV2([
      section("CHORUS", 10, 16, 2),
      section("CHORUS", 16, 24, 2),
      section("A_MELO", 24, 32, 1),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]!.end_time).toBe(24);
  });
});

describe("preferStructuralChangePoints", () => {
  it("prefers structureV2 over loud v1 remote majors", () => {
    const v2: StructureResultV2 = {
      bpm: 120,
      duration: 80,
      eight_times: [],
      sections: [
        section("INTRO", 0, 16),
        section("A_MELO", 16, 32),
        section("CHORUS", 40, 56, 2),
      ],
      change_points: [],
    };
    const remote: AppChangePoint[] = [
      {
        eight_index: 1,
        time: 4,
        score: 0.99,
        tier: "major",
        section_type: "CHORUS_START",
      },
    ];
    const preferred = preferStructuralChangePoints({
      structureV2: v2,
      remote,
    })!;
    expect(preferred.some((c) => c.time === 4 && c.section_type === "CHORUS_START")).toBe(
      false
    );
    expect(preferred.some((c) => c.section_type === "CHORUS_START" && c.time === 40)).toBe(
      true
    );
  });
});

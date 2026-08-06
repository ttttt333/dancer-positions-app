/**
 * choreocore 純アルゴリズムエンジンの動作確認（モック変化点）
 */
import { describe, expect, it } from "vitest";
import {
  assignPerformers,
  generateFormations,
  METERS_PER_COUNT,
  COUNTS_PER_FOUR_EIGHT_BLOCK,
  TEMPLATES_25P,
  templatesForTier,
  type ChangePoint,
  type Formation,
} from "./index";

function lineFormation(n: number, y = 0): Formation {
  return {
    id: "init",
    performers: Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      position: {
        x: -5 + (i / Math.max(1, n - 1)) * 10,
        y,
      },
    })),
  };
}

describe("choreocore templates", () => {
  it("has templates for each tier with 25 positions", () => {
    for (const tier of ["major", "medium", "minor"] as const) {
      const pool = templatesForTier(tier);
      expect(pool.length).toBeGreaterThan(2);
      for (const t of pool) {
        expect(t.positions).toHaveLength(25);
      }
    }
    expect(TEMPLATES_25P.length).toBeGreaterThan(15);
  });
});

describe("assignPerformers", () => {
  it("preserves performer ids with minimal travel pairing", () => {
    const prev = lineFormation(25, 0);
    const nextPos = lineFormation(25, 2).performers.map((p) => p.position);
    const next = assignPerformers(prev, nextPos);
    expect(next.performers).toHaveLength(25);
    const ids = new Set(next.performers.map((p) => p.id));
    for (const p of prev.performers) {
      expect(ids.has(p.id)).toBe(true);
    }
  });
});

describe("generateFormations", () => {
  it("syncs to 4-eight blocks and prioritizes CHORUS_START impact", () => {
    const bpm = 120;
    const changePoints: ChangePoint[] = [
      {
        eight_index: 4,
        time: 16,
        score: 0.4,
        tier: "medium",
        section_type: "VERSE",
      },
      {
        eight_index: 8,
        time: 32,
        score: 0.9,
        tier: "major",
        section_type: "CHORUS_START",
      },
      {
        eight_index: 12,
        time: 48,
        score: 0.8,
        tier: "major",
        section_type: "CHORUS",
      },
      {
        eight_index: 16,
        time: 64,
        score: 0.35,
        tier: "minor",
        section_type: "VERSE",
      },
    ];

    const result = generateFormations(changePoints, lineFormation(6), bpm, {
      durationSec: 96,
    });

    expect(result.formations.length).toBe(5); // start + 4
    expect(result.cues.length).toBe(5);
    expect(result.formations.every((f) => f.performers.length === 6)).toBe(true);
    expect(result.cues.some((c) => c.name?.includes("サビ頭"))).toBe(true);
    expect(METERS_PER_COUNT).toBe(0.45);
    expect(COUNTS_PER_FOUR_EIGHT_BLOCK).toBe(32);

    for (const c of result.cues) {
      expect(c.tEndSec).toBeGreaterThanOrEqual(c.tStartSec);
      expect(result.formations.some((f) => f.id === c.formationId)).toBe(true);
    }
  });
});

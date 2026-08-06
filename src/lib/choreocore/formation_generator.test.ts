/**
 * choreocore 純アルゴリズムエンジンの動作確認（モック変化点）
 */
import { describe, expect, it } from "vitest";
import {
  assignPerformers,
  generateFormations,
  METERS_PER_COUNT,
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
  it("builds realistic formations for a small cast with section hints", () => {
    const bpm = 120;
    const changePoints: ChangePoint[] = [];
    for (let i = 1; i <= 8; i++) {
      changePoints.push({
        eight_index: i * 2,
        time: i * 16,
        score: 0.3 + (i % 3) * 0.25,
        tier: i % 3 === 0 ? "major" : i % 3 === 1 ? "medium" : "minor",
      });
    }

    const result = generateFormations(changePoints, lineFormation(6), bpm, {
      durationSec: 160,
      songDynamism: 0.55,
      sections: [
        { label: "イントロ", startSec: 0, endSec: 16, avgEnergy: 0.25 },
        { label: "Aメロ", startSec: 16, endSec: 48, avgEnergy: 0.4 },
        { label: "サビ", startSec: 48, endSec: 80, avgEnergy: 0.78 },
        { label: "Bメロ", startSec: 80, endSec: 112, avgEnergy: 0.5 },
        { label: "サビ", startSec: 112, endSec: 144, avgEnergy: 0.8 },
        { label: "アウトロ", startSec: 144, endSec: 160, avgEnergy: 0.2 },
      ],
    });

    expect(result.formations.length).toBeGreaterThanOrEqual(5);
    expect(result.cues.length).toBe(result.formations.length);
    expect(result.formations.every((f) => f.performers.length === 6)).toBe(true);
    expect(METERS_PER_COUNT).toBe(0.45);

    for (const c of result.cues) {
      expect(c.tEndSec).toBeGreaterThanOrEqual(c.tStartSec);
      expect(result.formations.some((f) => f.id === c.formationId)).toBe(true);
    }
  });
});

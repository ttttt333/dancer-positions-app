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
  it("builds ~10+ formations from mock change points without LLM", () => {
    const bpm = 120;
    const changePoints: ChangePoint[] = [];
    // 3分・4エイト間隔 ≈ 8秒 → 約 20 点のうち間引いて 12 点
    for (let i = 1; i <= 12; i++) {
      const eight = i * 2;
      changePoints.push({
        eight_index: eight,
        time: eight * (60 / bpm) * 8,
        score: 0.3 + (i % 3) * 0.2,
        tier: i % 3 === 0 ? "major" : i % 3 === 1 ? "medium" : "minor",
      });
    }

    const result = generateFormations(changePoints, lineFormation(25), bpm, {
      durationSec: 180,
      songDynamism: 0.55,
    });

    expect(result.formations.length).toBeGreaterThanOrEqual(10);
    expect(result.cues.length).toBe(result.formations.length);
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(METERS_PER_COUNT).toBe(0.45);

    for (const c of result.cues) {
      expect(c.tEndSec).toBeGreaterThanOrEqual(c.tStartSec);
      expect(result.formations.some((f) => f.id === c.formationId)).toBe(true);
    }
  });
});

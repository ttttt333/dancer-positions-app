/**
 * CHOREOCORE Tier 1 v6.1 — P0 決定性・数理テスト
 */
import { describe, expect, it } from "vitest";
import {
  computeFormationScore,
  computePersonalMaxDist,
  detectPathCrossings,
  solveMinDisplacementAssignment,
  type Formation,
  type TemplateSlot,
} from "./index";

describe("CHOREOCORE Tier 1 v6.1 Determinism & Math Tests", () => {
  it("P0-1: 決定性テスト (Lexical Order)", () => {
    const prev: Formation = {
      performers: [
        { id: "B", position: { x: 0, y: 0 } },
        { id: "A", position: { x: 2, y: 0 } },
      ],
    };
    const slots: TemplateSlot[] = [
      { id: "S2", position: { x: 0, y: 1 } },
      { id: "S1", position: { x: 2, y: 1 } },
    ];

    const result1 = solveMinDisplacementAssignment(prev, slots);
    const result2 = solveMinDisplacementAssignment(
      { performers: [...prev.performers].reverse() },
      [...slots].reverse()
    );

    expect(result1.assignment.get("A")).toEqual(result2.assignment.get("A"));
    expect(result1.assignment.get("B")).toEqual(result2.assignment.get("B"));
  });

  it("P0-2: 分散と平均の計算精度 (Variance Calculation)", () => {
    const prev: Formation = {
      performers: [
        { id: "P1", position: { x: 0, y: 0 } },
        { id: "P2", position: { x: 10, y: 0 } },
      ],
    };
    const slots: TemplateSlot[] = [
      { id: "S1", position: { x: 0, y: 4 } },
      { id: "S2", position: { x: 10, y: 2 } },
    ];

    const result = solveMinDisplacementAssignment(prev, slots);
    expect(result.averageDisplacement).toBeCloseTo(3);
    expect(result.displacementVariance).toBeCloseTo(1);
  });

  it("P0-3: 後方互換性テスト (Padding Mismatch)", () => {
    const prev: Formation = {
      performers: [
        { id: "P1", position: { x: 0, y: 0 } },
        { id: "P2", position: { x: 2, y: 0 } },
        { id: "P3", position: { x: 4, y: 0 } },
      ],
    };
    const slots: TemplateSlot[] = [
      { id: "S1", position: { x: 0, y: 1 } },
      { id: "S2", position: { x: 2, y: 1 } },
    ];

    const result = solveMinDisplacementAssignment(prev, slots);
    expect(result.feasible).toBe(true);
    expect(result.assignment.has("P3")).toBe(false);
    expect(result.assignment.size).toBe(2);
  });

  it("P0-4: 交差検出とスコア正規化", () => {
    const prev: Formation = {
      performers: [
        { id: "A", position: { x: 0, y: 0 } },
        { id: "B", position: { x: 2, y: 0 } },
      ],
    };
    // 交差する割当: A→(2,2), B→(0,2)
    const assignment = new Map([
      ["A", { x: 2, y: 2 }],
      ["B", { x: 0, y: 2 }],
    ]);
    const crossings = detectPathCrossings(prev, assignment);
    expect(crossings.length).toBe(1);
    expect(crossings[0]!.performerAId).toBe("A");
    expect(crossings[0]!.performerBId).toBe("B");

    const score = computeFormationScore(
      {
        assignment,
        totalDisplacement: 4,
        averageDisplacement: 2,
        displacementVariance: 0,
        maxIndividualDisplacement: 2,
        feasible: true,
        pinnedOverLimitPerformerIds: [],
        crossings,
      },
      4
    );
    // move: 100 * (1 - 2/4) = 50
    // safety: 100 - 15 = 85
    // total: 50*0.6 + 85*0.4 = 30+34 = 64
    expect(score.axes.move).toBe(50);
    expect(score.axes.safety).toBe(85);
    expect(score.axes.visual).toBeNull();
    expect(score.axes.music).toBeNull();
    expect(score.total).toBe(64);
  });

  it("P0-5: モビリティ係数が maxDist に効く", () => {
    const base = computePersonalMaxDist(32, 120, 0.5, {
      id: "p",
      mobilityFactor: 1,
    });
    const slow = computePersonalMaxDist(32, 120, 0.5, {
      id: "p",
      mobilityFactor: 0.5,
    });
    expect(slow).toBeCloseTo(base * 0.5);
    expect(base).toBeGreaterThan(0);
  });
});

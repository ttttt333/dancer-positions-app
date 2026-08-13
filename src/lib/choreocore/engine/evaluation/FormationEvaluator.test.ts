/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { evaluateFormations } from "./FormationEvaluator";
import { spearman } from "./EvaluationMetrics";
import { ratings } from "./syntheticDataset";

describe("FormationEvaluator", () => {
  it("TEST 11: Top-1 agreement is 1 when the human favorite is first", () => {
    const human = ratings("s", "c1", [
      ["WIDE_V", 95],
      ["PYRAMID", 80],
    ]);
    const m = evaluateFormations(
      [
        { formationType: "WIDE_V", score: 90 },
        { formationType: "PYRAMID", score: 70 },
      ],
      human
    );
    expect(m.top1Agreement).toBe(1);
  });

  it("TEST 12: Top-3 agreement is 1 when the favorite is in the top 3", () => {
    const human = ratings("s", "c1", [["CENTER_WINGS", 96], ["WIDE_V", 90], ["PYRAMID", 80]]);
    const m = evaluateFormations(
      [
        { formationType: "WIDE_V", score: 93 },
        { formationType: "PYRAMID", score: 91 },
        { formationType: "CENTER_WINGS", score: 88 },
      ],
      human
    );
    expect(m.top1Agreement).toBe(0);
    expect(m.top3Agreement).toBe(1);
  });

  it("TEST 13: rank correlation matches Spearman on a known ranking", () => {
    const human = ratings("s", "c1", [
      ["WIDE_V", 3],
      ["CENTER_WINGS", 2],
      ["PYRAMID", 1],
    ]);
    const m = evaluateFormations(
      [
        { formationType: "WIDE_V", score: 3 },
        { formationType: "PYRAMID", score: 2 },
        { formationType: "CENTER_WINGS", score: 1 },
      ],
      human
    );
    const expected = spearman([2, 1, 3], [1, 2, 3]);
    expect(m.rankCorrelation).toBeCloseTo(expected, 8);
  });

  it("TEST 41: Top-K ties break deterministically", () => {
    const human = ratings("s", "c1", [
      ["ARC", 90],
      ["DIAGONAL", 90],
    ]);
    const a = evaluateFormations(
      [
        { formationType: "ARC", score: 80 },
        { formationType: "DIAGONAL", score: 80 },
      ],
      human
    );
    const b = evaluateFormations(
      [
        { formationType: "DIAGONAL", score: 80 },
        { formationType: "ARC", score: 80 },
      ],
      human
    );
    expect(a.top1Agreement).toBe(b.top1Agreement);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

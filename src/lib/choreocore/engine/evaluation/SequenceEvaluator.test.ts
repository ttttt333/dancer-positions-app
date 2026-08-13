/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { evaluateTransitions } from "./TransitionEvaluator";
import { evaluateSequence } from "./SequenceEvaluator";
import { mae, rmse } from "./EvaluationMetrics";
import { ratings, sequence } from "./syntheticDataset";

describe("Transition and sequence evaluators", () => {
  it("TEST 14: transition MAE is correct", () => {
    const human = ratings("s", "c", [
      ["WIDE_V", 80],
      ["PYRAMID", 90],
    ]);
    human[0]!.transitionQuality = 80;
    human[1]!.transitionQuality = 90;
    const { metrics } = evaluateTransitions(
      [
        { transitionScore: 82, feasible: true },
        { transitionScore: 86, feasible: true },
      ],
      human
    );
    expect(metrics.mae).toBeCloseTo(mae([82, 86], [80, 90]), 8);
  });

  it("TEST 15: transition RMSE is correct", () => {
    const human = ratings("s", "c", [
      ["WIDE_V", 80],
      ["PYRAMID", 90],
    ]);
    human[0]!.transitionQuality = 80;
    human[1]!.transitionQuality = 90;
    const { metrics } = evaluateTransitions(
      [
        { transitionScore: 82, feasible: true },
        { transitionScore: 86, feasible: true },
      ],
      human
    );
    expect(metrics.rmse).toBeCloseTo(rmse([82, 86], [80, 90]), 8);
  });

  it("TEST 16: AI feasible + human unsafe is a critical error", () => {
    const human = ratings("s", "c", [["WIDE_V", 90]]);
    human[0]!.execution = 20;
    const { metrics, errors } = evaluateTransitions(
      [{ transitionScore: 88, feasible: true }],
      human
    );
    expect(metrics.unsafeRecommendationRate).toBeGreaterThan(0);
    expect(errors.some((e) => e.type === "UNSAFE_MOVEMENT")).toBe(true);
  });

  it("TEST 17: matching sequence scores correlate highly", () => {
    const m = evaluateSequence(
      { formationTypes: ["WIDE_V", "CLUSTER"], totalScore: 88 },
      [sequence("s", ["WIDE_V", "CLUSTER"], 88), sequence("s", ["WIDE_V", "CLUSTER"], 86)]
    );
    expect(m.correlation).toBeGreaterThan(0.9);
    expect(m.topSequenceAgreement).toBe(1);
  });
});

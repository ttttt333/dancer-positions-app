/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { analyzeDiscrepancy } from "./discrepancyAnalysis";
import { categoriesFromEditSignal } from "./discrepancyClassify";
import { discrepancyPatternFixture, discrepancySparseFixture } from "./discrepancyFixtures";
import { formatDiscrepancyReport } from "./discrepancyReport";
import { humanEvaluationPreferenceFixture } from "./humanEvaluationFixtures";
import { FORMATION_WEIGHTS_VERSION } from "./humanEvaluationConfig";

describe("discrepancyAnalysis", () => {
  it("A. High Score → Reject を検出する", () => {
    const report = analyzeDiscrepancy(discrepancyPatternFixture());
    expect(report.patterns.highScoreReject.count).toBeGreaterThan(0);
    expect(
      report.patterns.highScoreReject.count
    ).toBe(
      discrepancyPatternFixture().records.filter(
        (r) => r.decision === "reject" && r.aiScoreSnapshot.overall >= 88
      ).length
    );
  });

  it("B. Low Score → Accept を検出する", () => {
    const report = analyzeDiscrepancy(discrepancyPatternFixture());
    expect(report.patterns.lowScoreAccept.count).toBeGreaterThan(0);
    expect(report.patterns.lowScoreAccept.count).toBe(1);
  });

  it("C. Accept → Edit の種別を分類する", () => {
    const report = analyzeDiscrepancy(discrepancyPatternFixture());
    expect(report.overall.acceptEdit.count).toBeGreaterThan(0);
    expect(report.editRates.formation.count).toBeGreaterThan(0);
    expect(categoriesFromEditSignal({ formationChanged: true })).toEqual([
      "FORMATION_SELECTION",
    ]);
    expect(report.findings.some((f) => f.category === "FORMATION_SELECTION")).toBe(true);
  });

  it("D. Accept Unchanged を positive signal として検出する", () => {
    const report = analyzeDiscrepancy(discrepancyPatternFixture());
    expect(report.overall.acceptUnchanged.count).toBeGreaterThan(0);
    expect(report.patterns.acceptUnchanged.count).toBe(report.overall.acceptUnchanged.count);
    expect(report.positiveEvidence.highScoreAcceptUnchanged.count).toBeGreaterThan(0);
    expect(report.positiveEvidence.observed.some((line) => line.includes("positive"))).toBe(
      true
    );
  });

  it("E. Formation vs Transition のズレを分離する", () => {
    const report = analyzeDiscrepancy(discrepancyPatternFixture());
    const formation = report.findings.find((f) => f.category === "FORMATION_SELECTION");
    const path = report.findings.find((f) => f.category === "TRANSITION_PATH");
    const timing = report.findings.find((f) => f.category === "MUSIC_TIMING");
    expect(formation?.likelyLayer).toBe("formation");
    expect(path?.likelyLayer).toBe("transition");
    expect(timing?.likelyLayer).toBe("music_cue");
    expect(report.editRates.path.count).toBeGreaterThan(0);
    expect(report.editRates.timing.count).toBeGreaterThan(0);
    expect(report.byIntent.length).toBeGreaterThan(0);
    expect(report.byFormation.length).toBeGreaterThan(0);
  });

  it("F. 不足データは insufficient とする", () => {
    const report = analyzeDiscrepancy(discrepancySparseFixture());
    expect(report.confidence).toBe("insufficient");
    expect(report.findings.every((f) => f.confidence === "insufficient")).toBe(true);
    expect(report.notes.some((n) => n.includes("insufficient"))).toBe(true);
  });

  it("G. 評価時点の AI snapshot を使う", () => {
    const report = analyzeDiscrepancy(discrepancyPatternFixture());
    expect(report.weightsVersion).toBe(FORMATION_WEIGHTS_VERSION);
    expect(report.patterns.highScoreReject.count).toBe(1);
    expect(
      discrepancyPatternFixture().records.find((r) => r.subject.candidateId === "cand-high-rej")
        ?.aiScoreSnapshot.overall
    ).toBe(93);
  });

  it("H. 同一 dataset から同一 report が生成される", () => {
    const a = analyzeDiscrepancy(discrepancyPatternFixture());
    const b = analyzeDiscrepancy(discrepancyPatternFixture());
    expect(a).toEqual(b);
    expect(formatDiscrepancyReport(a)).toBe(formatDiscrepancyReport(b));
    const prefA = analyzeDiscrepancy(humanEvaluationPreferenceFixture());
    const prefB = analyzeDiscrepancy(humanEvaluationPreferenceFixture());
    expect(prefA).toEqual(prefB);
  });

  it("I. Report 生成後も production weights は不変", () => {
    const beforeFormation = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const beforeTransition = { ...TRANSITION_SCORE_WEIGHTS };
    const report = analyzeDiscrepancy(humanEvaluationPreferenceFixture());
    expect(report.autoApplied).toBe(false);
    expect(report.weightProposals.formation.autoApplied).toBe(false);
    expect(report.weightProposals.transition.autoApplied).toBe(false);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(beforeFormation);
    expect(TRANSITION_SCORE_WEIGHTS).toEqual(beforeTransition);
    expect(report.weightProposals.formation.proposed).not.toBe(FORMATION_INTELLIGENCE_WEIGHTS);
  });

  it("J. Pairwise で AI/Human ranking mismatch を検出する", () => {
    const report = analyzeDiscrepancy(humanEvaluationPreferenceFixture());
    expect(report.pairwiseMismatches.length).toBeGreaterThan(0);
    expect(report.pairwiseDisagreementRate).not.toBeNull();
    expect(report.pairwiseDisagreementRate ?? 0).toBeGreaterThan(0);
    expect(report.rankAgreement).not.toBeNull();
    const pair = report.pairwiseMismatches[0]!;
    expect(pair.human).not.toBe(pair.ai);
  });

  it("separates OBSERVED from HYPOTHESIS and includes versions", () => {
    const report = analyzeDiscrepancy(discrepancyPatternFixture());
    expect(report.analysisVersion).toContain("10.");
    expect(report.algorithmVersion).toContain("9.");
    expect(report.findings.every((f) => f.observed.length > 0 && f.hypothesis.length > 0)).toBe(
      true
    );
    const text = formatDiscrepancyReport(report);
    expect(text).toContain("OBSERVED:");
    expect(text).toContain("HYPOTHESIS:");
    expect(text).not.toMatch(/should decrease by exactly/);
  });
});

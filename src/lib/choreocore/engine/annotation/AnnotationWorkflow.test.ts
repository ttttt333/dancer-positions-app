/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { createAnnotationSession, sessionIsBlind } from "./AnnotationSession";
import { validateAnnotationSession } from "./AnnotationValidator";
import { annotatorStats, calculateAnnotationQuality } from "./AnnotationQuality";
import { calculateInterRaterAgreement, generateConsensus, generateConsensusReviewItems } from "./ConsensusEngine";
import { clusterCues, consensusCue, cueAgreementPair } from "./CueConsensus";
import { clusterSections, consensusSection } from "./SectionConsensus";
import { formationRankVotes, formationTop3Overlap, top3FromSession } from "./FormationConsensus";
import { consensusSequence, geometrySignature, geometrySimilarity } from "./SequenceConsensus";
import { generateGroundTruthSet, groundTruthToSongGroundTruth, sessionToRealAnnotations } from "./GroundTruthBuilder";
import { runCalibration } from "./Calibration";
import { exportAnnotationJson, exportGroundTruthJson, importAnnotationJson } from "./AnnotationIO";
import { makeSession, threeAnnotators } from "./annotationFixtures";
import { ANNOTATION_INSTRUCTIONS } from "./AnnotationInstructions";
import { ANNOTATION_WORKFLOW_VERSION } from "../types/AnnotationTypes";
import { realWorldPilotDataset } from "../realworld/pilotDataset";
import { calculateHumanCeiling } from "../realworld/HumanCeiling";

describe("Phase 9 Annotation Workflow", () => {
  it("Valid session", () => {
    const s = makeSession({ songId: "s", annotatorId: "a" });
    expect(validateAnnotationSession(s).ok).toBe(true);
  });

  it("Invalid session", () => {
    const s = createAnnotationSession({ songId: "", annotatorId: "", duration: 0, id: "", now: new Date("2026-08-14T00:00:00.000Z") });
    expect(validateAnnotationSession(s).ok).toBe(false);
  });

  it("Cue consensus", () => {
    const sessions = threeAnnotators();
    const clusters = clusterCues(sessions);
    expect(clusters.length).toBe(1);
    expect(consensusCue(clusters[0]!).annotatorId).toBe("consensus");
  });

  it("Cue timing disagreement", () => {
    const sessions = [
      makeSession({ songId: "s", annotatorId: "a", cueTime: 16 }),
      makeSession({ songId: "s", annotatorId: "b", cueTime: 20 }),
    ];
    expect(generateConsensusReviewItems(sessions).some((r) => r.type === "CUE" && r.severity === "HIGH")).toBe(true);
  });

  it("Cue action disagreement", () => {
    const sessions = [
      makeSession({ songId: "s", annotatorId: "a", action: "EXPAND" }),
      makeSession({ songId: "s", annotatorId: "b", action: "CONTRACT" }),
    ];
    expect(generateConsensusReviewItems(sessions).some((r) => r.reasons.includes("cue action disagreement"))).toBe(true);
  });

  it("Section consensus", () => {
    const sessions = threeAnnotators();
    const clusters = clusterSections(sessions);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    expect(consensusSection(clusters[0]!).type).toBe("INTRO");
  });

  it("Section type disagreement", () => {
    const a = makeSession({ songId: "s", annotatorId: "a", sectionType: "CHORUS" });
    const b = makeSession({ songId: "s", annotatorId: "b", sectionType: "DROP" });
    expect(generateConsensusReviewItems([a, b]).some((r) => r.type === "SECTION")).toBe(true);
  });

  it("Formation ranking", () => {
    const votes = formationRankVotes(threeAnnotators());
    expect(votes[0]?.formationType).toBe("WIDE_V");
    expect(votes.find((v) => v.formationType === "PYRAMID")?.points).toBeGreaterThan(0);
  });

  it("Formation top3 overlap", () => {
    const [a, b] = threeAnnotators();
    expect(formationTop3Overlap(top3FromSession(a!), top3FromSession(b!))).toBeGreaterThanOrEqual(1);
  });

  it("Sequence consensus", () => {
    const seq = consensusSequence(threeAnnotators());
    expect(seq[0]?.annotatorId).toBe("consensus");
    expect(seq[0]?.overall).toBeGreaterThan(80);
  });

  it("Low disagreement", () => {
    const reviews = generateConsensusReviewItems(threeAnnotators()).filter((r) => r.severity === "HIGH");
    expect(reviews.filter((r) => r.type === "CUE" && r.reasons.includes("time diff > 2 beats")).length).toBe(0);
  });

  it("High disagreement", () => {
    const sessions = [
      makeSession({ songId: "s", annotatorId: "a", cueTime: 8, overall: 90 }),
      makeSession({ songId: "s", annotatorId: "b", cueTime: 24, overall: 50 }),
    ];
    const high = generateConsensusReviewItems(sessions).filter((r) => r.severity === "HIGH");
    expect(high.length).toBeGreaterThan(0);
  });

  it("Review required", () => {
    const sessions = [
      makeSession({ songId: "s", annotatorId: "a", cueTime: 8 }),
      makeSession({ songId: "s", annotatorId: "b", cueTime: 24 }),
    ];
    expect(generateConsensus(sessions).reviews.some((r) => r.severity === "HIGH")).toBe(true);
  });

  it("Auto consensus", () => {
    const gt = generateGroundTruthSet(threeAnnotators());
    expect(gt.consensusMethod).toBe("AUTO");
  });

  it("Reviewed consensus", () => {
    const gt = generateGroundTruthSet(threeAnnotators(), { reviewedBy: "lead" });
    expect(gt.consensusMethod).toBe("REVIEWED");
    expect(gt.reviewedBy).toBe("lead");
  });

  it("Ground truth confidence", () => {
    const gt = generateGroundTruthSet(threeAnnotators());
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(gt.confidenceBand);
  });

  it("Low confidence", () => {
    const sessions = [
      makeSession({ songId: "s", annotatorId: "a", cueTime: 8, overall: 95, formations: [["GRID", 90], ["CLUSTER", 20], ["ARC", 10]] }),
      makeSession({ songId: "s", annotatorId: "b", cueTime: 24, overall: 40, formations: [["LINE", 90], ["V", 20], ["TRIANGLE", 10]] }),
    ];
    const gt = generateGroundTruthSet(sessions);
    expect(gt.groundTruthUncertainty).toBe(true);
    expect(gt.confidenceBand).toBe("LOW");
  });

  it("Calibration", () => {
    const sessions = [
      ...threeAnnotators("cal-1").map((s) => ({ ...s, songId: "cal-1" })),
      ...threeAnnotators("cal-2").map((s) => ({ ...s, songId: "cal-2", id: `${s.id}-2` })),
    ];
    const cal = runCalibration(sessions);
    expect(cal.songIds.length).toBe(2);
    expect(cal.passed).toBe(true);
  });

  it("Calibration fail", () => {
    const sessions = [
      makeSession({ songId: "c1", annotatorId: "a", cueTime: 8, overall: 95 }),
      makeSession({ songId: "c1", annotatorId: "b", cueTime: 24, overall: 40 }),
      makeSession({ songId: "c2", annotatorId: "a", cueTime: 8, overall: 95 }),
      makeSession({ songId: "c2", annotatorId: "b", cueTime: 24, overall: 40 }),
    ];
    const cal = runCalibration(sessions);
    expect(cal.passed).toBe(false);
    expect(cal.reason).toContain("rules");
  });

  it("Annotator QA", () => {
    const stats = annotatorStats(threeAnnotators());
    expect(stats).toHaveLength(3);
    expect(stats.every((s) => s.cueCount >= 1)).toBe(true);
  });

  it("Contradictory cues", () => {
    const s = makeSession({ songId: "s", annotatorId: "a", extraCue: { time: 17, action: "HOLD" } });
    const q = calculateAnnotationQuality(s);
    expect(q.contradictionCount).toBeGreaterThan(0);
  });

  it("Invalid time", () => {
    const s = makeSession({ songId: "s", annotatorId: "a" });
    s.cues[0]!.time = -1;
    expect(validateAnnotationSession(s).ok).toBe(false);
  });

  it("Out of range", () => {
    const s = makeSession({ songId: "s", annotatorId: "a", duration: 32 });
    s.cues[0]!.time = 99;
    expect(validateAnnotationSession(s).warnings.some((w) => w.message === "cue after song end")).toBe(true);
  });

  it("Duplicate cue", () => {
    const s = makeSession({ songId: "s", annotatorId: "a" });
    s.cues.push({ ...s.cues[0]! });
    expect(validateAnnotationSession(s).warnings.some((w) => w.message === "duplicate cue")).toBe(true);
  });

  it("AI blind mode", () => {
    const s = createAnnotationSession({ songId: "s", annotatorId: "a", duration: 32, now: new Date("2026-08-14T00:00:00.000Z") });
    expect(s.mode).toBe("BLIND");
    expect(sessionIsBlind(s)).toBe(true);
  });

  it("AI assisted mode", () => {
    const s = createAnnotationSession({
      songId: "s",
      annotatorId: "a",
      duration: 32,
      mode: "AI_ASSISTED",
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
    expect(s.mode).toBe("AI_ASSISTED");
  });

  it("AI output isolation", () => {
    const blind = makeSession({ songId: "s", annotatorId: "a", mode: "BLIND" });
    const assisted = makeSession({ songId: "s", annotatorId: "b", mode: "AI_ASSISTED", cueTime: 24 });
    const gt = generateGroundTruthSet([blind, assisted]);
    expect(gt.cues.every((c) => Math.abs(c.time - 16) < 1)).toBe(true);
    expect(gt.annotatorCount).toBe(1);
  });

  it("Annotation version", () => {
    expect(makeSession({ songId: "s", annotatorId: "a" }).version).toBe(ANNOTATION_WORKFLOW_VERSION);
    expect(ANNOTATION_WORKFLOW_VERSION).toBe("2.0.0");
  });

  it("Determinism", () => {
    const sessions = threeAnnotators();
    const a = generateGroundTruthSet(sessions);
    const b = generateGroundTruthSet(sessions);
    expect(JSON.stringify(a.cues)).toBe(JSON.stringify(b.cues));
    expect(JSON.stringify(a.formations)).toBe(JSON.stringify(b.formations));
  });

  it("Cue weighted voting", () => {
    const sessions = [
      makeSession({ songId: "s", annotatorId: "a", action: "EXPAND" }),
      makeSession({ songId: "s", annotatorId: "b", action: "EXPAND" }),
      makeSession({ songId: "s", annotatorId: "c", action: "CONTRACT" }),
    ];
    expect(consensusCue(clusterCues(sessions)[0]!).action).toBe("EXPAND");
  });

  it("Formation weighted voting", () => {
    expect(formationRankVotes(threeAnnotators())[0]?.formationType).toBe("WIDE_V");
  });

  it("Section voting", () => {
    const sessions = [
      makeSession({ songId: "s", annotatorId: "a", sectionType: "CHORUS" }),
      makeSession({ songId: "s", annotatorId: "b", sectionType: "CHORUS" }),
      makeSession({ songId: "s", annotatorId: "c", sectionType: "DROP" }),
    ];
    const chorus = clusterSections(sessions).find((c) => c.startTime > 1);
    expect(consensusSection(chorus!).type).toBe("CHORUS");
  });

  it("Sequence voting", () => {
    expect(geometrySignature(["PYRAMID", "WIDE_V"])).toBe("PYRAMID|WIDE_V");
    expect(geometrySimilarity(["WIDE_V", "PYRAMID"], ["WIDE_V", "ARC"])).toBeGreaterThan(0);
    expect(consensusSequence(threeAnnotators())[0]?.formationIds).toContain("WIDE_V");
  });

  it("Human ceiling", () => {
    const anns = threeAnnotators().map(sessionToRealAnnotations);
    const ceiling = calculateHumanCeiling(anns, 120, 1);
    expect(ceiling.pairs).toBeGreaterThan(0);
    expect(ceiling.overall).toBeGreaterThan(0.5);
  });

  it("Agreement metric", () => {
    const agr = calculateInterRaterAgreement(threeAnnotators());
    expect(agr.pairs).toBe(3);
    expect(agr.overall).toBeGreaterThan(0.5);
    expect(agr.cue.timeAgreement).toBeGreaterThan(0.5);
  });

  it("Completion rate", () => {
    expect(calculateAnnotationQuality(makeSession({ songId: "s", annotatorId: "a" })).completionRate).toBe(1);
    const empty = createAnnotationSession({ songId: "s", annotatorId: "a", duration: 32, now: new Date("2026-08-14T00:00:00.000Z") });
    expect(calculateAnnotationQuality(empty).completionRate).toBe(0);
  });

  it("Quality score", () => {
    const q = calculateAnnotationQuality(makeSession({ songId: "s", annotatorId: "a" }));
    expect(q.qualityScore).toBeGreaterThan(70);
  });

  it("Quality PASS", () => {
    expect(calculateAnnotationQuality(makeSession({ songId: "s", annotatorId: "a" })).status).toBe("PASS");
  });

  it("Quality REVIEW", () => {
    const s = makeSession({ songId: "s", annotatorId: "a" });
    s.cues.push({ ...s.cues[0]! });
    expect(calculateAnnotationQuality(s).status).toBe("REVIEW");
  });

  it("Quality FAIL", () => {
    const s = makeSession({ songId: "s", annotatorId: "a" });
    s.cues[0]!.time = -2;
    expect(calculateAnnotationQuality(s).status).toBe("FAIL");
  });

  it("Consensus confidence", () => {
    const gt = generateGroundTruthSet(threeAnnotators());
    expect(gt.confidence).toBeGreaterThan(0);
    expect(gt.confidence).toBeLessThanOrEqual(1);
  });

  it("Final ground truth", () => {
    const gt = generateGroundTruthSet(threeAnnotators());
    const song = groundTruthToSongGroundTruth(gt);
    expect(song.cues.length).toBeGreaterThan(0);
    expect(song.annotationVersion).toBe(ANNOTATION_WORKFLOW_VERSION);
  });

  it("JSON export", () => {
    const json = exportAnnotationJson(makeSession({ songId: "s", annotatorId: "a" }));
    expect(json).toContain("\"songId\": \"s\"");
    expect(exportGroundTruthJson(generateGroundTruthSet(threeAnnotators()))).toContain("consensusMethod");
  });

  it("JSON import", () => {
    const src = makeSession({ songId: "s", annotatorId: "a" });
    const parsed = importAnnotationJson(exportAnnotationJson(src));
    expect(parsed.songId).toBe("s");
    expect(parsed.cues).toHaveLength(1);
  });

  it("10-song pilot", () => {
    const { annotations } = realWorldPilotDataset();
    const songs = [...new Set(annotations.map((a) => a.songId))];
    expect(songs.length).toBe(10);
  });

  it("Annotator count", () => {
    expect(generateGroundTruthSet(threeAnnotators()).annotatorCount).toBe(3);
  });

  it("2 annotators", () => {
    const agr = calculateInterRaterAgreement(threeAnnotators().slice(0, 2));
    expect(agr.pairs).toBe(1);
  });

  it("3 annotators", () => {
    expect(calculateInterRaterAgreement(threeAnnotators()).pairs).toBe(3);
  });

  it("Disagreement report", () => {
    const sessions = [
      makeSession({ songId: "s", annotatorId: "a", cueTime: 8 }),
      makeSession({ songId: "s", annotatorId: "b", cueTime: 24 }),
    ];
    const report = generateConsensusReviewItems(sessions);
    expect(report.some((r) => r.type === "CUE")).toBe(true);
    expect(report[0]?.annotators).toContain("a");
  });

  it("Full workflow", () => {
    const sessions = threeAnnotators();
    expect(sessions.every((s) => validateAnnotationSession(s).ok)).toBe(true);
    expect(sessions.every((s) => calculateAnnotationQuality(s).status === "PASS")).toBe(true);
    const consensus = generateConsensus(sessions);
    const gt = generateGroundTruthSet(sessions);
    expect(consensus.agreement.overall).toBeGreaterThan(0.5);
    expect(gt.cues.length).toBeGreaterThan(0);
    expect(ANNOTATION_INSTRUCTIONS).toContain("Human First");
    expect(cueAgreementPair(sessions[0]!.cues, sessions[1]!.cues, 120, { matchingBeats: 1, disagreementBeats: 2, sequenceOverallDiff: 20, contradictionWindowSec: 5 }).timeAgreement).toBeGreaterThan(0.5);
    const songGt = groundTruthToSongGroundTruth(gt);
    expect(songGt.cues.length).toBeGreaterThan(0);
    expect(songGt.annotationVersion).toBe("2.0.0");
  });
});

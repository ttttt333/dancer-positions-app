import { describe, expect, it } from "vitest";
import {
  signedPhaseResidualSec,
  classifyHalfBeatBin,
  classifyAnalyzerRelation,
  summarizePhaseOffset,
} from "./phaseReferenceAudit";
import {
  validatePhaseAnchorMark,
  validatePhaseAnchorAnnotation,
  FLY_PHASE_ANCHOR_ANNOTATION_VERSION,
  PHASE_ANCHOR_PILOT_SONG_IDS,
} from "./phaseAnchor";
import {
  assertNoCopyrightedAudioPaths,
  buildConsensus,
  computeHumanAgreement,
  detectWeaknesses,
  planActiveExpansion,
  runRealSongBenchmarkPipeline,
  validateAnnotation,
  validateManifest,
  validateMusicalChange,
  annotationToFlyGroundTruth,
  hypothesisFileToFly,
  PHASE46_FREEZE,
  deriveBeatPattern,
  deriveTimingPattern,
  auditBeatPattern,
  beatIntervalVsBpmError,
  scoreTimingPattern,
  classifyBeatPattern,
} from "./index";
import {
  loadStageAManifest,
  stageACoverageSummary,
} from "../../../../fixtures/fly/real-song/manifest";
import {
  pilotAnnotatorA,
  pilotAnnotatorB,
  PILOT_SONG_ID,
} from "../../../../fixtures/fly/real-song/examples/pilotAnnotations";
import type { RealSongManifest } from "./types";
import { FLY_ANNOTATION_CONTRACT_VERSION, FLY_REAL_SONG_DATASET_VERSION, FLY_REAL_SONG_PROVENANCE_VERSION } from "./versions";

describe("Phase 4.6 real-song Stage A", () => {
  it("registers 20 songs with difficulty matrix coverage", () => {
    const m = loadStageAManifest();
    expect(m.length).toBe(20);
    const cov = stageACoverageSummary(m);
    expect(cov.genres.length).toBeGreaterThanOrEqual(8);
    expect(cov.tempos).toEqual(["FAST", "MEDIUM", "SLOW"]);
    expect(cov.densities.sort()).toEqual(["HIGH", "LOW", "MEDIUM"]);
    expect(cov.complexities.sort()).toEqual(["COMPLEX", "MEDIUM", "SIMPLE"]);
    expect(cov.doubleAnnotateSongIds.length).toBeGreaterThanOrEqual(3);
    expect(cov.splits.DEVELOPMENT).toBe(12);
    expect(cov.splits.VALIDATION).toBe(4);
    expect(cov.splits.HOLDOUT).toBe(4);
  });

  it("validates every Stage A manifest", () => {
    for (const song of loadStageAManifest()) {
      expect(validateManifest(song), song.songId).toEqual([]);
      expect(song.status).toBe("UNANNOTATED");
    }
  });

  it("freeze list is present", () => {
    expect(PHASE46_FREEZE).toContain("no_madmom");
    expect(PHASE46_FREEZE).toContain("no_fusion_weight_change");
    expect(PHASE46_FREEZE).toContain("no_musical_change_to_formation_change");
  });
});

describe("Phase 4.6 validation", () => {
  it("accepts PENDING and rejects bad hash", () => {
    const base: RealSongManifest = {
      ...loadStageAManifest()[0]!,
      audioSha256: "PENDING_SONG_001",
    };
    expect(validateManifest(base)).toEqual([]);
    expect(
      validateManifest({ ...base, audioSha256: "not-a-hash" }).length
    ).toBeGreaterThan(0);
  });

  it("validates annotation / musical_change / forbids formation_change", () => {
    expect(validateAnnotation(pilotAnnotatorA)).toEqual([]);
    expect(
      validateMusicalChange(pilotAnnotatorA.musicalChanges![0]!)
    ).toEqual([]);
    const bad = {
      ...pilotAnnotatorA,
      formation_change: true,
    } as typeof pilotAnnotatorA & { formation_change: boolean };
    expect(validateAnnotation(bad).some((e) => e.includes("formation"))).toBe(
      true
    );
  });

  it("flags copyrighted audio paths", () => {
    expect(
      assertNoCopyrightedAudioPaths([
        "fixtures/fly/real-song/audio/README.md",
        "fixtures/fly/real-song/audio/song-001.mp3",
      ])
    ).toEqual(["fixtures/fly/real-song/audio/song-001.mp3"]);
  });
});

describe("Phase 4.6 agreement + consensus", () => {
  it("measures human disagreement without treating it as analyzer error", () => {
    const agr = computeHumanAgreement(pilotAnnotatorA, pilotAnnotatorB);
    expect(agr.songId).toBe(PILOT_SONG_ID);
    expect(agr.sectionBoundaryMedianMs).not.toBeNull();
    expect(agr.sectionLabelAgreement).toBeGreaterThan(0.9);
    expect(agr.beatAgreementF1At40ms).toBeGreaterThan(0.9);
  });

  it("builds consensus while noting raw retention", () => {
    const { consensus, notes } = buildConsensus([
      pilotAnnotatorA,
      pilotAnnotatorB,
    ]);
    expect(consensus.annotatorId).toBe("consensus");
    expect(notes.some((n) => n.includes("raw_annotations_retained"))).toBe(
      true
    );
    expect(consensus.bpm).toBe(120);
  });
});

describe("Phase 4.6 bridge + pipeline", () => {
  it("bridges annotation to 4.5 GT and runs benchmark with hypotheses", () => {
    const manifest: RealSongManifest = {
      songId: PILOT_SONG_ID,
      audioSha256: pilotAnnotatorA.audioSha256,
      sourceType: "USER_OWNED",
      durationSec: 32,
      conditions: {
        genre: ["pilot"],
        tempoClass: "MEDIUM",
        beatDensity: "MEDIUM",
        structureComplexity: "SIMPLE",
        vocal: "VOCAL",
        version: "ORIGINAL",
      },
      annotationVersion: FLY_ANNOTATION_CONTRACT_VERSION,
      annotators: ["annotator-a", "annotator-b"],
      status: "ANNOTATED",
      datasetSplit: "DEVELOPMENT",
      realSongDatasetVersion: FLY_REAL_SONG_DATASET_VERSION,
      provenanceVersion: FLY_REAL_SONG_PROVENANCE_VERSION,
      selectionIntent: "schema pilot",
      doubleAnnotate: true,
    };
    const gt = annotationToFlyGroundTruth(manifest, pilotAnnotatorA);
    const hypLib = hypothesisFileToFly({
      songId: PILOT_SONG_ID,
      audioSha256: pilotAnnotatorA.audioSha256,
      analyzerId: "librosa",
      analyzerVersion: "pilot-librosa",
      producedAt: "2026-09-09T00:00:00.000Z",
      bpm: 120,
      beats: pilotAnnotatorA.beats.map((t) => t + 0.01),
      sections: pilotAnnotatorA.sections,
    });
    const hypEss = hypothesisFileToFly({
      songId: PILOT_SONG_ID,
      audioSha256: pilotAnnotatorA.audioSha256,
      analyzerId: "essentia",
      analyzerVersion: "pilot-essentia",
      producedAt: "2026-09-09T00:00:00.000Z",
      bpm: 60, // half-time class
      beats: pilotAnnotatorA.beats.filter((_, i) => i % 2 === 0),
      sections: [
        { startSec: 0, endSec: 8, label: "INTRO", confidence: 0.8 },
        { startSec: 8, endSec: 32, label: "VERSE", confidence: 0.5 }, // weak section
      ],
    });

    const bundle = runRealSongBenchmarkPipeline([
      { groundTruth: gt, hypotheses: [hypLib, hypEss] },
    ]);
    expect(bundle.meta.lowSampleSize).toBe(true);
    expect(bundle.reports.benchmarkMarkdown).toContain("LOW SAMPLE SIZE");
    expect(bundle.weaknesses.length).toBeGreaterThan(0);
    const expansion = planActiveExpansion(bundle.weaknesses);
    expect(expansion.suggestedSongCount).toBe(10);
    expect(expansion.lowSampleSizeWarning).toBe(true);
  });

  it("weakness detection marks low scores as WEAK", () => {
    const findings = detectWeaknesses([
      {
        analyzerId: "librosa",
        analyzerVersion: "v",
        signalType: "section",
        condition: "complexity:complex",
        metric: "labelF1",
        score: 0.48,
        sampleCount: 5,
        evidenceConfidence: "LOW",
        status: "OK",
      },
    ]);
    expect(findings[0]!.severity).toBe("WEAK");
    const plan = planActiveExpansion(findings);
    expect(plan.targetConditions[0]).toContain("SECTION@complexity:complex");
  });
});

describe("Phase 4.6 Beat Pattern GT", () => {
  it("derives representative pattern from seed beats (song-009 style)", () => {
    // ~90.58 BPM → interval ≈ 0.6626s; seed ~13.2–26.0
    const interval = 60 / 90.58;
    const beats = Array.from({ length: 20 }, (_, i) => 13.221 + i * interval);
    const pattern = deriveBeatPattern(
      {
        ...pilotAnnotatorA,
        bpm: 90.58,
        beats,
        downbeats: [13.221, 13.221 + 4 * interval, 13.221 + 8 * interval],
      },
      191.352
    );
    expect(pattern).not.toBeNull();
    expect(pattern!.seedCount).toBe(20);
    expect(pattern!.continuation).toBe(true);
    expect(pattern!.continuationUntilSec).toBe(191.352);
    expect(beatIntervalVsBpmError(pattern!)!).toBeLessThan(0.02);
    expect(auditBeatPattern(pattern!).status).toBe("PASS");
  });

  it("does not FAIL audit merely because seed ≪ full-song beat count", () => {
    const interval = 0.5;
    const beats = Array.from({ length: 16 }, (_, i) => 10 + i * interval);
    const pattern = deriveBeatPattern(
      { ...pilotAnnotatorA, bpm: 120, beats, downbeats: [10, 12, 14, 16] },
      200
    );
    expect(auditBeatPattern(pattern!).status).toBe("PASS");
    // 16 seeds vs ~400 expected full-song beats — still PASS under pattern semantics
    expect(pattern!.seedCount).toBeLessThan(50);
  });
});

describe("Phase 4.6 Beat Pattern scoring (no pointwise F1)", () => {
  it("PASSes period/phase when hyp grid locks to GT seed", () => {
    const interval = 0.5;
    const seeds = Array.from({ length: 16 }, (_, i) => 2 + i * interval);
    const gt = deriveTimingPattern("beat", seeds, {
      bpm: 120,
      durationSec: 60,
    })!;
    const hyp = Array.from({ length: 100 }, (_, i) => 2 + i * interval);
    const score = scoreTimingPattern("beat", gt, hyp);
    expect(score.period.verdict).toBe("PASS");
    expect(score.phase.verdict).toBe("PASS");
    expect(score.continuity.verdict).toBe("PASS");
    // denser hyp must not be required for PASS
    expect(score.evidence.gtSeedCount).toBe(16);
    expect(score.evidence.hypCountInWindow).toBeGreaterThan(16);
  });

  it("detects ~half-beat phase error (song-013 style) without dual-phase PASS", () => {
    const bpm = 122.5;
    const interval = 60 / bpm;
    const phaseShift = 0.207;
    const seeds = Array.from({ length: 24 }, (_, i) => 1.0 + i * interval);
    const gt = deriveTimingPattern("beat", seeds, {
      bpm,
      durationSec: 120,
    })!;
    const hyp = Array.from(
      { length: 250 },
      (_, i) => 1.0 + phaseShift + i * interval
    );
    const score = scoreTimingPattern("beat", gt, hyp);
    expect(score.period.verdict).toBe("PASS");
    expect(score.phase.verdict).toBe("FAIL");
    expect(score.continuity.verdict).toBe("PASS"); // constant offset ≠ drift
    expect(score.phase.halfBeatRatio!).toBeGreaterThan(0.35);
    const finding = classifyBeatPattern({
      songId: "song-013",
      title: "One More Time",
      analyzerId: "librosa",
      score,
      gtLockedPhasePolicy: true,
    });
    expect(finding.findingClass).not.toBe("GT-AMBIGUITY");
    expect(["WEAK", "ANALYZER-LIMIT"]).toContain(finding.findingClass);
  });

  it("does not treat seed density difference as accuracy failure", () => {
    const interval = 0.545;
    const seeds = Array.from({ length: 20 }, (_, i) => 3 + i * interval);
    const gt = deriveTimingPattern("beat", seeds, {
      bpm: 110,
      durationSec: 180,
    })!;
    const hypSparse = Array.from({ length: 40 }, (_, i) => 3 + i * interval);
    const hypDense = Array.from({ length: 300 }, (_, i) => 3 + i * interval);
    const a = scoreTimingPattern("beat", gt, hypSparse);
    const b = scoreTimingPattern("beat", gt, hypDense);
    expect(a.period.verdict).toBe(b.period.verdict);
    expect(a.phase.verdict).toBe(b.phase.verdict);
  });
});

describe("Phase 4.6-C Phase Reference helpers", () => {
  it("folds signed residuals into (-IOI/2, IOI/2]", () => {
    const i = 0.5;
    expect(signedPhaseResidualSec(0.1, 0, i)).toBeCloseTo(0.1, 5);
    expect(signedPhaseResidualSec(0.4, 0, i)).toBeCloseTo(-0.1, 5); // 0.4 → -0.1
    expect(signedPhaseResidualSec(0.25, 0, i)).toBeCloseTo(0.25, 5);
    expect(classifyHalfBeatBin(0.25, i)).toBe("NEAR_PLUS_HALF");
    expect(classifyHalfBeatBin(-0.24, i)).toBe("NEAR_MINUS_HALF");
    expect(classifyHalfBeatBin(0.02, i)).toBe("NEAR_0");
  });

  it("uses median |residual| not abs(signed-median)", () => {
    // oscillating signs → signed median ~0 but abs median large
    const times = [0.2, 0.7, 1.2, 1.7, 2.2, 2.7]; // +0.2 then alternating around 0.5 grid from 0
    // Better: construct explicit residuals via times off GT phase0=0, IOI=1
    const hyp = [0.4, 1.4, 2.4, 3.6, 4.6, 5.6]; // mostly +0.4, one -0.4-ish at 3.6→-0.4
    const s = summarizePhaseOffset(hyp, 0, 1);
    expect(s.medianAbsSec!).toBeGreaterThan(0.3);
  });

  it("marks BOTH_OFF_AGREE when analyzers match but miss GT", () => {
    expect(
      classifyAnalyzerRelation({
        librosaAbsSec: 0.16,
        madmomAbsSec: 0.14,
        analyzerAgreeSec: 0.03,
      })
    ).toBe("BOTH_OFF_AGREE");
  });
});

describe("Phase 4.6-E Phase Anchor contract", () => {
  it("requires rationale and rejects empty marks", () => {
    const bad = validatePhaseAnchorMark({
      anchorTimeSec: 1,
      anchorType: "HIT",
      confidence: 0.5,
      rationale: "",
    });
    expect(bad.ok).toBe(false);
    const good = validatePhaseAnchorAnnotation({
      songId: "song-013",
      annotatorId: "annotator-a",
      annotationVersion: FLY_PHASE_ANCHOR_ANNOTATION_VERSION,
      audioSha256: "abc",
      primaryOrigin: {
        anchorTimeSec: 0.287,
        anchorType: "ANTICIPATION",
        confidence: 0.7,
        rationale: "body prep before the drop hit",
        role: "ORIGIN",
      },
      anchors: [],
      annotatedAt: "2026-09-13T00:00:00.000Z",
      consultedMusicBeatUi: false,
    });
    expect(good.ok).toBe(true);
  });

  it("locks pilot song ids to the five audit representatives", () => {
    expect([...PHASE_ANCHOR_PILOT_SONG_IDS]).toEqual([
      "song-013",
      "song-020",
      "song-009",
      "song-005",
      "song-002",
    ]);
  });
});

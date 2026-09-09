import { describe, expect, it } from "vitest";
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

describe("Phase 4.6 production isolation", () => {
  it("does not export realSong from fly public index", async () => {
    const pub = await import("../index");
    expect("runRealSongBenchmarkPipeline" in pub).toBe(false);
    expect("PHASE46_FREEZE" in pub).toBe(false);
  });
});

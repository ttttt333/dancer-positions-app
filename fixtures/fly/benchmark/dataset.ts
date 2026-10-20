/**
 * Golden FLY Benchmark fixtures (dataset_version 1.0.0)
 * Ground truth is human-authored. Hypotheses are offline stand-ins — NOT GT.
 */

import type { FlyBenchmarkDatasetEntry } from "../../../src/lib/fly/benchmark";
import {
  FLY_DATASET_VERSION,
  FLY_GROUND_TRUTH_VERSION,
} from "../../../src/lib/fly/benchmark/versions";
import type {
  FlyBenchmarkHypothesis,
  FlyGroundTruthSong,
} from "../../../src/lib/fly/benchmark/types";

function beats(bpm: number, duration: number, phase = 0): number[] {
  const step = 60 / bpm;
  const out: number[] = [];
  for (let t = phase; t < duration - 1e-9; t += step) {
    out.push(Math.round(t * 1000) / 1000);
  }
  return out;
}

function shift(times: number[], ms: number): number[] {
  return times.map((t) => Math.round((t + ms / 1000) * 1000) / 1000);
}

function eights(bpm: number, duration: number): FlyGroundTruthSong["eightCounts"] {
  const step = (60 / bpm) * 8;
  const out: NonNullable<FlyGroundTruthSong["eightCounts"]> = [];
  let i = 0;
  for (let t = 0; t + step <= duration + 1e-9; t += step) {
    out.push({
      startTime: Math.round(t * 1000) / 1000,
      endTime: Math.round((t + step) * 1000) / 1000,
      countIndex: i,
      phraseIndex: Math.floor(i / 2),
      confidence: 0.95,
      annotatorId: "annotator-a",
    });
    i++;
  }
  return out;
}

function downbeats(bpm: number, duration: number): FlyGroundTruthSong["downbeats"] {
  const step = (60 / bpm) * 4;
  const out: NonNullable<FlyGroundTruthSong["downbeats"]> = [];
  let bar = 0;
  for (let t = 0; t < duration - 1e-9; t += step) {
    out.push({
      downbeatTime: Math.round(t * 1000) / 1000,
      barIndex: bar++,
      confidence: 0.9,
      annotatorId: "annotator-a",
    });
  }
  return out;
}

function gtBeats(
  bpm: number,
  duration: number,
  annotatorId = "annotator-a"
): FlyGroundTruthSong["beats"] {
  return beats(bpm, duration).map((beatTime, beatIndex) => ({
    beatTime,
    beatIndex,
    confidence: 0.95,
    annotatorId,
  }));
}

function baseSong(
  partial: Omit<FlyGroundTruthSong, "datasetVersion" | "groundTruthVersion"> &
    Partial<Pick<FlyGroundTruthSong, "datasetVersion" | "groundTruthVersion">>
): FlyGroundTruthSong {
  return {
    datasetVersion: FLY_DATASET_VERSION,
    groundTruthVersion: FLY_GROUND_TRUTH_VERSION,
    ...partial,
  };
}

function makeHyp(
  analyzerId: string,
  analyzerVersion: string,
  bpm: number,
  beatShiftMs: number,
  duration: number,
  sections: FlyBenchmarkHypothesis["sections"],
  extras?: Partial<FlyBenchmarkHypothesis>
): FlyBenchmarkHypothesis {
  const b = shift(beats(bpm, duration), beatShiftMs);
  const db = shift(
    beats(bpm, duration).filter((_, i) => i % 4 === 0),
    beatShiftMs
  );
  return {
    analyzerId,
    analyzerVersion,
    bpm,
    beats: b,
    downbeats: db,
    onsets: b,
    sections,
    eightCounts: eights(bpm, duration)?.map((e) => ({
      startTime: e.startTime + beatShiftMs / 1000,
      endTime: e.endTime + beatShiftMs / 1000,
      countIndex: e.countIndex,
      phraseIndex: e.phraseIndex,
    })),
    ...extras,
  };
}

const simplePopGt = baseSong({
  songId: "gt-simple-pop",
  audioHash: "hash-simple-pop-v1",
  durationSeconds: 32,
  genre: "pop",
  tempoCategory: "medium",
  conditions: {
    genre: "pop",
    tempoCategory: "medium",
    structuralComplexity: "simple",
    vocalPresence: "vocal-heavy",
    energy: "medium",
    beatDensity: "normal",
    durationBucket: "short",
  },
  bpm: 120,
  title: "Simple Pop (synthetic GT)",
  annotators: ["annotator-a"],
  sections: [
    {
      startTime: 0,
      endTime: 8,
      label: "INTRO",
      confidence: 0.95,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 8,
      endTime: 24,
      label: "CHORUS",
      confidence: 0.95,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 24,
      endTime: 32,
      label: "OUTRO",
      confidence: 0.9,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
  ],
  beats: gtBeats(120, 32),
  downbeats: downbeats(120, 32),
  eightCounts: eights(120, 32),
  events: [
    {
      timestamp: 8,
      type: "SECTION_CHANGE",
      confidence: 0.9,
      annotatorId: "annotator-a",
    },
  ],
});

const hiphopGt = baseSong({
  songId: "gt-hiphop",
  audioHash: "hash-hiphop-v1",
  durationSeconds: 32,
  genre: "hip-hop",
  tempoCategory: "medium",
  conditions: {
    genre: "hip-hop",
    tempoCategory: "medium",
    structuralComplexity: "moderate",
    vocalPresence: "vocal-heavy",
    energy: "medium",
    beatDensity: "sparse",
    durationBucket: "short",
  },
  bpm: 90,
  title: "Hip-Hop (synthetic GT)",
  sections: [
    {
      startTime: 0,
      endTime: 16,
      label: "VERSE",
      confidence: 0.9,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 16,
      endTime: 32,
      label: "CHORUS",
      confidence: 0.9,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
  ],
  beats: gtBeats(90, 32),
  downbeats: downbeats(90, 32),
  eightCounts: eights(90, 32),
  events: null,
});

const edmGt = baseSong({
  songId: "gt-edm",
  audioHash: "hash-edm-v1",
  durationSeconds: 32,
  genre: "edm",
  tempoCategory: "fast",
  conditions: {
    genre: "edm",
    tempoCategory: "fast",
    structuralComplexity: "moderate",
    vocalPresence: "mixed",
    energy: "high",
    beatDensity: "dense",
    durationBucket: "short",
    flags: ["drop"],
  },
  bpm: 128,
  title: "EDM (synthetic GT)",
  sections: [
    {
      startTime: 0,
      endTime: 8,
      label: "INTRO",
      confidence: 0.9,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 8,
      endTime: 16,
      label: "BREAK",
      confidence: 0.85,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 16,
      endTime: 32,
      label: "CHORUS",
      confidence: 0.95,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
  ],
  beats: gtBeats(128, 32),
  downbeats: downbeats(128, 32),
  eightCounts: eights(128, 32),
  events: [
    {
      timestamp: 8,
      type: "BREAK",
      confidence: 0.9,
      annotatorId: "annotator-a",
    },
    {
      timestamp: 16,
      type: "DROP",
      confidence: 0.95,
      annotatorId: "annotator-a",
    },
  ],
});

const slowGt = baseSong({
  songId: "gt-slow-ballad",
  audioHash: "hash-slow-v1",
  durationSeconds: 40,
  genre: "ballad",
  tempoCategory: "slow",
  conditions: {
    genre: "ballad",
    tempoCategory: "slow",
    structuralComplexity: "simple",
    vocalPresence: "vocal-heavy",
    energy: "low",
    beatDensity: "sparse",
    durationBucket: "short",
  },
  bpm: 70,
  title: "Slow Ballad (synthetic GT)",
  sections: [
    {
      startTime: 0,
      endTime: 16,
      label: "VERSE",
      confidence: 0.9,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 16,
      endTime: 40,
      label: "CHORUS",
      confidence: 0.9,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
  ],
  beats: gtBeats(70, 40),
  downbeats: downbeats(70, 40),
  eightCounts: eights(70, 40),
  events: null,
});

const complexGt = baseSong({
  songId: "gt-complex",
  audioHash: "hash-complex-v1",
  durationSeconds: 48,
  genre: "complex",
  tempoCategory: "variable",
  conditions: {
    genre: "complex",
    tempoCategory: "variable",
    structuralComplexity: "complex",
    vocalPresence: "mixed",
    energy: "high",
    beatDensity: "dense",
    durationBucket: "short",
    flags: ["half-time-risk"],
  },
  bpm: 100,
  title: "Complex / half-time risk (synthetic GT)",
  sections: [
    {
      startTime: 0,
      endTime: 8,
      label: "INTRO",
      confidence: 0.85,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 8,
      endTime: 20,
      label: "VERSE",
      confidence: 0.8,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 20,
      endTime: 28,
      label: "PRE_CHORUS",
      confidence: 0.75,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 28,
      endTime: 40,
      label: "CHORUS",
      confidence: 0.9,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
    {
      startTime: 40,
      endTime: 48,
      label: "BRIDGE",
      confidence: 0.8,
      annotatorId: "annotator-a",
      annotationVersion: "1.0.0",
    },
  ],
  beats: gtBeats(100, 48),
  downbeats: downbeats(100, 48),
  eightCounts: eights(100, 48),
  events: [
    {
      timestamp: 28,
      type: "IMPACT",
      confidence: 0.85,
      annotatorId: "annotator-a",
    },
  ],
});

function entry(
  groundTruth: FlyGroundTruthSong,
  librosa: FlyBenchmarkHypothesis,
  essentia: FlyBenchmarkHypothesis
): FlyBenchmarkDatasetEntry {
  return { groundTruth, hypotheses: [librosa, essentia] };
}

/** Full golden dataset for Phase 4.5 */
export function loadFlyBenchmarkGoldenDataset(): FlyBenchmarkDatasetEntry[] {
  return [
    entry(
      simplePopGt,
      makeHyp(
        "librosa",
        "fixture-librosa-v1",
        120,
        8,
        32,
        [
          { startTime: 0, endTime: 8.1, label: "INTRO" },
          { startTime: 8.1, endTime: 24, label: "CHORUS" },
          { startTime: 24, endTime: 32, label: "OUTRO" },
        ]
      ),
      makeHyp(
        "essentia",
        "fixture-essentia-v1",
        120,
        5,
        32,
        [
          { startTime: 0, endTime: 8, label: "INTRO" },
          { startTime: 8, endTime: 24.05, label: "CHORUS" },
          { startTime: 24.05, endTime: 32, label: "OUTRO" },
        ]
      )
    ),
    entry(
      hiphopGt,
      makeHyp(
        "librosa",
        "fixture-librosa-v1",
        90,
        15,
        32,
        [
          { startTime: 0, endTime: 16.2, label: "VERSE" },
          { startTime: 16.2, endTime: 32, label: "CHORUS" },
        ]
      ),
      makeHyp(
        "essentia",
        "fixture-essentia-v1",
        90,
        10,
        32,
        [
          { startTime: 0, endTime: 16, label: "VERSE" },
          { startTime: 16, endTime: 32, label: "CHORUS" },
        ]
      )
    ),
    entry(
      edmGt,
      makeHyp(
        "librosa",
        "fixture-librosa-v1",
        128,
        12,
        32,
        [
          { startTime: 0, endTime: 8, label: "INTRO" },
          { startTime: 8, endTime: 16.3, label: "BREAK" },
          { startTime: 16.3, endTime: 32, label: "CHORUS" },
        ],
        {
          events: [
            { timestamp: 8.05, type: "BREAK" },
            { timestamp: 16.1, type: "DROP" },
          ],
        }
      ),
      makeHyp(
        "essentia",
        "fixture-essentia-v1",
        128,
        6,
        32,
        [
          { startTime: 0, endTime: 8, label: "INTRO" },
          { startTime: 8, endTime: 16, label: "BREAK" },
          { startTime: 16, endTime: 32, label: "CHORUS" },
        ],
        {
          events: [
            { timestamp: 8.02, type: "BREAK" },
            { timestamp: 16.02, type: "DROP" },
          ],
        }
      )
    ),
    entry(
      slowGt,
      makeHyp(
        "librosa",
        "fixture-librosa-v1",
        70,
        25,
        40,
        [
          { startTime: 0, endTime: 16.4, label: "VERSE" },
          { startTime: 16.4, endTime: 40, label: "CHORUS" },
        ]
      ),
      makeHyp(
        "essentia",
        "fixture-essentia-v1",
        70,
        18,
        40,
        [
          { startTime: 0, endTime: 16, label: "VERSE" },
          { startTime: 16, endTime: 40, label: "CHORUS" },
        ]
      )
    ),
    entry(
      complexGt,
      // librosa half-time mistake on purpose (50 vs 100) — tempo class test
      {
        ...makeHyp(
          "librosa",
          "fixture-librosa-v1",
          50,
          20,
          48,
          [
            { startTime: 0, endTime: 8.5, label: "INTRO" },
            { startTime: 8.5, endTime: 20, label: "VERSE" },
            { startTime: 20, endTime: 28.2, label: "BRIDGE" }, // wrong label
            { startTime: 28.2, endTime: 40, label: "CHORUS" },
            { startTime: 40, endTime: 48, label: "OUTRO" }, // wrong label
          ]
        ),
        bpm: 50,
      },
      makeHyp(
        "essentia",
        "fixture-essentia-v1",
        100,
        8,
        48,
        [
          { startTime: 0, endTime: 8, label: "INTRO" },
          { startTime: 8, endTime: 20, label: "VERSE" },
          { startTime: 20, endTime: 28, label: "PRE_CHORUS" },
          { startTime: 28, endTime: 40, label: "CHORUS" },
          { startTime: 40, endTime: 48, label: "BRIDGE" },
        ]
      )
    ),
  ];
}

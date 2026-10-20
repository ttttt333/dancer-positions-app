/**
 * Schema pilot only — NOT real listening GT, NOT production accuracy.
 * Used to exercise agreement / consensus / bridge / pipeline tests.
 */

import type { RealSongAnnotation } from "../../../../src/lib/fly/realSong/types";
import { FLY_ANNOTATION_CONTRACT_VERSION } from "../../../../src/lib/fly/realSong/versions";

const HASH =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function beats(bpm: number, duration: number, phase = 0): number[] {
  const step = 60 / bpm;
  const out: number[] = [];
  for (let t = phase; t < duration - 1e-9; t += step) {
    out.push(Math.round(t * 1000) / 1000);
  }
  return out;
}

export const PILOT_SONG_ID = "song-pilot-format";

export const pilotAnnotatorA: RealSongAnnotation = {
  songId: PILOT_SONG_ID,
  annotatorId: "annotator-a",
  annotationVersion: FLY_ANNOTATION_CONTRACT_VERSION,
  audioSha256: HASH,
  bpm: 120,
  bpmConfidence: 0.95,
  beats: beats(120, 32),
  downbeats: beats(120, 32).filter((_, i) => i % 4 === 0),
  countGrid: {
    startSec: 0,
    bpm: 120,
    beatOffsetSec: 0,
    barsPerPhrase: 2,
  },
  sections: [
    { startSec: 0, endSec: 8, label: "INTRO", confidence: 0.9 },
    { startSec: 8, endSec: 24, label: "CHORUS", confidence: 0.92 },
    { startSec: 24, endSec: 32, label: "OUTRO", confidence: 0.88 },
  ],
  musicalChanges: [
    {
      timeSec: 8,
      strength: "HIGH",
      reasons: ["SECTION_CHANGE", "ENERGY_RISE"],
      confidence: 0.9,
    },
  ],
  annotatedAt: "2026-09-09T00:00:00.000Z",
  notes: "PILOT_SCHEMA_ONLY",
};

/** Slight boundary disagreement vs A — for human agreement tests */
export const pilotAnnotatorB: RealSongAnnotation = {
  ...pilotAnnotatorA,
  annotatorId: "annotator-b",
  bpm: 120,
  beats: beats(120, 32).map((t) => Math.round((t + 0.015) * 1000) / 1000),
  sections: [
    { startSec: 0, endSec: 8.2, label: "INTRO", confidence: 0.85 },
    { startSec: 8.2, endSec: 24, label: "CHORUS", confidence: 0.9 },
    { startSec: 24, endSec: 32, label: "OUTRO", confidence: 0.85 },
  ],
  musicalChanges: [
    {
      timeSec: 8.1,
      strength: "HIGH",
      reasons: ["SECTION_CHANGE", "ENERGY_RISE"],
      confidence: 0.85,
    },
  ],
  annotatedAt: "2026-09-09T00:01:00.000Z",
};

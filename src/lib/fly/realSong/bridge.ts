/**
 * Bridge RealSong annotations → Phase 4.5 FlyGroundTruthSong / hypotheses.
 */

import type {
  FlyBenchmarkHypothesis,
  FlyGroundTruthSong,
  TempoCategory,
} from "../benchmark/types";
import {
  FLY_DATASET_VERSION,
  FLY_GROUND_TRUTH_VERSION,
} from "../benchmark/versions";
import type {
  AnalyzerHypothesisFile,
  RealSongAnnotation,
  RealSongManifest,
} from "./types";

export function tempoClassToCategory(
  t: RealSongManifest["conditions"]["tempoClass"]
): TempoCategory {
  if (t === "SLOW") return "slow";
  if (t === "FAST") return "fast";
  return "medium";
}

export function annotationToFlyGroundTruth(
  manifest: RealSongManifest,
  annotation: RealSongAnnotation
): FlyGroundTruthSong {
  const bpm = annotation.bpm;
  const beatDur = bpm && bpm > 0 ? 60 / bpm : 0.5;
  const eightCounts =
    annotation.countGrid != null
      ? expandEightCounts(
          annotation.countGrid.startSec,
          beatDur,
          manifest.durationSec
        )
      : null;

  return {
    songId: manifest.songId,
    audioHash: annotation.audioSha256,
    durationSeconds: manifest.durationSec,
    genre: manifest.conditions.genre[0] ?? "unknown",
    tempoCategory: tempoClassToCategory(manifest.conditions.tempoClass),
    datasetVersion: FLY_DATASET_VERSION,
    groundTruthVersion: FLY_GROUND_TRUTH_VERSION,
    conditions: {
      genre: manifest.conditions.genre[0] ?? "unknown",
      tempoCategory: tempoClassToCategory(manifest.conditions.tempoClass),
      beatDensity:
        manifest.conditions.beatDensity === "LOW"
          ? "sparse"
          : manifest.conditions.beatDensity === "HIGH"
            ? "dense"
            : "normal",
      structuralComplexity:
        manifest.conditions.structureComplexity === "SIMPLE"
          ? "simple"
          : manifest.conditions.structureComplexity === "COMPLEX"
            ? "complex"
            : "moderate",
      vocalPresence:
        manifest.conditions.vocal === "INSTRUMENTAL"
          ? "instrumental"
          : "vocal-heavy",
      flags: [
        ...(manifest.conditions.flags ?? []),
        `version:${manifest.conditions.version}`,
        `split:${manifest.datasetSplit}`,
      ],
    },
    bpm,
    title: manifest.title,
    sections: annotation.sections.map((s) => ({
      startTime: s.startSec,
      endTime: s.endSec,
      label: s.label,
      confidence: s.confidence,
      annotatorId: annotation.annotatorId,
      annotationVersion: annotation.annotationVersion,
    })),
    beats: annotation.beats.map((beatTime, beatIndex) => ({
      beatTime,
      beatIndex,
      confidence: annotation.bpmConfidence,
      annotatorId: annotation.annotatorId,
    })),
    downbeats: annotation.downbeats.map((downbeatTime, barIndex) => ({
      downbeatTime,
      barIndex,
      confidence: annotation.bpmConfidence,
      annotatorId: annotation.annotatorId,
    })),
    eightCounts,
    events:
      annotation.musicalChanges?.map((mc) => ({
        timestamp: mc.timeSec,
        type: mapReasonToEvent(mc.reasons[0] ?? "OTHER"),
        confidence: mc.confidence,
        annotatorId: annotation.annotatorId,
      })) ?? null,
    annotators: [annotation.annotatorId],
  };
}

export function hypothesisFileToFly(
  h: AnalyzerHypothesisFile
): FlyBenchmarkHypothesis {
  return {
    analyzerId: h.analyzerId,
    analyzerVersion: h.analyzerVersion,
    adapterVersion: h.adapterVersion,
    bpm: h.bpm ?? null,
    beats: h.beats ?? null,
    downbeats: h.downbeats ?? null,
    onsets: h.onsets ?? null,
    sections: h.sections?.map((s) => ({
      startTime: s.startSec,
      endTime: s.endSec,
      label: s.label,
    })),
    eightCounts: h.eightCountStarts?.map((startTime, i) => ({
      startTime,
      endTime: startTime + 4,
      countIndex: i,
      phraseIndex: Math.floor(i / 2),
    })),
    events: h.events ?? null,
  };
}

function expandEightCounts(
  startSec: number,
  beatDur: number,
  duration: number
): FlyGroundTruthSong["eightCounts"] {
  const phrase = beatDur * 8;
  const out: NonNullable<FlyGroundTruthSong["eightCounts"]> = [];
  let i = 0;
  for (let t = startSec; t + phrase <= duration + 1e-9; t += phrase) {
    out.push({
      startTime: t,
      endTime: t + phrase,
      countIndex: i,
      phraseIndex: Math.floor(i / 2),
      confidence: 0.9,
    });
    i++;
  }
  return out;
}

function mapReasonToEvent(
  reason: string
): NonNullable<FlyGroundTruthSong["events"]>[number]["type"] {
  if (reason === "DROP") return "DROP";
  if (reason === "BREAK") return "BREAK";
  if (reason === "IMPACT") return "IMPACT";
  if (reason === "ENERGY_RISE") return "ENERGY_RISE";
  if (reason === "ENERGY_DROP") return "ENERGY_FALL";
  if (reason === "SECTION_CHANGE") return "SECTION_CHANGE";
  return "IMPACT";
}

/**
 * Map Essentia-native output → FLY normalized analyzer fields.
 * Never invent half/double-time or downbeats when missing.
 */

import type { FlyAnalyzerResult, FlyMetricProvenance } from "../types";
import { essentiaCapabilitiesForResult } from "./capabilities";
import {
  ESSENTIA_ADAPTER_ID,
  ESSENTIA_ADAPTER_VERSION,
  type EssentiaRawResult,
} from "./types";

export function mapEssentiaRawToFlyAnalyzerResult(
  raw: EssentiaRawResult,
  opts?: { analyzedAt?: string }
): FlyAnalyzerResult {
  const analyzedAt = opts?.analyzedAt ?? new Date().toISOString();
  const hasDownbeat =
    Array.isArray(raw.downbeats) && raw.downbeats.length > 0;
  const capabilities = essentiaCapabilitiesForResult(hasDownbeat);

  const provenance: FlyMetricProvenance[] = [];

  let tempo: FlyAnalyzerResult["tempo"] = null;
  if (raw.bpm != null && Number.isFinite(raw.bpm) && raw.bpm > 0) {
    const conf =
      raw.bpmConfidence != null && Number.isFinite(raw.bpmConfidence)
        ? clamp01(raw.bpmConfidence)
        : null;
    tempo = {
      estimatedBpm: raw.bpm,
      bpmCandidates: [raw.bpm],
      confidence: conf ?? undefined,
      // Not invented — leave undefined when Essentia does not provide
      stability: undefined,
      halfTimeProbability: undefined,
      doubleTimeProbability: undefined,
    };
    provenance.push({
      metric: "tempo",
      value: raw.bpm,
      sources: [
        {
          analyzer: ESSENTIA_ADAPTER_ID,
          confidence: conf ?? 0,
          value: raw.bpm,
        },
      ],
    });
  }

  let beat: FlyAnalyzerResult["beat"] = null;
  if (Array.isArray(raw.beats) && raw.beats.length > 0) {
    const bpm = raw.bpm != null && raw.bpm > 0 ? raw.bpm : 0;
    const beatConf =
      raw.beatConfidences && raw.beatConfidences.length === raw.beats.length
        ? mean(raw.beatConfidences)
        : raw.bpmConfidence != null
          ? clamp01(raw.bpmConfidence)
          : 0.5;
    beat = {
      bpm,
      beats: raw.beats.map((t) => Number(t)),
      confidence: beatConf,
      source: ESSENTIA_ADAPTER_ID,
      beatConfidences: raw.beatConfidences ?? undefined,
    };
    provenance.push({
      metric: "beat",
      value: raw.beats.length,
      sources: [
        {
          analyzer: ESSENTIA_ADAPTER_ID,
          confidence: beatConf,
          value: raw.beats[0] ?? null,
          note: `n=${raw.beats.length}`,
        },
      ],
    });
  }

  const downbeats =
    hasDownbeat && raw.downbeats
      ? raw.downbeats.map((time, i) => ({
          time,
          confidence:
            raw.downbeatConfidences?.[i] != null
              ? clamp01(raw.downbeatConfidences[i]!)
              : 0,
        }))
      : null;

  const onsets =
    Array.isArray(raw.onsets) && raw.onsets.length > 0
      ? raw.onsets.map((o) => ({
          time: o.time,
          strength: o.strength ?? 0.5,
          confidence: clamp01(o.strength ?? 0.5),
        }))
      : null;

  if (onsets) {
    provenance.push({
      metric: "onset",
      value: onsets.length,
      sources: [
        {
          analyzer: ESSENTIA_ADAPTER_ID,
          confidence: mean(onsets.map((o) => o.confidence)),
          note: `n=${onsets.length}`,
        },
      ],
    });
  }

  return {
    analyzerId: ESSENTIA_ADAPTER_ID,
    adapterVersion: ESSENTIA_ADAPTER_VERSION,
    meta: {
      source: ESSENTIA_ADAPTER_ID,
      version: raw.runtimeVersion,
      analyzedAt,
      capabilities,
    },
    ok: true,
    tempo,
    beat,
    downbeats,
    onsets,
    provenance,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

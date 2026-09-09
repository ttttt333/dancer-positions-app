/**
 * Multi-analyzer Fusion API (Phase 4).
 * Accepts FlyAnalyzerResult[] — does not yet implement "world-class" picking.
 * Librosa / existing StructureResultV2 remains the Formation-compatible spine.
 */

import type { StructureResultV2 } from "../choreocore/types/songStructure";
import { fuseToFlyAnalysis, type FusionInput } from "./fusion";
import type { FlyAnalyzerResult, FlyMetricProvenance } from "./adapters/types";
import type {
  BeatAnalysis,
  FlyAnalysisResult,
  MusicEvent,
  TempoAnalysis,
} from "./types";
import { FLY_FUSION_VERSION } from "./versions";
import { structureV2FromFlyAnalysis } from "./toStructureV2";

export type FlyFusionInput = {
  /** One or more analyzer outputs (librosa, essentia, …) */
  analyzers: FlyAnalyzerResult[];
  /**
   * Required for Formation Engine compatibility in Phase 4:
   * existing StructureResultV2 path remains the spine.
   */
  legacy?: FusionInput;
  audioHash?: string;
};

export type FlyFusionResult = {
  tempo?: TempoAnalysis;
  beat?: BeatAnalysis;
  sections?: FlyAnalysisResult["sections"];
  events?: MusicEvent[];
  /** Optional onset events preserved for Analysis Lab (not Dance Intelligence yet) */
  onsetsBySource?: Record<string, NonNullable<FlyAnalyzerResult["onsets"]>>;
  sourceAgreement: number;
  confidence: number;
  provenance: FlyMetricProvenance[];
  /** Full FLY result when legacy StructureResultV2 provided */
  fly?: FlyAnalysisResult;
  /** Formation-safe V2 — unchanged contract when legacy provided */
  structureV2?: StructureResultV2;
  fusionVersion: string;
  /** Determinism / cache keys */
  determinism?: {
    audioHash?: string;
    analyzerVersions: string[];
    adapterVersions: string[];
    fusionVersion: string;
  };
  degraded: boolean;
  notes: string[];
};

/**
 * Fuse multiple analyzer results.
 * Phase 4 policy:
 * - Prefer legacy StructureResultV2 → full FlyAnalysisResult for Formation
 * - Merge provenance from all successful analyzers
 * - Tempo/beat overlay from Essentia only recorded in provenance + optional lab fields
 *   (does NOT replace Formation spine unless no legacy — then pick best tempo)
 */
export function fuseAnalyzerResults(input: FlyFusionInput): FlyFusionResult {
  const notes: string[] = [];
  const okAnalyzers = input.analyzers.filter((a) => a.ok);
  const failed = input.analyzers.filter((a) => !a.ok);

  for (const f of failed) {
    notes.push(
      `${f.analyzerId} failed: ${f.errorCode ?? "unknown"} ${f.errorMessage ?? ""}`.trim()
    );
  }

  const provenance = mergeProvenance(okAnalyzers);
  const onsetsBySource: FlyFusionResult["onsetsBySource"] = {};
  for (const a of okAnalyzers) {
    if (a.onsets?.length) onsetsBySource[a.analyzerId] = a.onsets;
  }

  const sourceAgreement = computeSourceAgreement(okAnalyzers);
  const confidence = computeFusionConfidence(okAnalyzers, sourceAgreement);

  let fly: FlyAnalysisResult | undefined;
  let structureV2: StructureResultV2 | undefined;
  let tempo: TempoAnalysis | undefined;
  let beat: BeatAnalysis | undefined;
  let sections: FlyAnalysisResult["sections"] | undefined;
  let events: MusicEvent[] | undefined;
  let degraded = failed.length > 0 && okAnalyzers.length > 0;

  if (input.legacy?.structureV2) {
    fly = fuseToFlyAnalysis(input.legacy);
    // Annotate sources with multi-analyzer availability
    fly = {
      ...fly,
      sources: [
        ...fly.sources.map((s) => {
          if (s.id === "essentia") {
            const ess = input.analyzers.find((a) => a.analyzerId === "essentia");
            if (ess?.ok) {
              return {
                ...s,
                available: true,
                role: "secondary" as const,
                version: ess.meta.version,
                note: "adapter_connected",
              };
            }
            if (ess && !ess.ok) {
              return {
                ...s,
                available: false,
                note: ess.errorCode ?? "unavailable",
              };
            }
          }
          return s;
        }),
      ],
      quality: {
        ...fly.quality,
        sourceAgreement,
        overall: clamp01(
          fly.quality.overall * 0.85 + confidence * 0.15
        ),
      },
      overallConfidence: clamp01(
        fly.overallConfidence * 0.85 + confidence * 0.15
      ),
      versions: {
        ...fly.versions,
        fusionVersion: FLY_FUSION_VERSION,
      },
    };
    structureV2 = structureV2FromFlyAnalysis(fly);
    tempo = fly.tempo;
    beat = fly.beat;
    sections = fly.sections;
    events = fly.events;
  } else if (okAnalyzers.length > 0) {
    // No legacy — pick highest-confidence tempo/beat among analyzers (lab mode)
    const bestTempo = pickBestTempo(okAnalyzers);
    const bestBeat = pickBestBeat(okAnalyzers);
    tempo = bestTempo ?? undefined;
    beat = bestBeat ?? undefined;
    degraded = true;
    notes.push("no_legacy_structure_v2 — Formation Engine path incomplete");
  } else {
    degraded = true;
    notes.push("no_successful_analyzers");
  }

  const analyzerVersions = input.analyzers.map((a) => a.meta.version);
  const adapterVersions = input.analyzers.map((a) => a.adapterVersion);

  return {
    tempo,
    beat,
    sections,
    events,
    onsetsBySource:
      Object.keys(onsetsBySource).length > 0 ? onsetsBySource : undefined,
    sourceAgreement,
    confidence,
    provenance,
    fly,
    structureV2,
    fusionVersion: FLY_FUSION_VERSION,
    determinism: {
      audioHash: input.audioHash ?? input.legacy?.audioHash ?? undefined,
      analyzerVersions,
      adapterVersions,
      fusionVersion: FLY_FUSION_VERSION,
    },
    degraded,
    notes,
  };
}

function mergeProvenance(analyzers: FlyAnalyzerResult[]): FlyMetricProvenance[] {
  const byMetric = new Map<string, FlyMetricProvenance>();
  for (const a of analyzers) {
    for (const p of a.provenance ?? []) {
      const existing = byMetric.get(p.metric);
      if (!existing) {
        byMetric.set(p.metric, {
          metric: p.metric,
          value: p.value,
          sources: [...p.sources],
        });
      } else {
        existing.sources.push(...p.sources);
        // Keep primary value from first (librosa usually first)
      }
    }
  }
  return [...byMetric.values()];
}

function computeSourceAgreement(analyzers: FlyAnalyzerResult[]): number {
  const tempos = analyzers
    .map((a) => a.tempo?.estimatedBpm)
    .filter((b): b is number => b != null && b > 0);
  if (tempos.length < 2) return tempos.length === 1 ? 1 : 0;
  const mean = tempos.reduce((a, b) => a + b, 0) / tempos.length;
  const maxRel = Math.max(
    ...tempos.map((t) => Math.abs(t - mean) / Math.max(mean, 1))
  );
  // Also treat half/double as agreement
  const allAgreeHalving = tempos.every((t) => {
    const r = t / mean;
    return (
      Math.abs(r - 1) < 0.05 ||
      Math.abs(r - 0.5) < 0.05 ||
      Math.abs(r - 2) < 0.05
    );
  });
  if (allAgreeHalving && maxRel < 0.08) return 0.95;
  if (maxRel < 0.03) return 0.98;
  if (maxRel < 0.08) return 0.75;
  return Math.max(0.2, 1 - maxRel);
}

function computeFusionConfidence(
  analyzers: FlyAnalyzerResult[],
  agreement: number
): number {
  if (!analyzers.length) return 0;
  const confs = analyzers.map((a) => a.tempo?.confidence ?? a.beat?.confidence ?? 0.5);
  const meanConf = confs.reduce((a, b) => a + b, 0) / confs.length;
  return clamp01(meanConf * 0.6 + agreement * 0.4);
}

function pickBestTempo(analyzers: FlyAnalyzerResult[]): TempoAnalysis | null {
  let best: { conf: number; t: Partial<TempoAnalysis> } | null = null;
  for (const a of analyzers) {
    const t = a.tempo;
    if (!t?.estimatedBpm) continue;
    const conf = t.confidence ?? 0.5;
    if (!best || conf > best.conf) best = { conf, t };
  }
  if (!best?.t.estimatedBpm) return null;
  return {
    estimatedBpm: best.t.estimatedBpm,
    bpmCandidates: best.t.bpmCandidates ?? [best.t.estimatedBpm],
    confidence: best.t.confidence ?? best.conf,
    stability: best.t.stability ?? 0,
    halfTimeProbability: best.t.halfTimeProbability ?? 0,
    doubleTimeProbability: best.t.doubleTimeProbability ?? 0,
  };
}

function pickBestBeat(analyzers: FlyAnalyzerResult[]): BeatAnalysis | null {
  let best: { conf: number; b: NonNullable<FlyAnalyzerResult["beat"]> } | null =
    null;
  for (const a of analyzers) {
    if (!a.beat?.beats?.length) continue;
    const conf = a.beat.confidence ?? 0.5;
    if (!best || conf > best.conf) best = { conf, b: a.beat };
  }
  if (!best) return null;
  return {
    bpm: best.b.bpm ?? 0,
    beats: best.b.beats ?? [],
    confidence: best.b.confidence ?? best.conf,
    source: best.b.source ?? "fusion",
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

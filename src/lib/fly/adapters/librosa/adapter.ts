/**
 * Librosa / existing StructureResultV2 as a FlyAnalyzerAdapter.
 * Wraps remote AIO / chroma path into the same multi-analyzer contract.
 */

import type { StructureResultV2 } from "../../../choreocore/types/songStructure";
import { flyAnalysisFromStructureV2 } from "../../fromStructureV2";
import type {
  FlyAnalyzerAdapter,
  FlyAnalyzerCapability,
  FlyAnalyzerResult,
  FlyAudioInput,
  FlyMetricProvenance,
} from "../types";

export const LIBROSA_ADAPTER_ID = "librosa";
export const LIBROSA_ADAPTER_VERSION = "fly-librosa-adapter-v0.1.0";

export type LibrosaStructureAdapterOpts = {
  structureV2: StructureResultV2;
  audioHash?: string | null;
  analyzerVersion?: string | null;
  sourceLabel?: string | null;
};

/**
 * Adapter that does not re-analyze PCM — projects an already-fetched
 * StructureResultV2 into FlyAnalyzerResult for Fusion.
 */
export class LibrosaStructureAdapter implements FlyAnalyzerAdapter {
  readonly id = LIBROSA_ADAPTER_ID;
  readonly version = LIBROSA_ADAPTER_VERSION;
  capabilities: FlyAnalyzerCapability[] = [
    "tempo",
    "beat",
    "segmentation",
    "spectral",
  ];

  private readonly opts: LibrosaStructureAdapterOpts;

  constructor(opts: LibrosaStructureAdapterOpts) {
    this.opts = opts;
  }

  async analyze(_audio: FlyAudioInput): Promise<FlyAnalyzerResult> {
    void _audio;
    const fly = flyAnalysisFromStructureV2({
      structureV2: this.opts.structureV2,
      audioHash: this.opts.audioHash,
      analyzerVersion: this.opts.analyzerVersion,
      sourceLabel: this.opts.sourceLabel ?? "librosa",
    });
    const analyzedAt = new Date().toISOString();
    const provenance: FlyMetricProvenance[] = [
      {
        metric: "tempo",
        value: fly.tempo.estimatedBpm,
        sources: [
          {
            analyzer: LIBROSA_ADAPTER_ID,
            confidence: fly.tempo.confidence,
            value: fly.tempo.estimatedBpm,
          },
        ],
      },
      {
        metric: "beat",
        value: fly.beat.beats.length,
        sources: [
          {
            analyzer: LIBROSA_ADAPTER_ID,
            confidence: fly.beat.confidence,
            value: fly.beat.beats[0] ?? null,
            note: `n=${fly.beat.beats.length}`,
          },
        ],
      },
    ];

    return {
      analyzerId: LIBROSA_ADAPTER_ID,
      adapterVersion: LIBROSA_ADAPTER_VERSION,
      meta: {
        source: LIBROSA_ADAPTER_ID,
        version: this.opts.analyzerVersion ?? fly.versions.analyzerVersion,
        analyzedAt,
        capabilities: [...this.capabilities],
      },
      ok: true,
      tempo: fly.tempo,
      beat: fly.beat,
      downbeats: null,
      onsets: null,
      provenance,
    };
  }
}

/** Project StructureResultV2 without needing PCM (Fusion helper). */
export function librosaResultFromStructureV2(
  opts: LibrosaStructureAdapterOpts
): FlyAnalyzerResult {
  const fly = flyAnalysisFromStructureV2({
    structureV2: opts.structureV2,
    audioHash: opts.audioHash,
    analyzerVersion: opts.analyzerVersion,
    sourceLabel: opts.sourceLabel ?? "librosa",
  });
  const analyzedAt = new Date().toISOString();
  return {
    analyzerId: LIBROSA_ADAPTER_ID,
    adapterVersion: LIBROSA_ADAPTER_VERSION,
    meta: {
      source: LIBROSA_ADAPTER_ID,
      version: opts.analyzerVersion ?? fly.versions.analyzerVersion,
      analyzedAt,
      capabilities: ["tempo", "beat", "segmentation", "spectral"],
    },
    ok: true,
    tempo: fly.tempo,
    beat: fly.beat,
    downbeats: null,
    onsets: null,
    provenance: [
      {
        metric: "tempo",
        value: fly.tempo.estimatedBpm,
        sources: [
          {
            analyzer: LIBROSA_ADAPTER_ID,
            confidence: fly.tempo.confidence,
            value: fly.tempo.estimatedBpm,
          },
        ],
      },
      {
        metric: "beat",
        value: fly.beat.beats.length,
        sources: [
          {
            analyzer: LIBROSA_ADAPTER_ID,
            confidence: fly.beat.confidence,
            value: fly.beat.beats[0] ?? null,
          },
        ],
      },
    ],
  };
}

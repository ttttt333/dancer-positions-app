/**
 * Run optional Essentia alongside existing remote analysis, then fuse.
 * On any Essentia failure → existing FLY/librosa path only (user UX intact).
 */

import type { FlyAudioInput } from "./adapters/types";
import { librosaResultFromStructureV2 } from "./adapters/librosa/adapter";
import { createEssentiaAdapter } from "./adapters/essentia";
import { isFlyEssentiaEnabledResolved } from "./featureFlags";
import { fuseAnalyzerResults, type FlyFusionResult } from "./fusionMulti";
import type { FusionInput } from "./fusion";
import type { StructureResultV2 } from "../choreocore/types/songStructure";

export type EnsembleAnalyzeOpts = {
  structureV2: StructureResultV2;
  audioHash?: string | null;
  analyzerVersion?: string | null;
  sourceLabel?: string | null;
  songDynamism?: number | null;
  changePoints?: FusionInput["changePoints"];
  /** When flag ON and PCM provided, Essentia adapter runs */
  audio?: FlyAudioInput | null;
};

/**
 * Multi-analyzer entry used when building FLY from remote StructureResultV2.
 * Essentia only runs if feature flag + audio PCM are present.
 */
export async function fuseWithOptionalEssentia(
  opts: EnsembleAnalyzeOpts
): Promise<FlyFusionResult> {
  const librosa = librosaResultFromStructureV2({
    structureV2: opts.structureV2,
    audioHash: opts.audioHash,
    analyzerVersion: opts.analyzerVersion,
    sourceLabel: opts.sourceLabel,
  });

  const analyzers = [librosa];

  if (isFlyEssentiaEnabledResolved() && opts.audio?.samples?.length) {
    const essentia = createEssentiaAdapter({ preferWasm: false });
    const essResult = await essentia.analyze(opts.audio);
    analyzers.push(essResult);
    // Fallback is automatic: failed essentia still leaves librosa-only fusion
  }

  return fuseAnalyzerResults({
    analyzers,
    legacy: {
      structureV2: opts.structureV2,
      audioHash: opts.audioHash,
      analyzerVersion: opts.analyzerVersion,
      sourceLabel: opts.sourceLabel,
      songDynamism: opts.songDynamism,
      changePoints: opts.changePoints,
    },
    audioHash: opts.audioHash ?? undefined,
  });
}

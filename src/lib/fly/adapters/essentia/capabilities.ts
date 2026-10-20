import type { FlyAnalyzerCapability } from "../types";

/** Declared capabilities — downbeat only when runtime actually returns them */
export const ESSENTIA_CAPABILITIES_BASE: FlyAnalyzerCapability[] = [
  "tempo",
  "beat",
  "onset",
  "loudness",
  "spectral",
];

export const ESSENTIA_CAPABILITY_DOWNBEAT: FlyAnalyzerCapability = "downbeat";

export function essentiaCapabilitiesForResult(hasDownbeat: boolean): FlyAnalyzerCapability[] {
  if (!hasDownbeat) return [...ESSENTIA_CAPABILITIES_BASE];
  return [...ESSENTIA_CAPABILITIES_BASE, ESSENTIA_CAPABILITY_DOWNBEAT];
}

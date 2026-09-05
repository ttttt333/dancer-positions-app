import { ANALYSIS_VERSION } from "../constants";
import { CUE_ANALYSIS_VERSION } from "../cue/cueConfig";
import { FORMATION_INTELLIGENCE_VERSION } from "../formation/intentFormationConfig";
import { CHOREOGRAPHIC_INTENT_VERSION } from "../intent/ChoreographicIntentEngine";
import { TRANSITION_INTELLIGENCE_VERSION } from "../movement/transitionIntelligenceConfig";
import type { FormationCanaryArm, FormationCanaryContext } from "./formationCanaryTypes";

function stableHashHex(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function candidateContextHash(parts: {
  projectKey: string;
  songKey: string;
  sessionKey: string;
  releasePackageId?: string;
  dancerIds?: string[];
  candidateIds?: string[];
  cueIds?: string[];
}): string {
  const dancers = [...(parts.dancerIds ?? [])].sort((a, b) => a.localeCompare(b)).join(",");
  const candidates = [...(parts.candidateIds ?? [])].sort((a, b) => a.localeCompare(b)).join(",");
  const cues = [...(parts.cueIds ?? [])].sort((a, b) => a.localeCompare(b)).join(",");
  return stableHashHex(
    [
      parts.projectKey,
      parts.songKey,
      parts.sessionKey,
      parts.releasePackageId ?? "",
      dancers,
      candidates,
      cues,
      FORMATION_INTELLIGENCE_VERSION,
    ].join("|")
  );
}

export function buildCanaryContext(input: {
  projectKey: string;
  songKey?: string;
  sessionKey?: string;
  activationId?: string;
  releasePackageId?: string;
  activeFormationVersion: FormationCanaryArm;
  dancerIds?: string[];
  candidateIds?: string[];
  cueIds?: string[];
}): FormationCanaryContext {
  const songKey = input.songKey ?? "unknown-song";
  const sessionKey = input.sessionKey ?? `${input.projectKey}|${songKey}`;
  const candidateSetId = [...(input.candidateIds ?? [])].sort((a, b) => a.localeCompare(b)).join(",") || "empty";
  return {
    projectKey: input.projectKey,
    songKey,
    sessionKey,
    canaryActivationId: input.activationId,
    releasePackageId: input.releasePackageId,
    productionFormationVersion: "V1",
    activeFormationVersion: input.activeFormationVersion,
    musicVersion: ANALYSIS_VERSION,
    cueVersion: CUE_ANALYSIS_VERSION,
    intentVersion: CHOREOGRAPHIC_INTENT_VERSION,
    transitionVersion: TRANSITION_INTELLIGENCE_VERSION,
    candidateSetId,
    candidateContextHash: candidateContextHash({
      projectKey: input.projectKey,
      songKey,
      sessionKey,
      releasePackageId: input.releasePackageId,
      dancerIds: input.dancerIds,
      candidateIds: input.candidateIds,
      cueIds: input.cueIds,
    }),
  };
}

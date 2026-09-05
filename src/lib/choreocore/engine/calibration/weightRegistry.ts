/**
 * Versioned weight resolution。latest 依存はしない。
 * 不明・未設定は V1。Production constant は書き換えない。
 */

import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import {
  FORMATION_WEIGHTS_V1,
  FORMATION_WEIGHTS_V2_PROPOSAL,
  TRANSITION_WEIGHTS_V1,
  TRANSITION_WEIGHTS_V2_PROPOSAL,
} from "./weightApprovalConfig";
import type { ReleasePackage, WeightResolution } from "./releaseTypes";
import type { WeightApprovalLayer } from "./weightApprovalTypes";

export function stableFormationWeights(): Record<string, number> {
  return { ...FORMATION_INTELLIGENCE_WEIGHTS };
}

export function stableTransitionWeights(): Record<string, number> {
  return { ...TRANSITION_SCORE_WEIGHTS };
}

export function resolveWeights(input: {
  layer: WeightApprovalLayer;
  version?: string;
  release?: ReleasePackage;
}): WeightResolution {
  const v1Version = input.layer === "formation" ? FORMATION_WEIGHTS_V1 : TRANSITION_WEIGHTS_V1;
  const v1Weights =
    input.layer === "formation" ? stableFormationWeights() : stableTransitionWeights();
  const requested = input.version ?? v1Version;
  const known = new Set([
    v1Version,
    FORMATION_WEIGHTS_V2_PROPOSAL,
    TRANSITION_WEIGHTS_V2_PROPOSAL,
  ]);
  if (!requested || requested === "latest" || requested === "unknown" || !known.has(requested)) {
    return {
      layer: input.layer,
      version: v1Version,
      weights: v1Weights,
      fallback: true,
      error: "unknown-or-latest-version",
    };
  }
  if (requested === v1Version) {
    return { layer: input.layer, version: v1Version, weights: v1Weights, fallback: false };
  }
  const pkg = input.release;
  if (!pkg) {
    return {
      layer: input.layer,
      version: v1Version,
      weights: v1Weights,
      fallback: true,
      error: "unknown-package",
    };
  }
  const pkgVersion =
    input.layer === "formation" ? pkg.formationWeightsVersion : pkg.transitionWeightsVersion;
  const pkgWeights =
    input.layer === "formation" ? pkg.formationWeights : pkg.transitionWeights;
  if (pkg.layer !== input.layer || pkgVersion !== requested) {
    return {
      layer: input.layer,
      version: v1Version,
      weights: v1Weights,
      releasePackageId: pkg.packageId,
      fallback: true,
      error: "version-mismatch",
    };
  }
  return {
    layer: input.layer,
    version: pkgVersion,
    weights: { ...pkgWeights },
    releasePackageId: pkg.packageId,
    fallback: false,
  };
}

import { RELEASE_CANARY_ENABLED, RELEASE_CANARY_PERCENT } from "./releaseConfig";
import type { CanaryAssignment } from "./releaseTypes";

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function assignCanaryArm(input: {
  packageId: string;
  projectKey: string;
  enabled?: boolean;
  percent?: number;
}): CanaryAssignment {
  const enabled = input.enabled ?? RELEASE_CANARY_ENABLED;
  const percent = input.percent ?? RELEASE_CANARY_PERCENT;
  const key = `${input.packageId}|${input.projectKey}`;
  const bucket = stableHash(key) % 100;
  const arm: "v1" | "v2" = enabled && bucket < percent ? "v2" : "v1";
  return {
    packageId: input.packageId,
    projectKey: input.projectKey,
    arm,
    stable: true,
    splitEnabled: enabled,
  };
}

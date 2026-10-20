/**
 * Feature flags for FLY optional analyzers.
 * Default: Essentia OFF — existing user path unchanged.
 */

export function isFlyEssentiaEnabled(): boolean {
  try {
    const v = (
      import.meta as ImportMeta & {
        env?: Record<string, string | undefined>;
      }
    ).env?.VITE_FLY_ESSENTIA_ENABLED;
    if (v == null) return false;
    return v === "1" || v.toLowerCase() === "true" || v === "yes";
  } catch {
    return false;
  }
}

/** Node / test override */
let testOverride: boolean | null = null;

export function setFlyEssentiaEnabledForTests(value: boolean | null): void {
  testOverride = value;
}

export function isFlyEssentiaEnabledResolved(): boolean {
  if (testOverride != null) return testOverride;
  return isFlyEssentiaEnabled();
}

/**
 * Track-normalized energy (0–100). Separate from raw RMS so later cue logic
 * can reason about rise/drop without depending on recording gain.
 */
export type EnergyPoint = {
  time: number;
  value: number;
  delta: number;
  acceleration: number;
};

export type EnergyCurve = {
  points: EnergyPoint[];
  average: number;
  peak: number;
  dynamicRange: number;
};

export type EnergyInflectionType = "ENERGY_RISE" | "ENERGY_DROP";

/** Local slope event. Full ChangePoint typing lands in Phase 2. */
export type EnergyInflection = {
  time: number;
  type: EnergyInflectionType;
  strength: number;
  confidence: number;
};

/** Local energy maximum. Cue generation is Phase 2 — this is diagnostic only. */
export type EnergyPeak = {
  time: number;
  peakStrength: number;
};

/**
 * 個人 maxDist / モビリティ
 */

import {
  BASE_WALK_RUN_SPEED_MPS,
  type PerformerMobilityProfile,
} from "./types";

export function computePersonalMaxDist(
  availableCounts: number,
  bpm: number,
  songDynamism: number,
  mobilityProfile: PerformerMobilityProfile = {
    id: "",
    mobilityFactor: 1.0,
  }
): number {
  if (bpm <= 0 || availableCounts <= 0) return 0;
  const durationInSeconds = (availableCounts * 60) / bpm;
  const dynamismFactor =
    0.5 + 0.5 * Math.max(0, Math.min(1, songDynamism));
  return (
    durationInSeconds *
    BASE_WALK_RUN_SPEED_MPS *
    dynamismFactor *
    (mobilityProfile.mobilityFactor || 1)
  );
}

import type { FormationCue } from "../types/CueTypes";
import type { MovementTiming } from "../types/MovementTypes";

export function secondsToBeats(seconds: number, bpm: number): number {
  const safeBpm = bpm > 0 ? bpm : 120;
  return Math.max(0, seconds) * (safeBpm / 60);
}

export function beatsToSeconds(beats: number, bpm: number): number {
  const safeBpm = bpm > 0 ? bpm : 120;
  return Math.max(0, beats) * (60 / safeBpm);
}

/**
 * Anticipation → cue time, else previous cue → cue time, else a short default window.
 */
export function resolveMovementTiming(options: {
  cue: FormationCue;
  previousCue?: FormationCue;
  bpm: number;
  anticipationCue?: FormationCue;
}): MovementTiming {
  const { cue, previousCue, bpm, anticipationCue } = options;
  const endTime = cue.rawTime;
  let startTime = endTime;
  if (anticipationCue && anticipationCue.rawTime < endTime) {
    startTime = anticipationCue.rawTime;
  } else if (previousCue && previousCue.rawTime < endTime) {
    startTime = previousCue.rawTime;
  } else {
    startTime = Math.max(0, endTime - beatsToSeconds(4, bpm));
  }
  const availableSeconds = Math.max(0.05, endTime - startTime);
  return {
    startTime,
    endTime,
    availableSeconds,
    availableBeats: secondsToBeats(availableSeconds, bpm),
    bpm: bpm > 0 ? bpm : 120,
  };
}

export function makeMovementTiming(
  startTime: number,
  endTime: number,
  bpm: number
): MovementTiming {
  const availableSeconds = Math.max(0.05, endTime - startTime);
  return {
    startTime,
    endTime,
    availableSeconds,
    availableBeats: secondsToBeats(availableSeconds, bpm),
    bpm: bpm > 0 ? bpm : 120,
  };
}

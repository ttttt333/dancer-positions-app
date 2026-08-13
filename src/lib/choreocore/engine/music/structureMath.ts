import { DEFAULT_BEATS_PER_BAR } from "../constants";
import type {
  AudioFeatureFrame,
  BeatEvent,
  EnergyCurve,
  FrequencyBandEnergy,
  MusicAnalysisResultPhase1,
} from "../types";
import type { MusicStructureConfig } from "../types/MusicTypes";
import { barIndexFromBeatIndex } from "../audio/meter";
import { clamp01 } from "../audio/signalMath";

export type BeatSnapshot = {
  time: number;
  beatIndex: number;
  barIndex: number;
  energy: number;
  onset: number;
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
};

export type TimeSnap = {
  rawTime: number;
  beatTime: number;
  barTime: number;
  beatIndex: number;
  barIndex: number;
  time: number;
};

export function interpolateAt(
  times: number[],
  values: number[],
  time: number
): number {
  if (times.length === 0) return 0;
  if (time <= times[0]!) return values[0]!;
  const last = times.length - 1;
  if (time >= times[last]!) return values[last]!;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= time) lo = mid;
    else hi = mid;
  }
  const t0 = times[lo]!;
  const t1 = times[hi]!;
  const span = t1 - t0;
  if (span <= 1e-12) return values[lo]!;
  const a = (time - t0) / span;
  return values[lo]! * (1 - a) + values[hi]! * a;
}

export function energyAtTime(curve: EnergyCurve, time: number): number {
  return interpolateAt(
    curve.points.map((p) => p.time),
    curve.points.map((p) => p.value),
    time
  );
}

export function nearestFrame(
  frames: AudioFeatureFrame[],
  time: number
): AudioFeatureFrame | null {
  if (frames.length === 0) return null;
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]!.time <= time) lo = mid;
    else hi = mid;
  }
  const a = frames[lo]!;
  const b = frames[hi]!;
  return Math.abs(a.time - time) <= Math.abs(b.time - time) ? a : b;
}

export function prefixSums(values: number[]): Float64Array {
  const out = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i += 1) {
    out[i + 1] = out[i]! + values[i]!;
  }
  return out;
}

export function rangeMean(prefix: Float64Array, start: number, end: number): number {
  const lo = Math.max(0, start);
  const hi = Math.min(prefix.length - 1, end);
  if (hi <= lo) return 0;
  return (prefix[hi]! - prefix[lo]!) / (hi - lo);
}

export function cosineDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na <= 1e-12 && nb <= 1e-12) return 0;
  if (na <= 1e-12 || nb <= 1e-12) return 1;
  const cos = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return clamp01(1 - Math.max(-1, Math.min(1, cos)));
}

export function spectralVector(profile: FrequencyBandEnergy): number[] {
  return [
    profile.bass,
    profile.lowMid,
    profile.mid,
    profile.highMid,
    profile.high,
  ];
}

export function ensureBeatGrid(
  phase1: MusicAnalysisResultPhase1
): BeatEvent[] {
  if (phase1.beats.length >= 2) return phase1.beats;
  const bpm = phase1.tempo.bpm > 0 ? phase1.tempo.bpm : 120;
  const period = 60 / bpm;
  const beats: BeatEvent[] = [];
  let index = 0;
  for (let t = 0; t < phase1.duration - period * 0.25; t += period) {
    beats.push({
      time: t,
      index,
      strength: 0.5,
      beatInBar: index % DEFAULT_BEATS_PER_BAR,
      barIndex: barIndexFromBeatIndex(index),
    });
    index += 1;
  }
  return beats.length > 0
    ? beats
    : [
        {
          time: 0,
          index: 0,
          strength: 0,
          beatInBar: 0,
          barIndex: 0,
        },
      ];
}

export function buildBeatSnapshots(
  phase1: MusicAnalysisResultPhase1
): BeatSnapshot[] {
  const beats = ensureBeatGrid(phase1);
  const energyTimes = phase1.energyCurve.points.map((p) => p.time);
  const energyValues = phase1.energyCurve.points.map((p) => p.value);
  return beats.map((beat) => {
    const frame = nearestFrame(phase1.frames, beat.time);
    return {
      time: beat.time,
      beatIndex: beat.index,
      barIndex: beat.barIndex,
      energy:
        energyTimes.length > 0
          ? interpolateAt(energyTimes, energyValues, beat.time)
          : (frame?.rms ?? 0) * 100,
      onset: frame?.onsetStrength ?? 0,
      bass: frame?.bassEnergy ?? 0,
      lowMid: frame?.lowMidEnergy ?? 0,
      mid: frame?.midEnergy ?? 0,
      highMid: frame?.highMidEnergy ?? 0,
      high: frame?.highEnergy ?? 0,
    };
  });
}

export function snapToBeatGrid(
  rawTime: number,
  beats: BeatEvent[],
  config: MusicStructureConfig
): TimeSnap {
  if (beats.length === 0) {
    return {
      rawTime,
      beatTime: rawTime,
      barTime: rawTime,
      beatIndex: 0,
      barIndex: 0,
      time: rawTime,
    };
  }
  let nearest = beats[0]!;
  let bestD = Math.abs(nearest.time - rawTime);
  for (const beat of beats) {
    const d = Math.abs(beat.time - rawTime);
    if (d < bestD) {
      nearest = beat;
      bestD = d;
    }
  }
  let barBeat = nearest;
  for (const beat of beats) {
    if (beat.barIndex !== nearest.barIndex) continue;
    if (beat.beatInBar === 0) {
      barBeat = beat;
      break;
    }
  }
  const beatPeriod =
    beats.length >= 2 ? Math.abs(beats[1]!.time - beats[0]!.time) : 0.5;
  const tolerance = Math.max(config.beatSnapTolerance, beatPeriod * 0.45);
  const snapped = bestD <= tolerance ? nearest.time : rawTime;
  return {
    rawTime,
    beatTime: nearest.time,
    barTime: barBeat.time,
    beatIndex: nearest.index,
    barIndex: nearest.barIndex,
    time: snapped,
  };
}

export function secondsPerBar(
  phase1: MusicAnalysisResultPhase1,
  beats: BeatEvent[]
): number {
  const bpm = phase1.tempo.bpm > 0 ? phase1.tempo.bpm : 120;
  const fromTempo = (60 / bpm) * DEFAULT_BEATS_PER_BAR;
  if (beats.length < DEFAULT_BEATS_PER_BAR + 1) return fromTempo;
  const a = beats[0]!;
  const b = beats[DEFAULT_BEATS_PER_BAR]!;
  const dt = b.time - a.time;
  return dt > 0.05 ? dt : fromTempo;
}

export function diminishingCombine(values: number[]): number {
  const sorted = [...values].sort((a, b) => b - a);
  const factors = [1, 0.9, 0.7, 0.5, 0.35, 0.2];
  let acc = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    acc += sorted[i]! * (factors[i] ?? 0.12);
  }
  return Math.min(100, acc);
}

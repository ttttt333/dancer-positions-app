/**
 * Legacy Compatibility: peaks / 手書きセグメントから Phase1 形のオブジェクトを作る。
 * Real Phase 1（AudioAnalyzer.analyzeAudio）ではない。
 * bass / onset / high は独立特徴ではなく入力エネルギーの複製に近い。
 */
import { DEFAULT_BEATS_PER_BAR } from "../constants";
import { barIndexFromBeatIndex } from "../audio/meter";
import type {
  AudioFeatureFrame,
  BeatEvent,
  EnergyPoint,
  HitEvent,
  MusicAnalysisResultPhase1,
} from "../types";

export type SyntheticSegment = {
  duration: number;
  energy: number;
  bass: number;
  onset: number;
  high: number;
  mid?: number;
};

export type SyntheticPhase1Options = {
  bpm?: number;
  hopSec?: number;
  sampleRate?: number;
  segments: SyntheticSegment[];
  hits?: Array<{ time: number; strength: number }>;
};

function makeFrame(
  time: number,
  energy: number,
  bass: number,
  onset: number,
  high: number,
  mid: number
): AudioFeatureFrame {
  return {
    time,
    rms: energy / 100,
    spectralFlux: onset * 0.4,
    spectralCentroid: 200 + high * 8000,
    bassEnergy: bass,
    lowMidEnergy: mid * 0.5,
    midEnergy: mid,
    highMidEnergy: high * 0.6,
    highEnergy: high,
    onsetStrength: onset,
  };
}

export function createSyntheticPhase1Analysis(
  options: SyntheticPhase1Options
): MusicAnalysisResultPhase1 {
  const bpm = options.bpm ?? 120;
  const hopSec = options.hopSec ?? 0.1;
  const sampleRate = options.sampleRate ?? 22050;
  const beatPeriod = 60 / bpm;
  const duration = options.segments.reduce((s, seg) => s + seg.duration, 0);
  const frames: AudioFeatureFrame[] = [];
  const points: EnergyPoint[] = [];

  let t = 0;
  let prevEnergy = options.segments[0]?.energy ?? 0;
  let prevDelta = 0;
  for (const seg of options.segments) {
    const end = t + seg.duration;
    const mid = seg.mid ?? 0.15;
    for (let time = t; time < end - hopSec * 0.25; time += hopSec) {
      const energy = seg.energy;
      const delta = energy - prevEnergy;
      const acceleration = delta - prevDelta;
      frames.push(
        makeFrame(time, energy, seg.bass, seg.onset, seg.high, mid)
      );
      points.push({ time, value: energy, delta, acceleration });
      prevDelta = delta;
      prevEnergy = energy;
    }
    t = end;
  }

  const beats: BeatEvent[] = [];
  let index = 0;
  for (let time = 0; time < duration - beatPeriod * 0.25; time += beatPeriod) {
    beats.push({
      time,
      index,
      strength: 0.7,
      beatInBar: index % DEFAULT_BEATS_PER_BAR,
      barIndex: barIndexFromBeatIndex(index),
    });
    index += 1;
  }

  const values = points.map((p) => p.value);
  const peak = values.length === 0 ? 0 : Math.max(...values);
  const min = values.length === 0 ? 0 : Math.min(...values);
  const average =
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

  const hits: HitEvent[] = (options.hits ?? []).map((h, i) => ({
    id: `hit-syn-${i}-${Math.round(h.time * 1000)}`,
    time: h.time,
    strength: h.strength,
    type: "MUSICAL_HIT",
    confidence: 0.7,
  }));

  return {
    duration,
    sampleRate,
    tempo: { bpm, confidence: 0.9 },
    frames,
    energyCurve: {
      points,
      average,
      peak,
      dynamicRange: peak - min,
    },
    beats,
    hits,
    analysisVersion: "3.0.0-phase1",
    confidence: 0.85,
    provenance: "synthetic",
  };
}

export function patternA(): MusicAnalysisResultPhase1 {
  return createSyntheticPhase1Analysis({
    segments: [
      { duration: 8, energy: 22, bass: 0.08, onset: 0.12, high: 0.08 },
      { duration: 8, energy: 82, bass: 0.55, onset: 0.7, high: 0.2 },
    ],
    hits: [{ time: 8, strength: 0.92 }],
  });
}

export function patternB(): MusicAnalysisResultPhase1 {
  return createSyntheticPhase1Analysis({
    segments: [
      { duration: 8, energy: 50, bass: 0.2, onset: 0.4, high: 0.15 },
      { duration: 4, energy: 3, bass: 0.01, onset: 0.02, high: 0.01 },
    ],
  });
}

export function patternC(): MusicAnalysisResultPhase1 {
  return createSyntheticPhase1Analysis({
    segments: [
      { duration: 8, energy: 40, bass: 0.05, onset: 0.3, high: 0.2, mid: 0.2 },
      { duration: 8, energy: 48, bass: 0.7, onset: 0.35, high: 0.12, mid: 0.15 },
    ],
  });
}

export function patternD(): MusicAnalysisResultPhase1 {
  return createSyntheticPhase1Analysis({
    segments: [
      { duration: 8, energy: 35, bass: 0.15, onset: 0.05, high: 0.1 },
      { duration: 8, energy: 45, bass: 0.18, onset: 0.85, high: 0.15 },
    ],
  });
}

export function patternE(): MusicAnalysisResultPhase1 {
  return createSyntheticPhase1Analysis({
    segments: [
      { duration: 8, energy: 45, bass: 0.05, onset: 0.3, high: 0.7, mid: 0.15 },
      { duration: 8, energy: 48, bass: 0.7, onset: 0.32, high: 0.05, mid: 0.12 },
    ],
  });
}

export function patternNoise(): MusicAnalysisResultPhase1 {
  const segments: SyntheticSegment[] = [];
  for (let i = 0; i < 16; i += 1) {
    segments.push({
      duration: 1,
      energy: 40 + ((i % 2) === 0 ? 2 : -2),
      bass: 0.2,
      onset: 0.3,
      high: 0.15,
    });
  }
  return createSyntheticPhase1Analysis({ segments });
}

export function patternWeak(): MusicAnalysisResultPhase1 {
  return createSyntheticPhase1Analysis({
    segments: [
      { duration: 16, energy: 42, bass: 0.18, onset: 0.28, high: 0.16, mid: 0.18 },
    ],
  });
}

export function patternFourBarPhrases(): MusicAnalysisResultPhase1 {
  const segments: SyntheticSegment[] = [];
  for (let i = 0; i < 4; i += 1) {
    segments.push({
      duration: 8,
      energy: i % 2 === 0 ? 35 : 70,
      bass: i % 2 === 0 ? 0.12 : 0.4,
      onset: i % 2 === 0 ? 0.2 : 0.6,
      high: 0.15,
    });
  }
  return createSyntheticPhase1Analysis({ segments });
}

export function patternEightBar(): MusicAnalysisResultPhase1 {
  return createSyntheticPhase1Analysis({
    segments: [
      { duration: 16, energy: 30, bass: 0.1, onset: 0.2, high: 0.1 },
      { duration: 16, energy: 75, bass: 0.45, onset: 0.65, high: 0.2 },
    ],
  });
}

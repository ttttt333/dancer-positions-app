/**
 * FCP 抽出（ブラウザ peaks / 既存 change_points からの正規化）
 */

import type { ChangePoint } from "../types";
import type {
  AudioAnalysisResult,
  FcpMarker,
  SectionType,
} from "./types";

function smooth(arr: number[], w = 10): number[] {
  const half = Math.floor(w / 2);
  return arr.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - half); j < Math.min(arr.length, i + half + 1); j++) {
      s += arr[j]!;
      c += 1;
    }
    return s / c;
  });
}

function estimateBpm(peaks: number[], duration: number): number {
  const n = peaks.length;
  if (n < 16 || duration <= 0) return 120;
  const secPer = duration / n;
  let best = 120;
  let bestC = -Infinity;
  for (let bpm = 60; bpm <= 180; bpm += 1) {
    const lag = Math.round(60 / bpm / secPer);
    if (lag < 1 || lag >= n) continue;
    let corr = 0;
    let c = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += peaks[i]! * peaks[i + lag]!;
      c += 1;
    }
    corr /= c;
    if (corr > bestC) {
      bestC = corr;
      best = bpm;
    }
  }
  return Math.round(best / 5) * 5;
}

function classifySection(
  energy: number,
  t: number,
  duration: number,
  prevEnergy: number,
  attackPeak: boolean
): SectionType {
  const p = t / Math.max(1, duration);
  if (attackPeak) return "se_trigger";
  if (p < 0.08) return "intro";
  if (p > 0.9) return "outro";
  const rise = energy - prevEnergy;
  if (rise >= 0.22 && energy >= 0.55) return "drop";
  if (energy >= 0.62) return "chorus";
  if (energy < 0.28 && p > 0.15 && p < 0.85) return "verse";
  return "verse";
}

/**
 * 波形 peaks から BPM + FCP を抽出。
 * 4エイト格子にスナップし、minCounts 間隔を守る。
 */
export function analyzeAudioForLightingSync(
  peaks: number[],
  durationSec: number,
  minCountsBetweenChanges = 3
): AudioAnalysisResult {
  const duration = Math.max(0.1, durationSec);
  const bpm = estimateBpm(peaks, duration);
  const secPerCount = 60 / Math.max(1, bpm); // 1カウント=1ビート想定
  const totalCounts = Math.max(1, Math.floor(duration / secPerCount));
  const smoothed = smooth(peaks, 12);
  const n = smoothed.length;

  // 正規化エネルギー
  let amin = Infinity;
  let amax = -Infinity;
  for (const v of smoothed) {
    if (v < amin) amin = v;
    if (v > amax) amax = v;
  }
  const span = amax - amin + 1e-8;
  const norm = smoothed.map((v) => (v - amin) / span);

  // アタック検出（短時間急上昇）
  const attacks: number[] = [];
  for (let i = 4; i < n - 4; i++) {
    const rise = norm[i]! - norm[i - 3]!;
    if (rise > 0.28 && norm[i]! > 0.45) {
      attacks.push((i / Math.max(1, n - 1)) * duration);
    }
  }

  // 4エイト = 32カウント ブロック
  const blockCounts = 32;
  const fcpMarkers: FcpMarker[] = [];
  let prevEnergy = 0;
  let lastCount = -minCountsBetweenChanges;

  for (let count = 0; count + blockCounts <= totalCounts; count += blockCounts) {
    const t0 = count * secPerCount;
    const t1 = Math.min(duration, (count + blockCounts) * secPerCount);
    const i0 = Math.floor((t0 / duration) * (n - 1));
    const i1 = Math.ceil((t1 / duration) * (n - 1));
    let sum = 0;
    let c = 0;
    for (let i = i0; i <= i1 && i < n; i++) {
      sum += norm[i]!;
      c += 1;
    }
    const energy = c > 0 ? sum / c : 0;
    const nearAttack = attacks.some((a) => a >= t0 && a < t0 + secPerCount * 4);
    const sectionType = classifySection(
      energy,
      t0,
      duration,
      prevEnergy,
      nearAttack && energy > 0.4
    );

    // intro は count=0 を必ず含める
    const isFirst = count === 0;
    const isBoundary =
      isFirst ||
      sectionType === "chorus" ||
      sectionType === "drop" ||
      sectionType === "se_trigger" ||
      sectionType === "outro" ||
      (sectionType === "verse" && count % (blockCounts * 2) === 0);

    if (!isBoundary) {
      prevEnergy = energy;
      continue;
    }
    if (!isFirst && count - lastCount < minCountsBetweenChanges) {
      prevEnergy = energy;
      continue;
    }

    fcpMarkers.push({
      fcpId: `fcp_${String(fcpMarkers.length + 1).padStart(2, "0")}`,
      timestamp: Math.round(t0 * 100) / 100,
      countNumber: count + 1,
      sectionType: isFirst ? "intro" : sectionType,
      energyLevel: Math.round(energy * 1000) / 1000,
    });
    lastCount = count;
    prevEnergy = energy;
  }

  // 最低1点
  if (fcpMarkers.length === 0) {
    fcpMarkers.push({
      fcpId: "fcp_01",
      timestamp: 0,
      countNumber: 1,
      sectionType: "intro",
      energyLevel: 0.3,
    });
  }

  return { bpm, duration, totalCounts, fcpMarkers };
}

/** 既存 ChangePoint / CHORUS_* を仕様の SectionType FCP に変換 */
export function changePointsToFcpMarkers(
  changePoints: ChangePoint[],
  bpm: number,
  duration: number,
  minCountsBetweenChanges: number
): FcpMarker[] {
  const secPerCount = 60 / Math.max(1, bpm);
  const out: FcpMarker[] = [];
  let lastCount = -minCountsBetweenChanges;

  // 先頭 intro
  out.push({
    fcpId: "fcp_01",
    timestamp: 0,
    countNumber: 1,
    sectionType: "intro",
    energyLevel: 0.25,
  });
  lastCount = 1;

  for (const cp of [...changePoints].sort((a, b) => a.time - b.time)) {
    const count = Math.max(1, Math.round(cp.time / secPerCount) + 1);
    if (count - lastCount < minCountsBetweenChanges) continue;

    let sectionType: SectionType = "verse";
    const st = String(cp.section_type ?? "").toUpperCase();
    if (st === "INTRO") sectionType = "intro";
    else if (st === "CHORUS_START" || st === "CHORUS") sectionType = "chorus";
    else if (st === "DROP") sectionType = "drop";
    else if (st === "OUTRO") sectionType = "outro";
    else if (st === "SE_TRIGGER" || st === "SE" || st === "PRE_CHORUS")
      sectionType = "se_trigger";
    else if (cp.score >= 0.78 && cp.tier === "major") sectionType = "drop";
    else if (cp.time / Math.max(1, duration) > 0.9) sectionType = "outro";
    else sectionType = "verse";

    out.push({
      fcpId: `fcp_${String(out.length + 1).padStart(2, "0")}`,
      timestamp: Math.round(cp.time * 100) / 100,
      countNumber: count,
      sectionType,
      energyLevel: Math.min(1, Math.max(0, cp.score)),
    });
    lastCount = count;
  }

  return out;
}

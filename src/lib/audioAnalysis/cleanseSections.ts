/**
 * 細切れセクションの統合・最小長担保。
 */

import type { MusicSection, SectionType } from "../../types/audioAnalysis";
import { sectionDisplayMeta } from "./sectionMeta";
import { secondsPerEightCount } from "./evenBeatGrid";

export type CleanseSectionsOpts = {
  duration: number;
  bpm?: number;
  /** 省略時は max(8s, 2×8カウント) を曲長でキャップ */
  minDurationSec?: number;
};

function resolveMinDuration(opts: CleanseSectionsOpts): number {
  if (opts.minDurationSec != null && opts.minDurationSec > 0) {
    return opts.minDurationSec;
  }
  const bpm = opts.bpm && opts.bpm > 0 ? opts.bpm : 120;
  const twoEights = secondsPerEightCount(bpm) * 2;
  const target = Math.max(8, twoEights);
  // 短いクリップでは曲の ~12% まで落とす（最低 2s）
  return Math.min(target, Math.max(2, opts.duration * 0.12));
}

/** 連続する同一 type を結合 */
export function mergeAdjacentSameType(sections: MusicSection[]): MusicSection[] {
  if (sections.length === 0) return sections;
  const sorted = [...sections].sort((a, b) => a.startTime - b.startTime);
  const out: MusicSection[] = [];
  for (const s of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.type === s.type) {
      prev.endTime = Math.max(prev.endTime, s.endTime);
      if (s.bpm != null) prev.bpm = s.bpm;
      continue;
    }
    out.push({ ...s });
  }
  return out;
}

/**
 * minDuration 未満を隣接へ吸収。
 * 前後がある場合は長い方（同長なら前）へマージ。
 */
export function absorbShortSections(
  sections: MusicSection[],
  minDurationSec: number
): MusicSection[] {
  if (sections.length <= 1) return sections;
  let list = sections.map((s) => ({ ...s }));
  let changed = true;
  let guard = 0;
  while (changed && guard < 64) {
    guard += 1;
    changed = false;
    for (let i = 0; i < list.length; i += 1) {
      const s = list[i]!;
      const span = s.endTime - s.startTime;
      if (span >= minDurationSec - 1e-6) continue;
      if (list.length === 1) break;

      const prev = i > 0 ? list[i - 1]! : null;
      const next = i < list.length - 1 ? list[i + 1]! : null;
      if (!prev && !next) break;

      const prevSpan = prev ? prev.endTime - prev.startTime : -1;
      const nextSpan = next ? next.endTime - next.startTime : -1;
      const mergeIntoPrev = !next || (prev != null && prevSpan >= nextSpan);

      if (mergeIntoPrev && prev) {
        prev.endTime = Math.max(prev.endTime, s.endTime);
        list.splice(i, 1);
      } else if (next) {
        next.startTime = Math.min(next.startTime, s.startTime);
        list.splice(i, 1);
      }
      changed = true;
      break;
    }
    if (changed) list = mergeAdjacentSameType(list);
  }
  return list;
}

/** 隙間を埋め、0〜duration をカバー */
export function fillSectionGaps(
  sections: MusicSection[],
  duration: number
): MusicSection[] {
  if (!(duration > 0)) return sections;
  let list = mergeAdjacentSameType(
    [...sections].sort((a, b) => a.startTime - b.startTime)
  );
  if (list.length === 0) return list;

  list[0]!.startTime = 0;
  list[list.length - 1]!.endTime = duration;

  for (let i = 0; i < list.length - 1; i += 1) {
    const a = list[i]!;
    const b = list[i + 1]!;
    if (b.startTime > a.endTime) {
      // 隙間は前セクションを伸ばす
      a.endTime = b.startTime;
    } else if (b.startTime < a.endTime) {
      b.startTime = a.endTime;
    }
  }
  list[list.length - 1]!.endTime = duration;
  return list.filter((s) => s.endTime - s.startTime > 0.05);
}

/**
 * マージ → 短尺吸収 → 再マージ → 隙間埋め。
 */
export function cleanseMusicSections(
  sections: MusicSection[],
  opts: CleanseSectionsOpts
): MusicSection[] {
  if (!sections.length || !(opts.duration > 0)) return sections;
  const minDur = resolveMinDuration(opts);
  let list = mergeAdjacentSameType(sections);
  list = absorbShortSections(list, minDur);
  list = mergeAdjacentSameType(list);
  list = fillSectionGaps(list, opts.duration);
  // ラベルを type に合わせて正規化
  return list.map((s) => {
    const meta = sectionDisplayMeta(s.type);
    return {
      ...s,
      label: meta.label,
      color: meta.color,
    };
  });
}

/** フォールバック用: 構成比率＋相対エネルギーでラベル割当 */
export function buildFormRatioSections(opts: {
  duration: number;
  bpm: number;
  /** 0..1 のエネルギー時系列（任意）。無い場合は構成比率のみ */
  energyByTime?: (tSec: number) => number;
}): MusicSection[] {
  const { duration, bpm } = opts;
  if (!(duration > 0)) return [];

  const eight = secondsPerEightCount(bpm);
  const block = Math.max(eight * 2, 8); // 2エイト or 8秒
  const edges: number[] = [0];
  for (let t = block; t < duration - block * 0.5; t += block) {
    edges.push(Math.round(t * 1000) / 1000);
  }
  edges.push(duration);

  type Soft = { start: number; end: number; energy: number };
  const soft: Soft[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const start = edges[i]!;
    const end = edges[i + 1]!;
    const mid = (start + end) / 2;
    const energy = opts.energyByTime ? opts.energyByTime(mid) : 0.5;
    soft.push({ start, end, energy });
  }
  if (soft.length === 0) {
    return [
      {
        id: "form-all",
        type: "verse",
        label: sectionDisplayMeta("verse").label,
        startTime: 0,
        endTime: duration,
        color: sectionDisplayMeta("verse").color,
        bpm,
      },
    ];
  }

  const energies = soft.map((s) => s.energy).sort((a, b) => a - b);
  const p80 = energies[Math.floor((energies.length - 1) * 0.8)] ?? 0.7;

  const types: SectionType[] = soft.map((s, i) => {
    const frac = s.start / duration;
    if (i === 0) return "intro";
    if (i === soft.length - 1) return "outro";
    if (s.energy >= p80 && frac > 0.15 && frac < 0.9) return "chorus";
    if (frac < 0.35) return "verse";
    if (frac < 0.45) return "pre_chorus";
    if (frac < 0.75) return "verse";
    return "bridge";
  });

  // サビの直前ブロックを Bメロへ
  for (let i = 1; i < types.length; i += 1) {
    if (types[i] === "chorus" && types[i - 1] === "verse") {
      types[i - 1] = "pre_chorus";
    }
  }

  const sections: MusicSection[] = soft.map((s, i) => {
    const type = types[i]!;
    const meta = sectionDisplayMeta(type);
    return {
      id: `form-${i}`,
      type,
      label: meta.label,
      startTime: s.start,
      endTime: s.end,
      color: meta.color,
      bpm,
    };
  });

  return cleanseMusicSections(sections, { duration, bpm });
}

/** peaks 配列から時刻 t の近似エネルギー */
export function energyAtFromPeaks(
  peaks: number[],
  duration: number,
  tSec: number
): number {
  if (!peaks.length || !(duration > 0)) return 0.5;
  const idx = Math.max(
    0,
    Math.min(peaks.length - 1, Math.floor((tSec / duration) * peaks.length))
  );
  return peaks[idx] ?? 0.5;
}

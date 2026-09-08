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
  // 最低 8秒 または 4小節（= 2×8カウント）相当
  const fourBars = secondsPerEightCount(bpm) * 2;
  const target = Math.max(8, fourBars);
  // 短いクリップでは曲の ~10% まで落とす（最低 2.5s）
  return Math.min(target, Math.max(2.5, opts.duration * 0.1));
}

/**
 * EDIT 曲でサビが大半を占めるとき、余剰サビを Aメロ/ブリッジへ降格。
 * 単一の長大サビは中盤だけ残して前後を分割する。
 */
export function rebalanceChorusHeavySections(
  sections: MusicSection[],
  duration: number,
  maxChorusFraction = 0.42
): MusicSection[] {
  if (!(duration > 0) || sections.length === 0) return sections;
  let list = mergeAdjacentSameType(sections.map((s) => ({ ...s })));
  const maxChorusSec = duration * maxChorusFraction;

  const chorusDur = list
    .filter((s) => s.type === "chorus")
    .reduce((acc, s) => acc + Math.max(0, s.endTime - s.startTime), 0);
  if (chorusDur <= maxChorusSec + 1e-6) return list;

  const next: MusicSection[] = [];
  for (const s of list) {
    if (s.type !== "chorus") {
      next.push(s);
      continue;
    }
    const span = Math.max(0, s.endTime - s.startTime);
    if (span <= maxChorusSec + 1e-6) {
      next.push(s);
      continue;
    }
    // 長大サビ: 中盤 maxChorusSec だけ残し、前後を verse / bridge に
    const keep = maxChorusSec;
    const mid = (s.startTime + s.endTime) / 2;
    let keepStart = mid - keep / 2;
    let keepEnd = mid + keep / 2;
    if (keepStart < s.startTime) {
      keepStart = s.startTime;
      keepEnd = s.startTime + keep;
    }
    if (keepEnd > s.endTime) {
      keepEnd = s.endTime;
      keepStart = s.endTime - keep;
    }
    keepStart = Math.max(s.startTime, keepStart);
    keepEnd = Math.min(s.endTime, keepEnd);

    if (keepStart - s.startTime > 0.25) {
      const type: SectionType =
        (s.startTime + keepStart) / 2 / duration < 0.45 ? "verse" : "pre_chorus";
      const meta = sectionDisplayMeta(type);
      next.push({
        ...s,
        id: `${s.id}-pre`,
        type,
        label: meta.label,
        color: meta.color,
        startTime: s.startTime,
        endTime: keepStart,
      });
    }
    next.push({
      ...s,
      startTime: keepStart,
      endTime: keepEnd,
    });
    if (s.endTime - keepEnd > 0.25) {
      const midFrac = (keepEnd + s.endTime) / 2 / duration;
      const type: SectionType =
        midFrac < 0.7 ? "verse" : midFrac < 0.88 ? "bridge" : "outro";
      const meta = sectionDisplayMeta(type);
      next.push({
        ...s,
        id: `${s.id}-post`,
        type,
        label: meta.label,
        color: meta.color,
        startTime: keepEnd,
        endTime: s.endTime,
      });
    }
  }

  // 複数サビが残ってなお超過なら、中盤以外を降格
  list = mergeAdjacentSameType(next);
  let cDur = list
    .filter((s) => s.type === "chorus")
    .reduce((acc, s) => acc + Math.max(0, s.endTime - s.startTime), 0);
  if (cDur <= maxChorusSec + 1e-6) return list;

  const ranked = list
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.type === "chorus")
    .sort((a, b) => {
      const midA = (a.s.startTime + a.s.endTime) / 2 / duration;
      const midB = (b.s.startTime + b.s.endTime) / 2 / duration;
      return Math.abs(midA - 0.55) - Math.abs(midB - 0.55);
    });

  let kept = 0;
  const keepIds = new Set<string>();
  for (const { s } of ranked) {
    const span = Math.max(0, s.endTime - s.startTime);
    if (kept > maxChorusSec * 0.9 && keepIds.size >= 1) break;
    keepIds.add(s.id);
    kept += span;
  }

  list = list.map((s) => {
    if (s.type !== "chorus" || keepIds.has(s.id)) return s;
    const mid = (s.startTime + s.endTime) / 2 / duration;
    const type: SectionType =
      mid < 0.4 ? "verse" : mid < 0.55 ? "pre_chorus" : mid < 0.78 ? "verse" : "bridge";
    const meta = sectionDisplayMeta(type);
    return { ...s, type, label: meta.label, color: meta.color };
  });

  return mergeAdjacentSameType(list);
}

/**
 * マージ → 短尺吸収 → 再マージ → 隙間埋め → サビ過多の再配分。
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
  list = rebalanceChorusHeavySections(list, opts.duration);
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
 * 解析不良の典型: 全曲サビ1本 / 同一 type だけ / サビが曲の大半。
 * このときキーフレームも1本になり、波形上も「全部サビ」に見える。
 */
export function isDegenerateSectionLayout(
  sections: MusicSection[],
  duration: number
): boolean {
  if (!(duration > 0) || sections.length === 0) return true;
  if (sections.length === 1) {
    const only = sections[0]!;
    return only.type === "chorus" || only.type === "unknown";
  }
  const types = new Set(sections.map((s) => s.type));
  if (types.size === 1) return true;

  let chorusDur = 0;
  for (const s of sections) {
    if (s.type === "chorus") {
      chorusDur += Math.max(0, s.endTime - s.startTime);
    }
  }
  return chorusDur / duration >= 0.72;
}

/**
 * 不良レイアウトなら構成比率フォールバックへ差し替え。
 * peaks があればエネルギーでサビ位置を寄せる。
 */
export function repairDegenerateSections(opts: {
  sections: MusicSection[];
  duration: number;
  bpm?: number;
  peaks?: number[];
}): MusicSection[] {
  const { sections, duration } = opts;
  if (!isDegenerateSectionLayout(sections, duration)) return sections;
  const bpm = opts.bpm && opts.bpm > 0 ? opts.bpm : 120;
  return buildFormRatioSections({
    duration,
    bpm,
    energyByTime:
      opts.peaks && opts.peaks.length > 0
        ? (t) => energyAtFromPeaks(opts.peaks!, duration, t)
        : undefined,
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
  const p90 = energies[Math.floor((energies.length - 1) * 0.9)] ?? p80;
  const energySpread =
    (energies[energies.length - 1] ?? 0) - (energies[0] ?? 0);
  // 相対上位（明確なピークがあるときだけ）。平坦なら構成比率のみ。
  const chorusFloor =
    energySpread >= 0.12 ? Math.max(p90, p80 + 1e-6) : Number.POSITIVE_INFINITY;

  const types: SectionType[] = soft.map((s, i) => {
    const frac = s.start / duration;
    if (i === 0) return "intro";
    if (i === soft.length - 1) return "outro";
    if (s.energy >= chorusFloor && frac > 0.15 && frac < 0.9) return "chorus";
    if (frac < 0.35) return "verse";
    if (frac < 0.45) return "pre_chorus";
    if (frac < 0.75) return "verse";
    return "bridge";
  });

  // エネルギーでサビが取れなければ、中盤の最高エネルギー枠を1本サビにする
  if (!types.includes("chorus") && soft.length >= 3) {
    let best = 1;
    for (let i = 1; i < soft.length - 1; i += 1) {
      const frac = soft[i]!.start / duration;
      if (frac <= 0.15 || frac >= 0.9) continue;
      if (soft[i]!.energy > soft[best]!.energy) best = i;
    }
    types[best] = "chorus";
  }

  // サビが曲の大半になる場合は上位エネルギー枠だけ残す
  const chorusIdx = types
    .map((t, i) => (t === "chorus" ? i : -1))
    .filter((i) => i >= 0);
  if (chorusIdx.length > 0) {
    const chorusDur = chorusIdx.reduce(
      (acc, i) => acc + (soft[i]!.end - soft[i]!.start),
      0
    );
    if (chorusDur / duration > 0.45) {
      const ranked = [...chorusIdx].sort(
        (a, b) => soft[b]!.energy - soft[a]!.energy
      );
      const keep = new Set<number>();
      let keptDur = 0;
      for (const i of ranked) {
        if (keptDur / duration > 0.35 && keep.size >= 1) break;
        keep.add(i);
        keptDur += soft[i]!.end - soft[i]!.start;
      }
      for (const i of chorusIdx) {
        if (keep.has(i)) continue;
        const frac = soft[i]!.start / duration;
        types[i] = frac < 0.45 ? "verse" : frac < 0.75 ? "verse" : "bridge";
      }
    }
  }

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

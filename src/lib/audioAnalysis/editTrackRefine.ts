/**
 * EDIT/MIX 音源向け: 無音カット境界 + エネルギー（ボーカル近似）で
 * Verse/Chorus を現場感覚に寄せる。
 *
 * 真のステム分離が無い環境では peaks 包絡を「声＋伴奏」の代理とする。
 */

import type { MusicSection, SectionType } from "../../types/audioAnalysis";
import { sectionDisplayMeta } from "./sectionMeta";
import { energyAtFromPeaks } from "./cleanseSections";
import { mergeAdjacentSameType } from "./cleanseSections";

export type SilenceCut = { startSec: number; endSec: number };

/**
 * peaks から無音区間を検出（EDIT の強制カット）。
 * 返り値は無音の [start,end)。再開点 end がセクション境界候補。
 */
export function detectSilenceCuts(
  peaks: number[],
  duration: number,
  opts?: { threshold?: number; minSilenceSec?: number }
): SilenceCut[] {
  if (!peaks.length || !(duration > 0)) return [];
  const threshold = opts?.threshold ?? 0.045;
  const minSilenceSec = opts?.minSilenceSec ?? 0.18;
  const cuts: SilenceCut[] = [];
  let silentStart: number | null = null;

  for (let i = 0; i < peaks.length; i += 1) {
    const t = (i / peaks.length) * duration;
    const quiet = (peaks[i] ?? 0) < threshold;
    if (quiet && silentStart == null) silentStart = t;
    if (!quiet && silentStart != null) {
      const end = t;
      if (end - silentStart >= minSilenceSec) {
        cuts.push({ startSec: silentStart, endSec: end });
      }
      silentStart = null;
    }
  }
  if (silentStart != null) {
    const end = duration;
    if (end - silentStart >= minSilenceSec) {
      cuts.push({ startSec: silentStart, endSec: end });
    }
  }
  return cuts;
}

function typeAtFrac(frac: number, energy: number, p75: number): SectionType {
  if (frac < 0.08) return "intro";
  if (frac > 0.92) return "outro";
  if (energy >= p75 && frac > 0.12 && frac < 0.9) return "chorus";
  if (frac < 0.38) return "verse";
  if (frac < 0.48) return "pre_chorus";
  if (frac < 0.78) return "verse";
  return "bridge";
}

/**
 * 無音カットで強制分割し、再開後の高エネルギー帯をサビ寄りに、
 * 低エネルギー帯の誤サビを Verse へ降格する。
 */
export function refineSectionsForEditTrack(opts: {
  sections: MusicSection[];
  peaks: number[];
  duration: number;
  bpm?: number;
}): MusicSection[] {
  const { sections, peaks, duration } = opts;
  if (!(duration > 0) || sections.length === 0) return sections;

  const cuts = detectSilenceCuts(peaks, duration);
  let list = mergeAdjacentSameType(sections.map((s) => ({ ...s })));

  // 無音終了点で強制分割（再開＝新しいセクション頭）
  // ここでは同型マージしない（無音を跨いで結合されると意味が消える）
  for (const cut of cuts) {
    const resume = cut.endSec;
    if (resume <= 0.05 || resume >= duration - 0.05) continue;
    const next: MusicSection[] = [];
    for (const s of list) {
      if (s.startTime + 0.05 < resume && resume < s.endTime - 0.05) {
        const leftType = s.type;
        const rightEnergy = energyAtFromPeaks(peaks, duration, resume + 0.25);
        const energies = peaks.slice().sort((a, b) => a - b);
        const p75 = energies[Math.floor((energies.length - 1) * 0.75)] ?? 0.5;
        const rightType: SectionType =
          rightEnergy >= p75 ? "chorus" : leftType === "chorus" ? "verse" : leftType;
        const leftMeta = sectionDisplayMeta(leftType);
        const rightMeta = sectionDisplayMeta(rightType);
        next.push({
          ...s,
          endTime: resume,
          label: leftMeta.label,
          color: leftMeta.color,
        });
        next.push({
          ...s,
          id: `${s.id}-after-silence-${Math.round(resume * 100)}`,
          startTime: resume,
          type: rightType,
          label: rightMeta.label,
          color: rightMeta.color,
        });
      } else {
        next.push(s);
      }
    }
    list = next;
  }

  // 低エネルギーな「偽サビ」を Verse へ（ボーカル近似エネルギー不足）
  const energies = peaks.slice().sort((a, b) => a - b);
  const p60 = energies[Math.floor((energies.length - 1) * 0.6)] ?? 0.35;
  const p75 = energies[Math.floor((energies.length - 1) * 0.75)] ?? 0.5;
  list = list.map((s) => {
    if (s.type !== "chorus") return s;
    const mid = (s.startTime + s.endTime) / 2;
    const e = energyAtFromPeaks(peaks, duration, mid);
    if (e >= p60) return s;
    const type: SectionType = mid / duration < 0.5 ? "verse" : "bridge";
    const meta = sectionDisplayMeta(type);
    return { ...s, type, label: meta.label, color: meta.color };
  });

  // 歌声オンセット近似: 急上昇ピークを Verse（Aメロ）開始候補に
  const vocalOnsets = detectVocalEnergyOnsets(peaks, duration);
  for (const onset of vocalOnsets.slice(0, 4)) {
    list = list.map((s) => {
      if (Math.abs(s.startTime - onset) > 0.55) return s;
      if (s.type === "chorus" || s.type === "outro") return s;
      const e = energyAtFromPeaks(peaks, duration, onset + 0.35);
      // 高エネルギー急上昇はサビ、中程度は Verse
      if (e >= p75) {
        const meta = sectionDisplayMeta("chorus");
        return { ...s, type: "chorus", label: meta.label, color: meta.color };
      }
      const meta = sectionDisplayMeta("verse");
      return { ...s, type: "verse", label: meta.label, color: meta.color };
    });
  }

  // 無音直後の高エネルギー再開が chorus でない場合、昇格
  for (const cut of cuts) {
    const resume = cut.endSec;
    const e = energyAtFromPeaks(peaks, duration, resume + 0.2);
    if (e < p60 + 0.08) continue;
    list = list.map((s) => {
      if (Math.abs(s.startTime - resume) > 0.35) return s;
      if (s.type === "chorus") return s;
      const meta = sectionDisplayMeta("chorus");
      return { ...s, type: "chorus", label: meta.label, color: meta.color };
    });
  }

  return mergeAdjacentSameTypePreservingCuts(
    list,
    cuts.map((c) => c.endSec)
  );
}

/** 無音再開境界では同型でもマージしない */
function mergeAdjacentSameTypePreservingCuts(
  sections: MusicSection[],
  protectedEdges: number[]
): MusicSection[] {
  if (sections.length === 0) return sections;
  const sorted = [...sections].sort((a, b) => a.startTime - b.startTime);
  const out: MusicSection[] = [];
  for (const s of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.type === s.type) {
      const atCut = protectedEdges.some(
        (e) => Math.abs(prev.endTime - e) < 0.08
      );
      if (!atCut) {
        prev.endTime = Math.max(prev.endTime, s.endTime);
        if (s.bpm != null) prev.bpm = s.bpm;
        continue;
      }
    }
    out.push({ ...s });
  }
  return out;
}

/**
 * peaks 包絡の急上昇を「ボーカル入」近似として検出。
 * 真の stem 分離が無い前提の現場ヒューリスティック。
 */
export function detectVocalEnergyOnsets(
  peaks: number[],
  duration: number,
  opts?: { minRise?: number; minGapSec?: number }
): number[] {
  if (peaks.length < 8 || !(duration > 0)) return [];
  const minRise = opts?.minRise ?? 0.22;
  const minGapSec = opts?.minGapSec ?? 4;
  const window = Math.max(2, Math.floor(peaks.length * 0.012));
  const onsets: number[] = [];
  let lastT = -minGapSec;
  for (let i = window; i < peaks.length - window; i += 1) {
    let before = 0;
    let after = 0;
    for (let k = 0; k < window; k += 1) {
      before += peaks[i - window + k] ?? 0;
      after += peaks[i + k] ?? 0;
    }
    before /= window;
    after /= window;
    const rise = after - before;
    if (rise < minRise) continue;
    const t = (i / peaks.length) * duration;
    if (t - lastT < minGapSec) continue;
    // 曲頭・曲末はイントロ/アウトロ扱い（極端に端だけ除外）
    if (t < duration * 0.02 || t > duration * 0.98) continue;
    onsets.push(t);
    lastT = t;
  }
  return onsets;
}

/** フォールバック用: 無音＋エネルギーだけでラベルを振り直す */
export function buildEditAwareFormSections(opts: {
  duration: number;
  bpm: number;
  peaks: number[];
}): MusicSection[] {
  const { duration, bpm, peaks } = opts;
  if (!(duration > 0)) return [];
  const cuts = detectSilenceCuts(peaks, duration, { minSilenceSec: 0.15 });
  const edges = new Set<number>([0, duration]);
  for (const c of cuts) {
    if (c.endSec > 0.2 && c.endSec < duration - 0.2) edges.add(c.endSec);
  }
  // 均等ブロックも足す
  const block = Math.max(8, (60 / Math.max(1, bpm)) * 16);
  for (let t = block; t < duration - block * 0.4; t += block) {
    edges.add(Math.round(t * 1000) / 1000);
  }
  const sorted = [...edges].sort((a, b) => a - b);
  const soft: { start: number; end: number; energy: number }[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i]!;
    const end = sorted[i + 1]!;
    if (end - start < 1.2) continue;
    soft.push({
      start,
      end,
      energy: energyAtFromPeaks(peaks, duration, (start + end) / 2),
    });
  }
  if (soft.length === 0) {
    const meta = sectionDisplayMeta("verse");
    return [
      {
        id: "edit-all",
        type: "verse",
        label: meta.label,
        startTime: 0,
        endTime: duration,
        color: meta.color,
        bpm,
      },
    ];
  }
  const energies = soft.map((s) => s.energy).sort((a, b) => a - b);
  const p75 = energies[Math.floor((energies.length - 1) * 0.75)] ?? 0.55;
  return soft.map((s, i) => {
    const type = typeAtFrac(s.start / duration, s.energy, p75);
    const meta = sectionDisplayMeta(type);
    return {
      id: `edit-${i}`,
      type,
      label: meta.label,
      startTime: s.start,
      endTime: s.end,
      color: meta.color,
      bpm,
    };
  });
}

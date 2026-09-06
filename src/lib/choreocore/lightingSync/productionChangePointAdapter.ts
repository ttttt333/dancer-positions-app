/**
 * UnifiedMusicTimeline / StructureResultV2 → 既存 Production ChangePoint。
 * Cue promote・select・波形オーバーレイの互換用。
 */
import type { ChangePoint as AppChangePoint, SectionType } from "../types";
import type { MusicSectionType } from "../engine/types/MusicTypes";
import type { UnifiedMusicTimeline } from "../engine/music/productionTimeline";
import type {
  SectionLabelV2,
  SongSectionV2,
  StructureResultV2,
} from "../types/songStructure";

/** この秒数より前の「初サビ」は、後続サビがあるとき VERSE に降格（序盤サビ頭誤爆抑制） */
export const EARLY_CHORUS_GUARD_SEC = 16;

function eightSec(bpm: number): number {
  return 8 * (60 / Math.max(1, bpm));
}

function sectionTypeToApp(
  type: MusicSectionType,
  isFirstChorus: boolean
): SectionType {
  if (type === "INTRO") return "INTRO";
  if (type === "OUTRO") return "OUTRO";
  if (type === "DROP") return "DROP";
  if (type === "PRE_CHORUS") return "PRE_CHORUS";
  if (type === "CHORUS" || type === "FINAL_CHORUS") {
    return isFirstChorus ? "CHORUS_START" : "CHORUS";
  }
  if (type === "BREAK" || type === "BRIDGE") return "SE_TRIGGER";
  return "VERSE";
}

function tierForApp(sectionType: SectionType): AppChangePoint["tier"] {
  if (
    sectionType === "CHORUS_START" ||
    sectionType === "CHORUS" ||
    sectionType === "DROP"
  ) {
    return "major";
  }
  if (sectionType === "PRE_CHORUS") return "medium";
  return "minor";
}

function labelV2ToAppSectionType(
  label: SectionLabelV2,
  isFirstChorus: boolean
): SectionType {
  switch (label) {
    case "INTRO":
      return "INTRO";
    case "OUTRO":
      return "OUTRO";
    case "A_MELO":
      return "VERSE";
    case "B_MELO":
      return "PRE_CHORUS";
    case "BREAKDOWN":
      return "SE_TRIGGER";
    case "CHORUS":
      return isFirstChorus ? "CHORUS_START" : "CHORUS";
    default:
      return "VERSE";
  }
}

/**
 * 隣接かつ同ラベル・同クラスタのセクションを結合（v2 の細切れ境界を抑える）。
 */
export function mergeAdjacentSongSectionsV2(
  sections: SongSectionV2[]
): SongSectionV2[] {
  if (sections.length === 0) return [];
  const sorted = [...sections].sort((a, b) => a.start_time - b.start_time);
  const out: SongSectionV2[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      last.label === s.label &&
      last.cluster_id === s.cluster_id &&
      Math.abs(last.end_time - s.start_time) < 1.5
    ) {
      out[out.length - 1] = {
        ...last,
        end_eight: s.end_eight,
        end_time: s.end_time,
        mean_energy: Math.max(last.mean_energy, s.mean_energy),
        energy_trend: s.energy_trend,
        repeat_count: Math.max(last.repeat_count, s.repeat_count),
        confidence: Math.max(last.confidence, s.confidence),
      };
      continue;
    }
    out.push({ ...s });
  }
  return out;
}

/**
 * StructureResultV2 → AppChangePoint[]。
 * sections を優先（ラベルが安定）。change_points はフォールバック。
 */
export function appChangePointsFromStructureV2(
  v2: StructureResultV2 | null | undefined,
  opts?: { earlyChorusGuardSec?: number }
): AppChangePoint[] | undefined {
  if (!v2) return undefined;
  const guardSec = opts?.earlyChorusGuardSec ?? EARLY_CHORUS_GUARD_SEC;
  const bpm = v2.bpm > 0 ? v2.bpm : 120;
  const step = eightSec(bpm);

  if (v2.sections?.length) {
    const merged = mergeAdjacentSongSectionsV2(v2.sections);
    const hasLaterChorus = merged.some(
      (s) => s.label === "CHORUS" && s.start_time >= guardSec
    );
    let seenChorus = false;
    const out: AppChangePoint[] = [];

    for (let i = 0; i < merged.length; i += 1) {
      const s = merged[i]!;
      const prev = merged[i - 1];
      let section_type = labelV2ToAppSectionType(s.label, !seenChorus);

      if (s.label === "CHORUS" && !seenChorus) {
        const early = s.start_time < guardSec;
        const precededByBuild =
          prev?.label === "B_MELO" || prev?.label === "A_MELO";
        if (early && hasLaterChorus && !precededByBuild) {
          // 序盤の疑似サビ → Aメロ扱いに降格
          section_type = "VERSE";
        } else {
          section_type = "CHORUS_START";
          seenChorus = true;
        }
      } else if (s.label === "CHORUS" && seenChorus) {
        section_type = "CHORUS";
      }

      out.push({
        eight_index: Math.max(0, Math.floor(s.start_time / step)),
        time: s.start_time,
        score: Math.max(0.2, Math.min(1, s.confidence)),
        tier: tierForApp(section_type),
        section_type,
      });
    }

    return out.length > 0
      ? out.sort((a, b) => a.time - b.time || a.eight_index - b.eight_index)
      : undefined;
  }

  // change_points フォールバック
  if (!v2.change_points?.length) return undefined;
  let seenChorus = false;
  const hasLaterChorus = v2.change_points.some(
    (cp) =>
      (cp.type === "CHORUS_START" || cp.type === "CHORUS") &&
      cp.time >= guardSec
  );
  const out: AppChangePoint[] = [];
  for (const cp of [...v2.change_points].sort((a, b) => a.time - b.time)) {
    let section_type = mapV2ChangeType(cp.type, !seenChorus);
    if (
      (cp.type === "CHORUS_START" || cp.type === "CHORUS") &&
      !seenChorus &&
      cp.time < guardSec &&
      hasLaterChorus
    ) {
      section_type = "VERSE";
    } else if (section_type === "CHORUS_START") {
      seenChorus = true;
    } else if (section_type === "CHORUS" && !seenChorus) {
      section_type = "CHORUS_START";
      seenChorus = true;
    }
    out.push({
      eight_index: cp.eight_index,
      time: cp.time,
      score: Math.max(0.2, Math.min(1, cp.confidence)),
      tier: cp.is_major ? "major" : tierForApp(section_type),
      section_type,
    });
  }
  return out.length > 0 ? out : undefined;
}

function mapV2ChangeType(type: string, isFirstChorus: boolean): SectionType {
  const t = type.toUpperCase();
  if (t === "INTRO") return "INTRO";
  if (t === "OUTRO") return "OUTRO";
  if (t === "VERSE" || t === "A_MELO") return "VERSE";
  if (t === "B_MELO" || t === "PRE_CHORUS") return "PRE_CHORUS";
  if (t === "BREAKDOWN" || t === "BREAK") return "SE_TRIGGER";
  if (t === "DROP") return "DROP";
  if (t === "CHORUS_START") return isFirstChorus ? "CHORUS_START" : "CHORUS";
  if (t === "CHORUS") return isFirstChorus ? "CHORUS_START" : "CHORUS";
  return "VERSE";
}

export function appChangePointsFromTimeline(
  timeline: UnifiedMusicTimeline,
  bpm: number
): AppChangePoint[] {
  const step = eightSec(bpm);
  let seenChorus = false;
  const out: AppChangePoint[] = [];
  for (const section of timeline.sections) {
    const isChorus =
      section.type === "CHORUS" || section.type === "FINAL_CHORUS";
    const section_type = sectionTypeToApp(section.type, isChorus && !seenChorus);
    if (isChorus) seenChorus = true;
    out.push({
      eight_index: Math.max(0, Math.floor(section.startTime / step)),
      time: section.startTime,
      score: Math.max(0.2, Math.min(1, section.confidence)),
      tier: tierForApp(section_type),
      section_type,
    });
  }
  return out.sort(
    (a, b) => a.time - b.time || a.eight_index - b.eight_index
  );
}

/**
 * 構造変化点の優先順位: StructureResultV2 → Phase12 timeline → v1 remote。
 */
export function preferStructuralChangePoints(input: {
  structureV2?: StructureResultV2 | null;
  timelineCps?: AppChangePoint[] | null;
  remote?: AppChangePoint[] | null;
}): AppChangePoint[] | undefined {
  const fromV2 = appChangePointsFromStructureV2(input.structureV2 ?? undefined);
  if (fromV2 && fromV2.length > 0) return fromV2;
  if (input.timelineCps && input.timelineCps.length > 0) {
    return input.timelineCps;
  }
  if (input.remote && input.remote.length > 0) return [...input.remote];
  return undefined;
}

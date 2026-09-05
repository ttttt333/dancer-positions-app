/**
 * UnifiedMusicTimeline → 既存 Production ChangePoint（eight_index / tier / section_type）。
 * Cue Engine 入力そのものではない。promote / 理由表示の互換用。
 * Phase2 の sections / clusters を潰さず、PRIMARY から派生するだけ。
 */
import type { ChangePoint as AppChangePoint, SectionType } from "../types";
import type { MusicSectionType } from "../engine/types/MusicTypes";
import type { UnifiedMusicTimeline } from "../engine/music/productionTimeline";

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

/**
 * AI が認識した楽曲セクションを波形上に薄く重ねるための共通型・色。
 */

import type { MusicSectionType } from "./choreocore/engine/types/MusicTypes";
import type { ChangePoint } from "./choreocore/types";

export type MusicSectionOverlaySegment = {
  startSec: number;
  endSec: number;
  sectionType: MusicSectionType | "UNKNOWN";
  label: string;
  color: string;
};

const SECTION_META: Record<
  string,
  { label: string; color: string }
> = {
  INTRO: { label: "導入", color: "rgba(148, 163, 184, 0.45)" },
  VERSE: { label: "Aメロ", color: "rgba(56, 189, 248, 0.42)" },
  PRE_CHORUS: { label: "Bメロ", color: "rgba(250, 204, 21, 0.5)" },
  CHORUS: { label: "サビ", color: "rgba(248, 113, 113, 0.48)" },
  FINAL_CHORUS: { label: "大サビ", color: "rgba(239, 68, 68, 0.55)" },
  DROP: { label: "ドロップ", color: "rgba(244, 63, 94, 0.5)" },
  BREAK: { label: "ブレイク", color: "rgba(167, 139, 250, 0.4)" },
  BRIDGE: { label: "ブリッジ", color: "rgba(129, 140, 248, 0.42)" },
  OUTRO: { label: "アウトロ", color: "rgba(148, 163, 184, 0.4)" },
  UNKNOWN: { label: "—", color: "rgba(120, 113, 108, 0.35)" },
};

export function sectionOverlayStyle(type: string): { label: string; color: string } {
  return SECTION_META[type] ?? SECTION_META.UNKNOWN!;
}

function normalizeCpType(
  raw: ChangePoint["section_type"] | undefined
): MusicSectionType | "UNKNOWN" {
  if (!raw) return "UNKNOWN";
  if (raw === "CHORUS_START") return "CHORUS";
  if (raw === "SE_TRIGGER") return "BREAK";
  return raw as MusicSectionType;
}

/** 変化点列 → 連続セクション帯 */
export function segmentsFromChangePoints(
  changePoints: ChangePoint[] | undefined,
  durationSec: number
): MusicSectionOverlaySegment[] {
  if (!changePoints?.length || durationSec <= 0) return [];
  const sorted = [...changePoints]
    .filter((cp) => Number.isFinite(cp.time) && cp.time >= 0)
    .sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return [];

  const out: MusicSectionOverlaySegment[] = [];
  const first = sorted[0]!;
  if (first.time > 0.8) {
    const meta = sectionOverlayStyle("INTRO");
    out.push({
      startSec: 0,
      endSec: first.time,
      sectionType: "INTRO",
      label: meta.label,
      color: meta.color,
    });
  }
  for (let i = 0; i < sorted.length; i += 1) {
    const cp = sorted[i]!;
    const next = sorted[i + 1];
    const sectionType = normalizeCpType(cp.section_type);
    const meta = sectionOverlayStyle(sectionType);
    const start = Math.max(0, cp.time);
    const end = Math.min(durationSec, next?.time ?? durationSec);
    if (end - start < 0.35) continue;
    out.push({
      startSec: start,
      endSec: end,
      sectionType,
      label: meta.label,
      color: meta.color,
    });
  }
  return out;
}

export function segmentsFromMusicSections(
  sections: Array<{ type: string; startTime: number; endTime: number }>,
  durationSec: number
): MusicSectionOverlaySegment[] {
  return sections
    .filter((s) => Number.isFinite(s.startTime) && Number.isFinite(s.endTime))
    .map((s) => {
      const meta = sectionOverlayStyle(s.type);
      return {
        startSec: Math.max(0, s.startTime),
        endSec: Math.min(durationSec, Math.max(s.startTime, s.endTime)),
        sectionType: (s.type as MusicSectionType) || "UNKNOWN",
        label: meta.label,
        color: meta.color,
      };
    })
    .filter((s) => s.endSec - s.startSec >= 0.35);
}

/**
 * セクション種別 → 日本語ラベル／波形カラー（指示書どおりのパレット）。
 */

import type { SectionType } from "../../types/audioAnalysis";

export type SectionDisplayMeta = {
  label: string;
  /** 不透明 hex（指示書） */
  colorHex: string;
  /** 波形オーバーレイ用 rgba */
  color: string;
};

const META: Record<SectionType, SectionDisplayMeta> = {
  intro: {
    label: "イントロ",
    colorHex: "#6B7280",
    color: "rgba(107, 114, 128, 0.48)",
  },
  verse: {
    label: "Aメロ",
    colorHex: "#3B82F6",
    color: "rgba(59, 130, 246, 0.45)",
  },
  pre_chorus: {
    label: "Bメロ",
    colorHex: "#8B5CF6",
    color: "rgba(139, 92, 246, 0.48)",
  },
  chorus: {
    label: "サビ",
    colorHex: "#EF4444",
    color: "rgba(239, 68, 68, 0.5)",
  },
  bridge: {
    label: "ブレイク",
    colorHex: "#F59E0B",
    color: "rgba(245, 158, 11, 0.48)",
  },
  outro: {
    label: "アウトロ",
    colorHex: "#10B981",
    color: "rgba(16, 185, 129, 0.45)",
  },
  unknown: {
    label: "—",
    colorHex: "#78716C",
    color: "rgba(120, 113, 108, 0.38)",
  },
};

export function sectionDisplayMeta(type: SectionType): SectionDisplayMeta {
  return META[type] ?? META.unknown;
}

/** StructureV2 / レガシー英語ラベル → SectionType */
export function mapLabelToSectionType(raw: string | undefined | null): SectionType {
  const u = (raw ?? "").trim().toUpperCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (!u) return "unknown";
  if (u === "INTRO") return "intro";
  if (u === "OUTRO") return "outro";
  if (u === "VERSE" || u === "A_MELO" || u === "AMELO") return "verse";
  if (
    u === "PRE_CHORUS" ||
    u === "PRECHORUS" ||
    u === "B_MELO" ||
    u === "BMELO"
  ) {
    return "pre_chorus";
  }
  if (
    u === "CHORUS" ||
    u === "CHORUS_START" ||
    u === "FINAL_CHORUS" ||
    u === "DROP"
  ) {
    return "chorus";
  }
  if (
    u === "BRIDGE" ||
    u === "INTERLUDE" ||
    u === "BREAK" ||
    u === "BREAKDOWN" ||
    u === "SE_TRIGGER"
  ) {
    return "bridge";
  }
  return "unknown";
}

/** MusicSectionType（エンジン大文字）→ SectionType */
export function mapEngineTypeToSectionType(
  raw: string | undefined | null
): SectionType {
  return mapLabelToSectionType(raw);
}

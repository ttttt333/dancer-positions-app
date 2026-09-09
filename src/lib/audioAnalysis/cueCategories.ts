/**
 * AI提案: 未編集曲 / EDIT曲 のきっかけカテゴリ。
 * 波形ラベルとフォーメーション提案の両方に使う。
 */

import type { SectionType } from "../../types/audioAnalysis";
import { sectionDisplayMeta } from "./sectionMeta";

export type TrackAnalysisMode = "clean" | "edit";

export type CueCategoryId =
  | "intro"
  | "verse"
  | "pre_chorus"
  | "chorus"
  | "bridge"
  | "outro"
  | "hit"
  | "se"
  | "build"
  | "other";

export type CueCategoryOption = {
  id: CueCategoryId;
  label: string;
  /** 内部 SectionType（隊形エンジン互換） */
  sectionType: SectionType;
};

/** 未編集曲向け（イントロ〜アウトロ） */
export const CLEAN_CUE_CATEGORIES: CueCategoryOption[] = [
  { id: "intro", label: "イントロ", sectionType: "intro" },
  { id: "verse", label: "Aメロ", sectionType: "verse" },
  { id: "pre_chorus", label: "Bメロ", sectionType: "pre_chorus" },
  { id: "chorus", label: "サビ", sectionType: "chorus" },
  { id: "bridge", label: "ブレイク", sectionType: "bridge" },
  { id: "outro", label: "アウトロ", sectionType: "outro" },
  { id: "other", label: "その他", sectionType: "unknown" },
];

/** EDIT曲向け（きっかけ中心。定型ラベルは任意） */
export const EDIT_CUE_CATEGORIES: CueCategoryOption[] = [
  { id: "hit", label: "きっかけ", sectionType: "bridge" },
  { id: "se", label: "効果音", sectionType: "bridge" },
  { id: "build", label: "ビルドアップ", sectionType: "pre_chorus" },
  { id: "chorus", label: "サビ相当", sectionType: "chorus" },
  { id: "verse", label: "メロ相当", sectionType: "verse" },
  { id: "bridge", label: "ブレイク", sectionType: "bridge" },
  { id: "intro", label: "導入", sectionType: "intro" },
  { id: "outro", label: "締め", sectionType: "outro" },
  { id: "other", label: "その他", sectionType: "unknown" },
];

export function categoriesForMode(mode: TrackAnalysisMode): CueCategoryOption[] {
  return mode === "edit" ? EDIT_CUE_CATEGORIES : CLEAN_CUE_CATEGORIES;
}

export function categoryFromLabel(
  label: string,
  mode: TrackAnalysisMode
): CueCategoryOption {
  const list = categoriesForMode(mode);
  const hit = list.find((c) => c.label === label);
  if (hit) return hit;
  const byType = list.find((c) => sectionDisplayMeta(c.sectionType).label === label);
  if (byType) return byType;
  return list[list.length - 1]!;
}

export function applyCategoryToSectionType(
  categoryId: CueCategoryId,
  mode: TrackAnalysisMode
): { type: SectionType; label: string; color: string } {
  const opt =
    categoriesForMode(mode).find((c) => c.id === categoryId) ??
    categoriesForMode(mode)[categoriesForMode(mode).length - 1]!;
  const meta = sectionDisplayMeta(opt.sectionType);
  return {
    type: opt.sectionType,
    label: opt.label,
    color: meta.color,
  };
}

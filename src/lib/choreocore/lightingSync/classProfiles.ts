/**
 * 移動ルール（難易度）プリセット
 * ※スタジオのクラス名ではなく、提案時の移動・交差の制約セット
 */

import type { ClassProfile } from "./types";

/** 安全・ゆっくり：移動少なめ・交差なし（幼児〜低学年想定） */
export const CLASS_TODDLER: ClassProfile = {
  classId: "toddler_default",
  className: "安全・ゆっくり",
  summary: "移動少なめ · 交差なし · 整数スナップ",
  targetAgeGroup: "toddler",
  maxMoveDistancePerCount: 0.3,
  minCountsBetweenChanges: 8,
  gridSnapMode: "integer",
  allowCrossMovement: false,
  use3DLeveling: false,
};

/** 大胆・交差あり：大きめ移動（上級想定） */
export const CLASS_ADVANCED_MON7: ClassProfile = {
  classId: "mon_07pm",
  className: "大胆・交差あり",
  summary: "大きめ移動 · 交差OK · 姿勢ON",
  targetAgeGroup: "advanced",
  maxMoveDistancePerCount: 1.0,
  minCountsBetweenChanges: 3,
  gridSnapMode: "free",
  allowCrossMovement: true,
  use3DLeveling: true,
};

/** 標準バランス：中くらいの移動・交差なし */
export const CLASS_ELEMENTARY: ClassProfile = {
  classId: "elementary_default",
  className: "標準バランス",
  summary: "中くらいの移動 · 交差なし · 姿勢ON",
  targetAgeGroup: "elementary",
  maxMoveDistancePerCount: 0.55,
  minCountsBetweenChanges: 4,
  gridSnapMode: "free",
  allowCrossMovement: false,
  use3DLeveling: true,
};

export const CLASS_PROFILE_PRESETS: ClassProfile[] = [
  CLASS_TODDLER,
  CLASS_ELEMENTARY,
  CLASS_ADVANCED_MON7,
];

export function getClassProfile(classId: string): ClassProfile {
  return (
    CLASS_PROFILE_PRESETS.find((p) => p.classId === classId) ??
    CLASS_ADVANCED_MON7
  );
}

/** 出演人数から妥当な移動ルールを推定 */
export function suggestClassProfileId(dancerCount: number): string {
  if (dancerCount > 0 && dancerCount <= 14) return CLASS_TODDLER.classId;
  if (dancerCount <= 28) return CLASS_ELEMENTARY.classId;
  return CLASS_ADVANCED_MON7.classId;
}

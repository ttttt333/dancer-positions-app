/**
 * クラス属性プリセット
 */

import type { ClassProfile } from "./types";

/** チビチビクラス（幼児〜低学年） */
export const CLASS_TODDLER: ClassProfile = {
  classId: "toddler_default",
  className: "チビチビクラス",
  targetAgeGroup: "toddler",
  maxMoveDistancePerCount: 0.3,
  minCountsBetweenChanges: 8,
  gridSnapMode: "integer",
  allowCrossMovement: false,
  use3DLeveling: false,
};

/** 月曜7時クラス（高学年・一般） */
export const CLASS_ADVANCED_MON7: ClassProfile = {
  classId: "mon_07pm",
  className: "月曜7時クラス",
  targetAgeGroup: "advanced",
  maxMoveDistancePerCount: 1.0,
  minCountsBetweenChanges: 3,
  gridSnapMode: "free",
  allowCrossMovement: true,
  use3DLeveling: true,
};

export const CLASS_ELEMENTARY: ClassProfile = {
  classId: "elementary_default",
  className: "小学生クラス",
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

/** 出演人数から妥当なクラス制約を推定 */
export function suggestClassProfileId(dancerCount: number): string {
  if (dancerCount > 0 && dancerCount <= 14) return CLASS_TODDLER.classId;
  if (dancerCount <= 28) return CLASS_ELEMENTARY.classId;
  return CLASS_ADVANCED_MON7.classId;
}

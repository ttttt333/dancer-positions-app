import type { FormationCueAction, FormationCueIntent } from "../types/CueTypes";
import type { FormationType } from "../types/FormationTypes";

const INTENT_TYPES: Record<FormationCueAction, FormationType[]> = {
  EXPAND: ["WIDE_V", "DIAGONAL", "CENTER_WINGS", "ARC"],
  CONTRACT: ["CLUSTER", "V", "DIAMOND", "CENTER"],
  SPLIT: ["CENTER_WINGS", "SPLIT", "DOUBLE_DIAGONAL"],
  MERGE: ["V", "CENTER", "DIAMOND"],
  CENTER: ["CENTER", "CENTER_WINGS", "TRIANGLE"],
  LINE: ["LINE", "DOUBLE_LINE"],
  DIAGONAL: ["DIAGONAL", "DOUBLE_DIAGONAL"],
  V: ["V", "WIDE_V"],
  CLUSTER: ["CLUSTER", "CENTER"],
  MAJOR_CHANGE: ["WIDE_V", "PYRAMID", "SPLIT", "CENTER_WINGS", "DOUBLE_DIAGONAL"],
  TRIANGLE: ["TRIANGLE", "PYRAMID", "V"],
  ARC: ["ARC", "WIDE_V"],
  HOLD: ["CENTER", "LINE", "CLUSTER"],
  MICRO_SHIFT: ["LINE", "CENTER", "V", "CUSTOM"],
};

const TYPE_MATCH: Partial<Record<FormationCueAction, Partial<Record<FormationType, number>>>> = {
  EXPAND: { WIDE_V: 100, DIAGONAL: 92, CENTER_WINGS: 90, ARC: 86, PYRAMID: 78, V: 74, LINE: 70, CLUSTER: 0 },
  CONTRACT: { CLUSTER: 100, DIAMOND: 92, V: 88, CENTER: 86, LINE: 50, WIDE_V: 20 },
  V: { V: 100, WIDE_V: 92, ARROW: 88, TRIANGLE: 80, DIAGONAL: 80 },
  DIAGONAL: { DIAGONAL: 100, DOUBLE_DIAGONAL: 92, WIDE_V: 70, V: 60 },
  SPLIT: { SPLIT: 100, CENTER_WINGS: 92, DOUBLE_DIAGONAL: 88, GRID: 40 },
  MERGE: { V: 100, CENTER: 94, DIAMOND: 90, CLUSTER: 80, SPLIT: 10 },
  CENTER: { CENTER: 100, CENTER_WINGS: 92, TRIANGLE: 86, DIAMOND: 80 },
  LINE: { LINE: 100, DOUBLE_LINE: 92, GRID: 70 },
  CLUSTER: { CLUSTER: 100, CENTER: 88 },
  MAJOR_CHANGE: { WIDE_V: 100, PYRAMID: 94, SPLIT: 90, CENTER_WINGS: 88, DOUBLE_DIAGONAL: 86, ARC: 84 },
  HOLD: { CENTER: 80, LINE: 75, CLUSTER: 70 },
  MICRO_SHIFT: { CUSTOM: 90, LINE: 80, CENTER: 78, V: 70 },
};

export function typesForIntent(action: FormationCueAction): FormationType[] {
  return INTENT_TYPES[action] ?? [];
}

export function prohibitedTypes(intent: FormationCueIntent): Set<FormationType> {
  const banned = new Set<FormationType>();
  for (const action of intent.prohibited) {
    for (const type of typesForIntent(action)) banned.add(type);
  }
  return banned;
}

export function rankedTypesForIntent(intent: FormationCueIntent): FormationType[] {
  const seen = new Set<FormationType>();
  const ranked: FormationType[] = [];
  const push = (types: FormationType[]) => {
    for (const type of types) {
      if (seen.has(type)) continue;
      seen.add(type);
      ranked.push(type);
    }
  };
  push(typesForIntent(intent.primary));
  for (const secondary of intent.secondary) push(typesForIntent(secondary));
  if (intent.primary === "MAJOR_CHANGE" && intent.prohibited.length === 0) {
    push(["ARC", "GRID", "PYRAMID", "V", "ARROW"]);
  }
  return ranked;
}

export function intentMatchScore(
  type: FormationType,
  intent: FormationCueIntent
): number {
  if (prohibitedTypes(intent).has(type)) return 0;
  const primaryMap = TYPE_MATCH[intent.primary];
  if (primaryMap && primaryMap[type] !== undefined) return primaryMap[type]!;
  const primaryTypes = typesForIntent(intent.primary);
  const pi = primaryTypes.indexOf(type);
  if (pi === 0) return 100;
  if (pi > 0) return Math.max(70, 100 - pi * 8);
  for (const secondary of intent.secondary) {
    const si = typesForIntent(secondary).indexOf(type);
    if (si >= 0) return Math.max(60, 86 - si * 6);
  }
  return 48;
}

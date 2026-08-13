import type { Formation, FormationType } from "../types/FormationTypes";
import { FORMATION_FAMILY } from "../types/ScoringTypes";
import { clamp, finite } from "./scoreMath";

const PAIR_CONTRAST: Record<string, number> = {
  "LINE|DOUBLE_LINE": 35,
  "LINE|WIDE_V": 70,
  "LINE|V": 62,
  "LINE|SPLIT": 90,
  "LINE|CLUSTER": 82,
  "LINE|DIAGONAL": 55,
  "LINE|PYRAMID": 78,
  "LINE|CENTER_WINGS": 68,
  "V|WIDE_V": 25,
  "V|CLUSTER": 88,
  "WIDE_V|CLUSTER": 92,
  "WIDE_V|CENTER": 80,
  "WIDE_V|PYRAMID": 40,
  "PYRAMID|CENTER": 55,
  "PYRAMID|CLUSTER": 70,
  "SPLIT|CENTER": 75,
  "DOUBLE_LINE|LINE": 35,
};

function pairKey(a: FormationType, b: FormationType): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function formationContrast(a: FormationType, b: FormationType): number {
  if (a === b) return 8;
  const named = PAIR_CONTRAST[`${a}|${b}`] ?? PAIR_CONTRAST[`${b}|${a}`] ?? PAIR_CONTRAST[pairKey(a, b)];
  if (named !== undefined) return named;
  const fa = FORMATION_FAMILY[a];
  const fb = FORMATION_FAMILY[b];
  if (fa === fb) return 28;
  return 64;
}

export function noveltyScore(previous: Formation | undefined, next: Formation): number {
  if (!previous) return 50;
  const contrast = formationContrast(previous.type, next.type);
  if (contrast <= 15) return 22 + contrast;
  if (contrast <= 75) return clamp(38 + contrast * 0.55, 0, 92);
  return clamp(92 - (contrast - 75) * 0.35, 55, 92);
}

export function repetitionPenaltyValue(
  history: Formation[],
  next: Formation,
  basePenalty: number
): number {
  const recent = history.slice(-5);
  if (recent.length === 0) return 0;
  const last = recent[recent.length - 1]!;
  let penalty = 0;
  if (last.type === next.type) penalty += basePenalty;
  let streak = last.type === next.type ? 2 : 1;
  for (let i = recent.length - 2; i >= 0; i -= 1) {
    if (recent[i]!.type !== next.type) break;
    streak += 1;
  }
  if (streak >= 3) penalty += basePenalty * 1.4;
  const sameCount = recent.filter((f) => f.type === next.type).length;
  if (sameCount >= 2) penalty += basePenalty * 0.5;
  return finite(penalty);
}

export function visualMonotonyPenalty(
  history: Formation[],
  next: Formation,
  basePenalty: number
): number {
  const recent = [...history.slice(-4), next];
  if (recent.length < 3) return 0;
  const families = recent.map((f) => FORMATION_FAMILY[f.type]);
  const onlyTwo = new Set(families);
  if (onlyTwo.size === 1) return basePenalty * 1.4;
  const pingPong =
    recent.length >= 3 &&
    recent[recent.length - 1]!.type === recent[recent.length - 3]!.type &&
    FORMATION_FAMILY[recent[recent.length - 1]!.type] ===
      FORMATION_FAMILY[recent[recent.length - 2]!.type];
  if (pingPong) return basePenalty;
  const types = recent.map((f) => f.type);
  if (types.join(">") === "V>WIDE_V>V" || types.join(">") === "WIDE_V>V>WIDE_V") {
    return basePenalty;
  }
  return 0;
}

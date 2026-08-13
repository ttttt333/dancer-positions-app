import type { FormationCue, FormationCueIntent } from "../types/CueTypes";
import type { FormationCandidate, FormationType } from "../types/FormationTypes";
import type { MusicPhrase, MusicSection } from "../types/MusicTypes";
import { intentMatchScore } from "../formation/FormationIntentMapper";
import { energyContext } from "../cue/CueScorer";
import { clamp, finite, lerp } from "./scoreMath";

const EXPAND_TYPES = new Set<FormationType>([
  "WIDE_V",
  "ARC",
  "DIAGONAL",
  "DOUBLE_DIAGONAL",
  "SPLIT",
  "PYRAMID",
  "CENTER_WINGS",
]);
const CONTRACT_TYPES = new Set<FormationType>([
  "CLUSTER",
  "CENTER",
  "DIAMOND",
  "V",
]);
const DETAIL_TYPES = new Set<FormationType>(["LINE", "DOUBLE_LINE", "GRID", "CENTER"]);

export function energyBandTargetCoverage(energy: number): number {
  if (energy < 20) return 22;
  if (energy < 40) return 36;
  if (energy < 60) return 50;
  if (energy < 80) return 70;
  return 88;
}

function sectionPreference(section: MusicSection | undefined, type: FormationType): number {
  if (!section) return 70;
  const map: Partial<Record<MusicSection["type"], Partial<Record<FormationType, number>>>> = {
    INTRO: { LINE: 90, CLUSTER: 86, CENTER: 84, V: 70, WIDE_V: 40, PYRAMID: 35 },
    VERSE: { LINE: 80, DIAGONAL: 82, V: 78, DOUBLE_LINE: 76, WIDE_V: 70 },
    PRE_CHORUS: { DIAGONAL: 88, V: 86, ARC: 84, WIDE_V: 80, LINE: 60 },
    CHORUS: { WIDE_V: 94, PYRAMID: 92, SPLIT: 88, CENTER_WINGS: 86, ARC: 84, CLUSTER: 30 },
    DROP: { PYRAMID: 94, WIDE_V: 92, SPLIT: 90, CENTER_WINGS: 86 },
    BREAK: { CLUSTER: 94, CENTER: 88, LINE: 80, WIDE_V: 25, PYRAMID: 20 },
    BRIDGE: { ARC: 88, DIAGONAL: 86, ARROW: 84, DIAMOND: 82, GRID: 70 },
    FINAL_CHORUS: { PYRAMID: 96, WIDE_V: 94, CENTER_WINGS: 90, SPLIT: 86, CLUSTER: 20 },
    OUTRO: { LINE: 86, CLUSTER: 82, CENTER: 80, ARC: 70 },
    UNKNOWN: {},
  };
  const table = map[section.type] ?? {};
  const pref = table[type] ?? 70;
  return lerp(70, pref, clamp(section.confidence, 0, 1));
}

function phraseFit(phrase: MusicPhrase | undefined, type: FormationType): number {
  if (!phrase) return 70;
  if (phrase.type === "PREPARATION") {
    return EXPAND_TYPES.has(type) || type === "DIAGONAL" || type === "V" ? 82 : 62;
  }
  if (phrase.type === "RELEASE") {
    return CONTRACT_TYPES.has(type) ? 84 : 64;
  }
  return 70;
}

export function musicFitScore(options: {
  candidate: FormationCandidate;
  cue: FormationCue;
  intent?: FormationCueIntent;
  section?: MusicSection;
  phrase?: MusicPhrase;
}): number {
  const { candidate, cue, intent, section, phrase } = options;
  const type = candidate.formation.type;
  const intentPart = intent
    ? intentMatchScore(type, intent)
    : candidate.intentMatch;
  const energy = cue.energyAfter;
  const coverage = candidate.stageCoverage;
  const energyFit = clamp(100 - Math.abs(coverage - energyBandTargetCoverage(energy)) * 1.1, 0, 100);
  const ctx = energyContext(cue.energyBefore, cue.energyAfter);

  let directionFit = 70;
  if (ctx.direction === "RISING" && EXPAND_TYPES.has(type)) directionFit = 92;
  else if (ctx.direction === "RISING" && CONTRACT_TYPES.has(type)) directionFit = 35;
  else if (ctx.direction === "FALLING" && CONTRACT_TYPES.has(type)) directionFit = 92;
  else if (ctx.direction === "FALLING" && EXPAND_TYPES.has(type)) directionFit = 32;
  else if (ctx.direction === "STABLE" && DETAIL_TYPES.has(type)) directionFit = 86;
  else if (ctx.direction === "STABLE" && cue.action === "MAJOR_CHANGE" && EXPAND_TYPES.has(type)) {
    directionFit = 48;
  }

  if (ctx.level === "LOW" && EXPAND_TYPES.has(type) && (cue.magnitude === "MAX" || cue.magnitude === "LARGE")) {
    directionFit = Math.min(directionFit, 28);
  }
  if (ctx.level === "HIGH" && ctx.direction === "RISING" && EXPAND_TYPES.has(type)) {
    directionFit = Math.max(directionFit, 90);
  }
  if (ctx.level === "HIGH" && ctx.direction === "STABLE" && cue.action === "MAJOR_CHANGE") {
    directionFit -= 18;
  }

  const actionBoost =
    (cue.action === "EXPAND" && type === "WIDE_V") ||
    (cue.action === "CONTRACT" && type === "CLUSTER")
      ? 12
      : 0;

  const score =
    intentPart * 0.4 +
    energyFit * 0.22 +
    directionFit * 0.16 +
    sectionPreference(section, type) * 0.14 +
    phraseFit(phrase, type) * 0.08 +
    actionBoost;
  return clamp(finite(score), 0, 100);
}

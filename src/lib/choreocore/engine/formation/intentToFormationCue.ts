/**
 * Choreographic Intent（目的）→ 既存 FormationCueIntent（候補生成の入力）。
 * Formation Type はここで決めない。1 Intent = 1 Formation の固定表は作らない。
 */

import type { ChoreographicIntentType } from "../intent/ChoreographicIntentTypes";
import type {
  FormationChangeMagnitude,
  FormationCue,
  FormationCueAction,
  FormationCueIntent,
} from "../types/CueTypes";
import { INTENT_INTENSITY_THRESHOLDS } from "./intentFormationConfig";

const CHOREO_TO_CUE_PRIMARY: Record<ChoreographicIntentType, FormationCueAction> = {
  HOLD: "HOLD",
  EXPAND: "EXPAND",
  CONTRACT: "CONTRACT",
  SPLIT: "SPLIT",
  MERGE: "MERGE",
  SHIFT_CENTER: "CENTER",
  MICRO_SHIFT: "MICRO_SHIFT",
  MAJOR_CHANGE: "MAJOR_CHANGE",
  REVEAL: "EXPAND",
  HIDE: "CONTRACT",
  HIT: "MAJOR_CHANGE",
  TRAVEL: "MICRO_SHIFT",
  RESET: "HOLD",
  ROTATE: "MICRO_SHIFT",
};

/**
 * 同じ目的でも複数の既存 Formation 語彙を検討するための secondary。
 * 値は Cue Action（タイププールの入口）であり、V / ARC などの形そのものではない。
 */
const CHOREO_DIVERSITY_SECONDARIES: Record<ChoreographicIntentType, FormationCueAction[]> = {
  HOLD: ["LINE", "CLUSTER"],
  EXPAND: ["ARC", "DIAGONAL", "V", "MAJOR_CHANGE"],
  CONTRACT: ["CLUSTER", "CENTER", "V"],
  SPLIT: ["MAJOR_CHANGE", "DIAGONAL"],
  MERGE: ["CENTER", "CLUSTER", "V"],
  SHIFT_CENTER: ["DIAGONAL", "V"],
  MICRO_SHIFT: ["LINE", "V"],
  MAJOR_CHANGE: ["EXPAND", "SPLIT", "ARC"],
  REVEAL: ["ARC", "CENTER", "MAJOR_CHANGE"],
  HIDE: ["CLUSTER", "CENTER"],
  HIT: ["CENTER", "V", "EXPAND"],
  TRAVEL: ["DIAGONAL", "LINE"],
  RESET: ["CENTER", "LINE"],
  ROTATE: ["ARC", "V"],
};

export function choreographicIntentToCueAction(
  intent: ChoreographicIntentType
): FormationCueAction {
  return CHOREO_TO_CUE_PRIMARY[intent];
}

export function choreographicIntentToCueIntent(
  intent: ChoreographicIntentType
): FormationCueIntent {
  return {
    primary: CHOREO_TO_CUE_PRIMARY[intent],
    secondary: [...CHOREO_DIVERSITY_SECONDARIES[intent]],
    prohibited: [],
  };
}

export function magnitudeFromIntentIntensity(
  intent: ChoreographicIntentType,
  intensity: number
): FormationChangeMagnitude {
  if (intent === "HOLD" || intent === "RESET") {
    if (intensity >= INTENT_INTENSITY_THRESHOLDS.large) return "NONE";
    return "SMALL";
  }
  if (intent === "MICRO_SHIFT" || intent === "ROTATE" || intent === "TRAVEL") {
    return intensity >= INTENT_INTENSITY_THRESHOLDS.large ? "MEDIUM" : "SMALL";
  }
  if (intensity >= INTENT_INTENSITY_THRESHOLDS.max) return "MAX";
  if (intensity >= INTENT_INTENSITY_THRESHOLDS.large) return "LARGE";
  if (intensity >= INTENT_INTENSITY_THRESHOLDS.medium) return "MEDIUM";
  if (intensity >= INTENT_INTENSITY_THRESHOLDS.small) return "SMALL";
  return "NONE";
}

export function cueForChoreographicIntent(
  cue: FormationCue,
  intent: ChoreographicIntentType,
  intensity: number
): FormationCue {
  return {
    ...cue,
    action: choreographicIntentToCueAction(intent),
    magnitude: magnitudeFromIntentIntensity(intent, intensity),
  };
}

/**
 * サビ家族の隊形メモリー。解析はしない。
 * first で覚え、repeat / final で同じ雛形を返す。
 */

import type { ChoreographicIntent } from "../intent/ChoreographicIntentTypes";
import type { FormationFamily } from "../types/ScoringTypes";
import type { FormationRecommendation, RankedFormationCandidate } from "./intentFormationTypes";

export const CALLBACK_REMEMBERED = "CALLBACK_REMEMBERED";
export const CALLBACK_REPEAT = "CALLBACK_REPEAT";
export const CALLBACK_FINAL = "CALLBACK_FINAL";
export const CALLBACK_SCALE_MAX = "CALLBACK_SCALE_MAX";

/** ラスサビ。50% 中心からの拡大幅 */
export const FINAL_CHORUS_SCALE = 1.32;

export type ChorusCallbackVariation = "first" | "repeat" | "final";

export type ChorusCallbackDecision = {
  chorusFamilyId: string | null;
  variation: ChorusCallbackVariation | "none";
  rememberedShapeFamily: FormationFamily | null;
  rememberedLayoutId: string | null;
  bypassRecentAvoidance: boolean;
  scaleMax: boolean;
  reasonCodes: string[];
};

export type ChorusShapeMemory = Map<string, FormationFamily>;
export type ChorusLayoutMemory = Map<string, string>;

export function decideChorusCallback(
  intent: Pick<ChoreographicIntent, "chorusFamilyId" | "variation">,
  shapeMemory: ChorusShapeMemory,
  layoutMemory?: ChorusLayoutMemory
): ChorusCallbackDecision {
  const chorusFamilyId = intent.chorusFamilyId;
  const variation = intent.variation;
  if (!chorusFamilyId || variation === "none") {
    return {
      chorusFamilyId,
      variation: "none",
      rememberedShapeFamily: null,
      rememberedLayoutId: null,
      bypassRecentAvoidance: false,
      scaleMax: false,
      reasonCodes: [],
    };
  }
  const rememberedShapeFamily = shapeMemory.get(chorusFamilyId) ?? null;
  const rememberedLayoutId = layoutMemory?.get(chorusFamilyId) ?? null;
  const reuse =
    (variation === "repeat" || variation === "final") &&
    Boolean(rememberedShapeFamily || rememberedLayoutId);
  return {
    chorusFamilyId,
    variation,
    rememberedShapeFamily,
    rememberedLayoutId,
    bypassRecentAvoidance: reuse,
    scaleMax: variation === "final" && reuse,
    reasonCodes: reuse
      ? [
          CALLBACK_REMEMBERED,
          variation === "final" ? CALLBACK_FINAL : CALLBACK_REPEAT,
          ...(variation === "final" ? [CALLBACK_SCALE_MAX] : []),
        ]
      : variation === "first"
        ? [CALLBACK_REMEMBERED]
        : [],
  };
}

export function rememberChorusShape(
  memory: ChorusShapeMemory,
  chorusFamilyId: string | null,
  variation: ChoreographicIntent["variation"],
  shapeFamily: FormationFamily | null | undefined
): void {
  if (!chorusFamilyId || !shapeFamily) return;
  if (variation !== "first" && memory.has(chorusFamilyId)) return;
  if (variation === "first" || !memory.has(chorusFamilyId)) {
    memory.set(chorusFamilyId, shapeFamily);
  }
}

export function rememberChorusLayout(
  memory: ChorusLayoutMemory,
  chorusFamilyId: string | null,
  variation: ChoreographicIntent["variation"],
  layoutId: string | null | undefined
): void {
  if (!chorusFamilyId || !layoutId) return;
  if (variation !== "first" && memory.has(chorusFamilyId)) return;
  if (variation === "first" || !memory.has(chorusFamilyId)) {
    memory.set(chorusFamilyId, layoutId);
  }
}

function uniqueCodes(codes: string[]): string[] {
  return codes.filter((c, i) => codes.indexOf(c) === i);
}

function promoteRememberedPrimary(
  rec: FormationRecommendation,
  remembered: FormationFamily,
  extraCodes: string[]
): RankedFormationCandidate | null {
  const match =
    rec.ranked.find((c) => c.shapeFamily === remembered) ??
    (rec.primary?.shapeFamily === remembered ? rec.primary : null);
  if (!match) return rec.primary;
  return {
    ...match,
    score: Math.max(match.score, rec.primary?.score ?? 0) + 12,
    reasonCodes: uniqueCodes([...match.reasonCodes, ...extraCodes]),
  };
}

/**
 * first を記憶し、repeat / final は同じ shapeFamily を primary に据える。
 */
export function applyChorusCallbackToRecommendation(
  rec: FormationRecommendation,
  memory: ChorusShapeMemory
): FormationRecommendation {
  const decision = decideChorusCallback(rec.intent, memory);
  const familyId = rec.intent.chorusFamilyId;
  if (!familyId || rec.intent.variation === "none") return rec;

  if (rec.intent.variation === "first" || !decision.rememberedShapeFamily) {
    rememberChorusShape(memory, familyId, rec.intent.variation, rec.primary?.shapeFamily);
    return {
      ...rec,
      callback: {
        chorusFamilyId: familyId,
        variation: rec.intent.variation === "final" ? "final" : "first",
        scale: rec.intent.variation === "final" ? 1 : 0.72,
        rememberedShapeFamily: rec.primary?.shapeFamily ?? null,
      },
    };
  }

  const primary = promoteRememberedPrimary(
    rec,
    decision.rememberedShapeFamily,
    decision.reasonCodes
  );
  return {
    ...rec,
    primary,
    callback: {
      chorusFamilyId: familyId,
      variation: rec.intent.variation === "final" ? "final" : "repeat",
      scale: rec.intent.variation === "final" ? 1 : 0.72,
      rememberedShapeFamily: decision.rememberedShapeFamily,
    },
  };
}

export function scaleSpotsFromCenter<T extends { xPct: number; yPct: number }>(
  spots: T[],
  factor: number
): T[] {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return spots.map((s) => ({
    ...s,
    xPct: Math.min(96, Math.max(4, 50 + (s.xPct - 50) * f)),
    yPct: Math.min(94, Math.max(6, 50 + (s.yPct - 50) * f)),
  }));
}

/**
 * FLY Fusion — Phase 1–3 は単一ソース投影のパススルー。
 * 将来 Essentia / madmom / MSAF をここに合流させる。
 */

import type { StructureResultV2 } from "../choreocore/types/songStructure";
import {
  flyAnalysisFromStructureV2,
  type FlyFromLegacyInput,
} from "./fromStructureV2";
import { structureV2FromFlyAnalysis } from "./toStructureV2";
import type { FlyAnalysisResult } from "./types";
import { DEFAULT_FLY_FUSION_WEIGHTS, type FlyFusionWeights } from "./types";

export type FusionInput = FlyFromLegacyInput & {
  weights?: Partial<FlyFusionWeights>;
};

/**
 * 複数ソース統合の入口。現状は StructureResultV2 を FLY 契約へ投影するだけ。
 * Ensemble が揃ったらここで confidence を上げ下げする。
 */
export function fuseToFlyAnalysis(input: FusionInput): FlyAnalysisResult {
  const fly = flyAnalysisFromStructureV2(input);
  const w = { ...DEFAULT_FLY_FUSION_WEIGHTS, ...input.weights };
  // 重みは将来 changeStrength 再計算に使う。Phase1 では契約の存在のみ保証。
  void w;
  return {
    ...fly,
    sources: fly.sources.map((s) =>
      s.id === "librosa_chroma_ssm" || s.id === "all_in_one"
        ? s
        : { ...s, note: s.note ?? "awaiting_adapter" }
    ),
  };
}

/** Formation Engine 用に V2 へ戻す（フィールド追加のみでエンジン非破壊） */
export function fuseToStructureV2(input: FusionInput): StructureResultV2 {
  return structureV2FromFlyAnalysis(fuseToFlyAnalysis(input));
}

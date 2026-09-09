/**
 * FLY バージョン定数。
 * Edge / Fly backend の ANALYZER_VERSION と揃えてキャッシュを制御する。
 */

import { REMOTE_ANALYZER_VERSION } from "../songAnalyzeClient";
import type { FlyVersionBundle } from "./types";

/** 複数ソース統合ロジック */
export const FLY_FUSION_VERSION = "fly-fusion-v0.1.0";

/** ダンス知能（Opportunity / Impact / Urgency） */
export const FLY_DANCE_MODEL_VERSION = "fly-dance-v0.1.0";

/** Formation Tier1 接続レイヤ（既存 engine を壊さない） */
export const FLY_FORMATION_MODEL_VERSION = "choreocore-tier1-v5";

/** Structure v2 / AIO の論理バージョン（ドキュメント用） */
export const FLY_STRUCTURE_V2_VERSION = "structure-v2.0.1";
export const FLY_AIO_VERSION = "all-in-one-v1.0.0";

export function currentFlyVersions(
  analyzerVersion: string = REMOTE_ANALYZER_VERSION
): FlyVersionBundle {
  return {
    analyzerVersion,
    fusionVersion: FLY_FUSION_VERSION,
    danceModelVersion: FLY_DANCE_MODEL_VERSION,
    formationModelVersion: FLY_FORMATION_MODEL_VERSION,
  };
}

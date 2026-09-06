/**
 * 楽曲構造 v2 に基づくモチーフ一貫性・エネルギーダイナミクス補正。
 * 同一 cluster_id（旋律・コードが同じセクション）では幾何カテゴリをロックし、
 * energy_trend / BREAKDOWN に応じて拡散・収縮を優遇する。
 */

import type { Position2D } from "./geometricGridQuantizer";
import type { SongSectionV2 } from "../../types/songStructure";

export type MotifRuleContext = {
  section: SongSectionV2;
  /** 例: 'V_SHAPE', 'STAGGERED_GRID', 'TIGHT_CLUSTER' */
  presetCategory: string;
  /** 隊形の広がり幅（メートル換算） */
  presetRadiusOrWidth: number;
};

/**
 * 曲全体を通した「クラスタID → 割り当てカテゴリ」のメモリ。
 * suggest 1 回の先頭で clear する。
 */
class MotifRegistry {
  private clusterMap = new Map<number, string>();

  getCategory(clusterId: number): string | undefined {
    return this.clusterMap.get(clusterId);
  }

  register(clusterId: number, category: string): void {
    if (!this.clusterMap.has(clusterId)) {
      this.clusterMap.set(clusterId, category);
    }
  }

  clear(): void {
    this.clusterMap.clear();
  }

  size(): number {
    return this.clusterMap.size;
  }
}

export const motifRegistry = new MotifRegistry();

/**
 * モチーフの一貫性とエネルギー ダイナミクスに基づくスコア補正値を算出。
 */
export function evaluateMotifAndDynamicsScore(ctx: MotifRuleContext): number {
  let scoreAdjustment = 0;
  const { section, presetCategory, presetRadiusOrWidth } = ctx;

  // 1. モチーフ一貫性（サビや Aメロの繰り返し）
  const lockedCategory = motifRegistry.getCategory(section.cluster_id);
  if (lockedCategory) {
    if (presetCategory === lockedCategory) {
      scoreAdjustment += 0.25;
    } else {
      scoreAdjustment -= 0.15;
    }
  }

  // 2. 音響ダイナミクス
  // Bメロ等の盛り上がりでは広い隊形を優遇
  if (section.energy_trend > 0.005 || section.label === "B_MELO") {
    if (presetRadiusOrWidth >= 2.5) {
      scoreAdjustment += 0.1;
    }
  }

  // BREAKDOWN / 低エネルギーではコンパクトを優遇
  if (section.label === "BREAKDOWN" || section.mean_energy < 0.2) {
    if (presetRadiusOrWidth <= 2.0) {
      scoreAdjustment += 0.15;
    } else {
      scoreAdjustment -= 0.1;
    }
  }

  return Number(scoreAdjustment.toFixed(3));
}

/**
 * 座標群の外接ボックスの最大辺長（メートル）を広がり幅とする。
 */
export function calculatePresetWidth(positions: Position2D[]): number {
  if (positions.length <= 1) return 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of positions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.max(maxX - minX, maxY - minY);
}

/**
 * 雛形 ID / 座標から広がり幅を推定（goldenFormationFilter への循環依存を避ける）。
 */
export function estimatePresetRadiusOrWidth(
  layoutId: string,
  positions?: Position2D[]
): number {
  if (positions && positions.length >= 2) {
    return calculatePresetWidth(positions);
  }
  const id = layoutId.toLowerCase();
  if (/cluster_tight|scatter_center|concentric|extra_block_center/.test(id)) {
    return 1.5;
  }
  if (/wing_spread|two_wings|fan_wide|block_lr/.test(id)) return 5.0;
  if (/(?:^|_)(?:vee|v_open|v_tight|wedge|chevron)/.test(id)) return 4.0;
  if (/^(?:line|line_front|line_back)|fan_front/.test(id)) return 4.5;
  if (/stagger|two_rows|three_lines|grid|columns_|rows_/.test(id)) return 3.5;
  if (/diamond|square_outline|hourglass|circle|arc|oval/.test(id)) return 3.2;
  if (/u_shape|u_deep|horseshoe/.test(id)) return 4.2;
  return 3.0;
}

/**
 * 候補確定時にクラスタへカテゴリをロックする。
 */
export function onPresetSelected(
  clusterId: number,
  selectedCategory: string
): void {
  motifRegistry.register(clusterId, selectedCategory);
}

/** 後方互換の薄いラッパ */
export function calculateMotifBonus(
  clusterId: number,
  presetCategory: string
): number {
  const locked = motifRegistry.getCategory(clusterId);
  if (!locked) return 0;
  return locked === presetCategory ? 0.25 : 0;
}

export function registerClusterMotif(
  clusterId: number,
  presetCategory: string
): void {
  motifRegistry.register(clusterId, presetCategory);
}

/**
 * CHOREOCORE Tier 1 v6.1 — 型定義
 * MOVE / SAFETY を P0、VISUAL / MUSIC はプレースホルダー。
 */

export interface Position {
  x: number;
  y: number;
}

export interface Performer {
  id: string;
  position: Position;
}

export interface Formation {
  id?: string;
  performers: Performer[];
}

export type Tier = "major" | "medium" | "minor";

export interface TemplateSlot {
  id: string;
  position: Position;
  pinnedPerformerId?: string;
}

export interface FormationTemplate {
  id: string;
  tier: Tier;
  slots: TemplateSlot[];
  tags?: string[];
  name?: string;
}

export interface PerformerMobilityProfile {
  id: string;
  mobilityFactor: number;
}

export interface PathCrossing {
  performerAId: string;
  performerBId: string;
  approximateCoordinate: Position;
}

export interface FormationWeights {
  move: number;
  safety: number;
  visual: number;
  music: number;
}

export interface FormationScore {
  total: number;
  axes: {
    move: number;
    safety: number;
    visual: number | null;
    music: number | null;
  };
  weights: FormationWeights;
}

export interface AssignmentResult {
  assignment: Map<string, Position>;
  totalDisplacement: number;
  averageDisplacement: number;
  displacementVariance: number;
  maxIndividualDisplacement: number;
  feasible: boolean;
  pinnedOverLimitPerformerIds: string[];
  crossings: PathCrossing[];
}

export interface PickResult {
  formation: FormationTemplate;
  assignment: Map<string, Position>;
  score: FormationScore;
  totalDisplacement: number;
  averageDisplacement: number;
  displacementVariance: number;
  maxIndividualDisplacement: number;
  warning: boolean;
  usedFallbackPool: boolean;
  pinnedOverLimitPerformerIds: string[];
  crossings: PathCrossing[];
}

/** AIフィードバック（再提案用） */
export interface SuggestFeedback {
  /** 移動を抑えたい */
  preferLessMovement?: boolean;
  /** 交差を減らしたい */
  preferFewerCrossings?: boolean;
  /** サビ等でよりインパクトのある隊形 */
  preferMoreImpact?: boolean;
  /** 避けたいレイアウト ID */
  avoidLayoutIds?: string[];
  note?: string;
  /** 重み上書き（未指定軸は既定） */
  weightOverrides?: Partial<FormationWeights>;
}

export const DEFAULT_FORMATION_WEIGHTS: FormationWeights = {
  move: 0.6,
  safety: 0.4,
  visual: 0,
  music: 0,
};

export const BASE_WALK_RUN_SPEED_MPS = 1.8;

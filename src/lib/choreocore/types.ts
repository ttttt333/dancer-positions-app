/**
 * ChoreoCore 純アルゴリズム版 — 共有型
 */

export type Position = { x: number; y: number };

export type Performer = {
  id: string;
  position: Position;
};

export type Formation = {
  id: string;
  performers: Performer[];
};

export type ChangeTier = "major" | "medium" | "minor";

export type ChangePoint = {
  eight_index: number;
  time: number;
  score: number;
  tier: ChangeTier;
};

export type Template = {
  id: string;
  tier: ChangeTier;
  name: string;
  /** ステージ中央原点・メートル。人数は positions.length（想定25） */
  positions: Position[];
};

export type EightGridEntry = {
  index: number;
  start_time: number;
};

export type SongAnalysisResult = {
  bpm: number;
  duration: number;
  eight_grid: EightGridEntry[];
  change_points: ChangePoint[];
  song_dynamism: number;
  analyzer_version?: string;
};

export type GeneratedCue = {
  id: string;
  formationId: string;
  tStartSec: number;
  tEndSec: number;
  name?: string;
  tier?: ChangeTier;
};

export type GenerateFormationsResult = {
  formations: Formation[];
  cues: GeneratedCue[];
  reasoning: string[];
};

/** ステージ基準（メートル）。原点は中央 */
export const STAGE_WIDTH_M = 12;
export const STAGE_DEPTH_M = 8;

/** 1カウントあたりの最大安全移動距離(m) */
export const METERS_PER_COUNT = 0.45;

/**
 * FLY Music Intelligence — 契約型（Dance Music Intelligence Engine）
 *
 * Formation Engine が消費する StructureResultV2 / ChangePoint は後方互換を維持。
 * 本モジュールは「追加フィールド」として音楽理解・ダンス知能を表現する。
 */

/** 解析パイプラインのバージョン束 */
export type FlyVersionBundle = {
  analyzerVersion: string;
  fusionVersion: string;
  danceModelVersion: string;
  formationModelVersion: string;
};

export type AudioMetadata = {
  audioHash: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  format: string;
  analyzerVersion: string;
};

export type BeatAnalysis = {
  bpm: number;
  beats: number[];
  confidence: number;
  source: string;
};

export type TempoAnalysis = {
  estimatedBpm: number;
  bpmCandidates: number[];
  confidence: number;
  stability: number;
  halfTimeProbability: number;
  doubleTimeProbability: number;
};

export type CountGridBeat = {
  index: number;
  time: number;
  confidence: number;
};

export type CountGridBar = {
  index: number;
  startTime: number;
  endTime: number;
};

export type CountGridEight = {
  index: number;
  startTime: number;
  endTime: number;
  confidence: number;
};

export type CountGrid = {
  bpm: number;
  beatDuration: number;
  beats: CountGridBeat[];
  bars: CountGridBar[];
  eights: CountGridEight[];
};

export type FlySectionType =
  | "intro"
  | "verse"
  | "pre_chorus"
  | "chorus"
  | "post_chorus"
  | "bridge"
  | "break"
  | "drop"
  | "outro"
  | "unknown";

export type FlyMusicSection = {
  id: string;
  startTime: number;
  endTime: number;
  startEight: number;
  endEight: number;
  type: FlySectionType;
  confidence: number;
  energy: number;
  tension: number;
  impact: number;
  density: number;
  /** 表示用（Aメロ等）。構造の正は type + confidence */
  label?: string;
};

export type MusicEventType =
  | "BEAT"
  | "DOWNBEAT"
  | "BAR_START"
  | "SECTION_CHANGE"
  | "ENERGY_RISE"
  | "ENERGY_DROP"
  | "IMPACT"
  | "DROP"
  | "BREAK"
  | "VOCAL_ENTRY"
  | "VOCAL_EXIT"
  | "DRUM_ENTRY"
  | "DRUM_BREAK"
  | "BASS_ENTRY"
  | "BASS_DROP"
  | "REPETITION"
  | "CONTRAST";

export type MusicEvent = {
  id: string;
  type: MusicEventType;
  time: number;
  eightIndex: number;
  strength: number;
  confidence: number;
  sourceSignals: string[];
  description?: string;
};

export type FlyMomentScore = {
  time: number;
  eightIndex: number;
  structuralChange: number;
  energyChange: number;
  rhythmicImpact: number;
  vocalChange: number;
  drumChange: number;
  bassChange: number;
  repetitionBreak: number;
  formationOpportunity: number;
  formationImpact: number;
  confidence: number;
};

export type FormationChangePoint = {
  eightIndex: number;
  musicTime: number;
  sectionType: string;
  changeStrength: number;
  formationOpportunity: number;
  formationImpact: number;
  transitionUrgency: number;
  recommendedStartEight: number;
  confidence: number;
  reasons: string[];
  /** 既存 Tier 互換 */
  tier?: "MINOR" | "MEDIUM" | "MAJOR";
};

export type AnalysisQuality = {
  beatConfidence: number;
  tempoConfidence: number;
  structureConfidence: number;
  eventConfidence: number;
  sourceAgreement: number;
  overall: number;
};

export type FlySourceContribution = {
  id: string;
  role: "primary" | "secondary" | "optional" | "degraded";
  available: boolean;
  version?: string;
  note?: string;
};

/**
 * FLY 解析の完全版（DB / API 拡張用）。
 * 既存 song_analysis.structure_v2 は別途保持し、ここへ投影する。
 */
export type FlyAnalysisResult = {
  audioHash: string;
  versions: FlyVersionBundle;
  metadata: AudioMetadata;
  tempo: TempoAnalysis;
  beat: BeatAnalysis;
  countGrid: CountGrid;
  sections: FlyMusicSection[];
  events: MusicEvent[];
  moments: FlyMomentScore[];
  formationChangePoints: FormationChangePoint[];
  songDynamism: number;
  overallConfidence: number;
  quality: AnalysisQuality;
  sources: FlySourceContribution[];
  /** Formation Engine 向け後方互換（必須） */
  structureV2Compatible: boolean;
  /** 劣化モード（外部 API 失敗など） */
  degraded?: boolean;
  degradationNotes?: string[];
};

/** Dance Intelligence の重み（設定可能） */
export type FlyFusionWeights = {
  structural: number;
  energy: number;
  impact: number;
  sectionChange: number;
  contrast: number;
};

export const DEFAULT_FLY_FUSION_WEIGHTS: FlyFusionWeights = {
  structural: 0.25,
  energy: 0.2,
  impact: 0.2,
  sectionChange: 0.2,
  contrast: 0.15,
};

export const DEFAULT_FORMATION_SCORE_WEIGHTS = {
  musicFit: 0.3,
  visualImpact: 0.2,
  movementFeasibility: 0.2,
  spatialBalance: 0.1,
  contrast: 0.1,
  repetition: 0.05,
  risk: 0.05,
} as const;

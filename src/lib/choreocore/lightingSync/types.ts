/**
 * 音声解析×照明連動 立ち位置AI提案エンジン — 型定義
 */

export type SectionType =
  | "intro"
  | "verse"
  | "chorus"
  | "drop"
  | "se_trigger"
  | "outro";

export type PoseLevel = "stand" | "crouch" | "sit";

export type LightingPresetId =
  | "pin_spot_dark"
  | "guide_mono"
  | "full_bright_warm"
  | "strobe_flash"
  | "color_switch"
  | "fade_spot";

export type FormationPatternId =
  | "center_condensed"
  | "silhouette_line"
  | "split_lr"
  | "small_groups"
  | "vee"
  | "double_u" // W字
  | "wide_spread"
  | "fast_shift"
  | "circle"
  | "dynamic_cross"
  | "front_asymmetry";

export type ClassProfile = {
  classId: string;
  className: string;
  targetAgeGroup: "toddler" | "elementary" | "advanced";
  maxMoveDistancePerCount: number;
  minCountsBetweenChanges: number;
  gridSnapMode: "integer" | "free";
  allowCrossMovement: boolean;
  use3DLeveling: boolean;
};

export type FcpMarker = {
  fcpId: string;
  timestamp: number;
  countNumber: number;
  sectionType: SectionType;
  energyLevel: number;
};

export type AudioAnalysisResult = {
  bpm: number;
  duration: number;
  totalCounts: number;
  fcpMarkers: FcpMarker[];
};

export type MemberPosition = {
  memberId: string;
  x: number;
  y: number;
  poseLevel: PoseLevel;
};

export type SuggestedFormationFrame = {
  fcpId: string;
  timestamp: number;
  count: number;
  presetName: string;
  lightingPreset: LightingPresetId;
  /** 実演会プラン由来の色ムード（任意） */
  colorMood?: string;
  /** 参照した実プランの照明要望メモ */
  lightingNote?: string;
  /** 参照元演目名 */
  referenceShowTitle?: string;
  positions: MemberPosition[];
  warnings?: ConstraintWarning[];
  /** 実際に選んだ隊形ファミリー */
  formationPattern?: FormationPatternId;
  /** エディタ雛形 id（約200種から選定） */
  layoutPresetId?: string;
};

export type ConstraintWarning = {
  code: "MOVE_LIMIT" | "CROSS_FORBIDDEN" | "OVERLAP" | "MIN_GAP";
  message: string;
  memberIds?: string[];
  /** 補正後の座標ヒント（あれば） */
  correctionPointers?: Array<{ memberId: string; x: number; y: number }>;
};

export type LightingSyncSuggestPayload = {
  classId: string;
  audioAnalysis: {
    bpm: number;
    totalCounts: number;
  };
  formations: SuggestedFormationFrame[];
};

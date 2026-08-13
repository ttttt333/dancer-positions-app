import type { ChangePointType } from "./MusicTypes";

export type FormationCueAction =
  | "HOLD"
  | "MICRO_SHIFT"
  | "EXPAND"
  | "CONTRACT"
  | "SPLIT"
  | "MERGE"
  | "CENTER"
  | "LINE"
  | "DIAGONAL"
  | "V"
  | "TRIANGLE"
  | "ARC"
  | "CLUSTER"
  | "MAJOR_CHANGE";

export type FormationChangeMagnitude =
  | "NONE"
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "MAX";

export type EnergyDirection = "RISING" | "FALLING" | "STABLE";
export type EnergyLevel = "LOW" | "MID" | "HIGH";

export type FormationCue = {
  id: string;
  rawTime: number;
  beatTime: number | null;
  barTime: number | null;
  action: FormationCueAction;
  magnitude: FormationChangeMagnitude;
  priority: number;
  confidence: number;
  reasonCodes: string[];
  sourceEventClusterId: string;
  sourceChangePointIds: string[];
  energyBefore: number;
  energyAfter: number;
  deltaEnergy: number;
  isMajor: boolean;
  isLocked: boolean;
  suppressed: boolean;
};

export type FormationCueIntent = {
  primary: FormationCueAction;
  secondary: FormationCueAction[];
  prohibited: FormationCueAction[];
};

export type CueEngineConfig = {
  lowPriorityCooldownBeats: number;
  mediumPriorityCooldownBeats: number;
  highPriorityCooldownBeats: number;
  majorPriorityThreshold: number;
  microShiftThreshold: number;
  minimumConfidence: number;
  anticipationBeats: number;
  clusterMergeWindowSeconds: number;
  repetitionPenalty: number;
};

export type CueAnalysisResult = {
  cues: FormationCue[];
  intents: Record<string, FormationCueIntent>;
  suppressedEvents: { eventClusterId: string; reason: string }[];
  confidence: number;
  analysisVersion: string;
};

export type FormationStyle =
  | "POWER"
  | "CLEAN"
  | "DYNAMIC"
  | "ARTISTIC"
  | "STREET"
  | "SHOW";

export type StageConfig = {
  width: number;
  depth: number;
  safeMargin: number;
  minDancerDistance: number;
};

/**
 * Phase 4 FormationCandidateGenerator input. Cue Engine does not generate
 * positions — this is the handoff contract only.
 */
export type FormationRequest = {
  dancerCount: number;
  cue: FormationCue;
  intent: FormationCueIntent;
  currentFormation?: {
    id: string;
    positions: Record<string, { x: number; y: number }>;
  };
  stage: StageConfig;
  style?: FormationStyle;
};

export type CueEnergyContext = {
  level: EnergyLevel;
  direction: EnergyDirection;
};

export type ClusterTypeSet = Set<ChangePointType>;

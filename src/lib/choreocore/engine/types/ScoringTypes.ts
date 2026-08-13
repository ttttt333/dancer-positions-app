import type { MusicAnalysisResultPhase1 } from "./AnalysisTypes";
import type {
  FormationCue,
  FormationCueIntent,
  FormationStyle,
  StageConfig,
} from "./CueTypes";
import type { Formation, FormationCandidate, FormationType } from "./FormationTypes";
import type { MusicPhrase, MusicSection, MusicStructureAnalysisResult } from "./MusicTypes";
import type { TransitionAnalysis } from "./MovementTypes";
import type { CueAnalysisResult } from "./CueTypes";

export const FORMATION_SEQUENCE_VERSION = "3.0.0-phase6";

export type CandidateScoreWeights = {
  musicFit: number;
  visualImpact: number;
  transitionQuality: number;
  feasibility: number;
  spacing: number;
  symmetry: number;
  complexity: number;
  novelty: number;
};

export type SequenceScoreWeights = {
  candidateQuality: number;
  transitionQuality: number;
  musicStory: number;
  visualStory: number;
  execution: number;
  variety: number;
  futurePotential: number;
};

export type CandidateScore = {
  candidateId: string;
  musicFit: number;
  visualImpact: number;
  transitionQuality: number;
  feasibility: number;
  spacing: number;
  symmetry: number;
  complexity: number;
  novelty: number;
  futurePotential: number;
  totalScore: number;
  penalties: {
    repetition: number;
    movementRisk: number;
    excessiveChange: number;
    visualMonotony: number;
  };
  reasons: string[];
};

export type FormationSequenceScore = {
  formations: string[];
  candidateScores: CandidateScore[];
  transitionScores: number[];
  musicStoryScore: number;
  visualStoryScore: number;
  executionScore: number;
  varietyScore: number;
  totalScore: number;
};

export type BeamSearchConfig = {
  beamWidth: number;
  lookAhead: number;
  minimumCandidateScore: number;
  minimumFeasibility: number;
  repetitionPenalty: number;
  monotonyPenalty: number;
  futurePotentialWeight: number;
  deadEndPenalty: number;
  trapPenalty: number;
  debug?: boolean;
};

export type BeamState = {
  formationHistory: Formation[];
  candidateIds: string[];
  score: number;
  history: CandidateScore[];
  transitions: TransitionAnalysis[];
  lastCueIndex: number;
  repetitionPenalty: number;
  noveltyScore: number;
};

export type SequenceUpperBound = {
  estimate: (state: BeamState, remainingCueCount: number) => number;
};

export type CandidateScoringContext = {
  cue: FormationCue;
  intent?: FormationCueIntent;
  currentFormation: Formation;
  previousFormations: Formation[];
  stage: StageConfig;
  style: FormationStyle;
  section?: MusicSection;
  phrase?: MusicPhrase;
  nextCue?: FormationCue;
  nextCueIsMajor?: boolean;
  nextFeasibleScores?: number[];
  nextNextFeasibleScores?: number[];
  weights?: CandidateScoreWeights;
  config?: Partial<BeamSearchConfig>;
};

export type SequenceScoringContext = {
  cues: FormationCue[];
  sections: MusicSection[];
  style?: FormationStyle;
  config?: Partial<BeamSearchConfig>;
};

export type FormationOptimizationInput = {
  phase1: MusicAnalysisResultPhase1;
  musicStructure: MusicStructureAnalysisResult;
  cueAnalysis: CueAnalysisResult;
  candidatesByCue: Record<string, FormationCandidate[]>;
  transitionsByCue: Record<string, TransitionAnalysis[]>;
  currentFormation: Formation;
  stage: StageConfig;
  style?: FormationStyle;
  config?: Partial<BeamSearchConfig>;
};

export type FormationSequenceResult = {
  formations: Formation[];
  cues: FormationCue[];
  candidateScores: CandidateScore[];
  transitions: TransitionAnalysis[];
  totalScore: number;
  breakdown: {
    musicFit: number;
    visualImpact: number;
    transition: number;
    feasibility: number;
    variety: number;
    story: number;
  };
  search: {
    beamWidth: number;
    lookAhead: number;
    statesEvaluated: number;
    statesPruned: number;
    maxBeamSize: number;
    futureCuesScanned: number;
  };
  confidence: number;
  analysisVersion: string;
  debugExclusions: Array<{ candidateId: string; cueId: string; reason: string }>;
};

export type FormationFamily =
  | "LINE"
  | "V"
  | "DIAGONAL"
  | "CENTER"
  | "SPLIT"
  | "ARC"
  | "GRID"
  | "OTHER";

export const FORMATION_FAMILY: Record<FormationType, FormationFamily> = {
  LINE: "LINE",
  DOUBLE_LINE: "LINE",
  V: "V",
  WIDE_V: "V",
  ARROW: "V",
  DIAGONAL: "DIAGONAL",
  DOUBLE_DIAGONAL: "DIAGONAL",
  CENTER: "CENTER",
  CENTER_WINGS: "CENTER",
  CLUSTER: "CENTER",
  TRIANGLE: "CENTER",
  PYRAMID: "CENTER",
  DIAMOND: "CENTER",
  SPLIT: "SPLIT",
  ARC: "ARC",
  GRID: "GRID",
  CUSTOM: "OTHER",
};

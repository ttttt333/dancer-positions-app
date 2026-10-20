/**
 * Phase 4.6 Real-Song Ground Truth contracts.
 * musical_change ≠ formation_change.
 */

export type SourceType = "USER_OWNED" | "LICENSED" | "AUTHORIZED_DATASET";

export type TempoClass = "SLOW" | "MEDIUM" | "FAST";
export type BeatDensity = "LOW" | "MEDIUM" | "HIGH";
export type StructureComplexity = "SIMPLE" | "MEDIUM" | "COMPLEX";
export type VocalClass = "VOCAL" | "INSTRUMENTAL";
export type VersionClass =
  | "ORIGINAL"
  | "LIVE"
  | "REMIX"
  | "MASHUP"
  | "OTHER";

export type AnnotationStatus =
  | "UNANNOTATED"
  | "ANNOTATED"
  | "REVIEWED"
  | "ADJUDICATED";

export type DatasetSplit = "DEVELOPMENT" | "VALIDATION" | "HOLDOUT";

export type RealSongConditions = {
  genre: string[];
  tempoClass: TempoClass;
  beatDensity: BeatDensity;
  structureComplexity: StructureComplexity;
  vocal: VocalClass;
  version: VersionClass;
  /** Extra difficulty tags for Active Expansion */
  flags?: string[];
};

export type RealSongManifest = {
  songId: string;
  title?: string;
  artist?: string;
  /** PENDING_* until local audio hashed */
  audioSha256: string;
  sourceType: SourceType;
  durationSec: number;
  conditions: RealSongConditions;
  annotationVersion: string;
  annotators: string[];
  status: AnnotationStatus;
  datasetSplit: DatasetSplit;
  realSongDatasetVersion: string;
  provenanceVersion: string;
  selectionIntent: string;
  doubleAnnotate: boolean;
};

export type MusicalChangeReason =
  | "SECTION_CHANGE"
  | "ENERGY_RISE"
  | "ENERGY_DROP"
  | "BEAT_CHANGE"
  | "RHYTHM_CHANGE"
  | "INSTRUMENT_CHANGE"
  | "VOCAL_CHANGE"
  | "DROP"
  | "BREAK"
  | "IMPACT"
  | "OTHER";

export type MusicalChangeStrength = "LOW" | "MEDIUM" | "HIGH";

export type MusicalChange = {
  timeSec: number;
  strength: MusicalChangeStrength;
  reasons: MusicalChangeReason[];
  confidence: number;
};

export type GroundTruthSectionLabel =
  | "INTRO"
  | "VERSE"
  | "PRE_CHORUS"
  | "CHORUS"
  | "BRIDGE"
  | "BREAK"
  | "DROP"
  | "OUTRO"
  | "OTHER";

export type GroundTruthSection = {
  startSec: number;
  endSec: number;
  label: GroundTruthSectionLabel;
  confidence: number;
};

export type GroundTruthCountGrid = {
  startSec: number;
  bpm: number;
  beatOffsetSec: number;
  barsPerPhrase: 2;
  /** Optional per-count checkpoints */
  countMarkersSec?: number[];
};

export type RealSongAnnotation = {
  songId: string;
  annotatorId: string;
  annotationVersion: string;
  audioSha256: string;
  /** Human-first — never copied from analyzer */
  bpm: number | null;
  bpmConfidence: number;
  beats: number[];
  downbeats: number[];
  countGrid: GroundTruthCountGrid | null;
  sections: GroundTruthSection[];
  musicalChanges?: MusicalChange[];
  annotatedAt: string;
  notes?: string;
};

/**
 * Evaluation view of beats[] / downbeats[] (not required on disk).
 * See docs/fly/PHASE46-BEAT-PATTERN-GT.md
 */
export type BeatPatternGt = {
  patternStartSec: number;
  patternEndSec: number;
  bpm: number | null;
  intervalSec: number;
  phaseSec: number;
  continuation: boolean;
  continuationUntilSec: number;
  patternConfidence: number;
};

export type HumanAgreementReport = {
  songId: string;
  annotatorA: string;
  annotatorB: string;
  sectionBoundaryMedianMs: number | null;
  sectionLabelAgreement: number | null;
  beatAgreementF1At40ms: number | null;
  bpmAbsoluteError: number | null;
  musicalChangeAgreement: number | null;
};

export type WeaknessDimension =
  | "BPM"
  | "BEAT"
  | "DOWNBEAT"
  | "8COUNT"
  | "SECTION"
  | "MUSICAL_CHANGE";

export type WeaknessSeverity = "INFO" | "WATCH" | "WEAK";

export type WeaknessFinding = {
  analyzer: string;
  dimension: WeaknessDimension;
  condition: string;
  score: number;
  sampleCount: number;
  evidenceConfidence: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  severity: WeaknessSeverity;
  note?: string;
};

export type ExpansionPlan = {
  suggestedSongCount: number;
  targetConditions: string[];
  rationale: string[];
  basedOnFindings: WeaknessFinding[];
  lowSampleSizeWarning: boolean;
};

export type AnalyzerHypothesisFile = {
  songId: string;
  audioSha256: string;
  analyzerId: "librosa" | "essentia" | string;
  analyzerVersion: string;
  adapterVersion?: string;
  producedAt: string;
  bpm?: number | null;
  beats?: number[] | null;
  downbeats?: number[] | null;
  onsets?: number[] | null;
  sections?: GroundTruthSection[] | null;
  eightCountStarts?: number[] | null;
  events?: Array<{ timestamp: number; type: string }> | null;
};

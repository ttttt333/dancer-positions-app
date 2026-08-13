import type { FrequencyBandEnergy } from "./AudioTypes";
import type { HitEvent } from "./HitTypes";

export type MusicSectionType =
  | "INTRO"
  | "VERSE"
  | "PRE_CHORUS"
  | "CHORUS"
  | "DROP"
  | "BREAK"
  | "BRIDGE"
  | "FINAL_CHORUS"
  | "OUTRO"
  | "UNKNOWN";

export type MusicSection = {
  id: string;
  type: MusicSectionType;
  startTime: number;
  endTime: number;
  startBar: number;
  endBar: number;
  barCount: number;
  energyMean: number;
  energyPeak: number;
  energyDelta: number;
  rhythmicDensity: number;
  spectralProfile: FrequencyBandEnergy;
  confidence: number;
};

export type MusicPhraseType =
  | "PREPARATION"
  | "DEVELOPMENT"
  | "RELEASE"
  | "REPETITION"
  | "TRANSITION"
  | "UNKNOWN";

export type MusicPhrase = {
  id: string;
  type: MusicPhraseType;
  startTime: number;
  endTime: number;
  startBar: number;
  endBar: number;
  barCount: number;
  energyStart: number;
  energyEnd: number;
  energyDelta: number;
  confidence: number;
};

export type ChangePointType =
  | "ENERGY_RISE"
  | "ENERGY_DROP"
  | "SECTION_CHANGE"
  | "PHRASE_CHANGE"
  | "HIT"
  | "DRUM_ENTRY"
  | "DRUM_BREAK"
  | "BASS_ENTRY"
  | "SILENCE"
  | "SPECTRAL_CHANGE";

export type ChangePoint = {
  id: string;
  time: number;
  rawTime: number;
  beatTime: number;
  barTime: number;
  barIndex: number;
  beatIndex: number;
  type: ChangePointType;
  strength: number;
  confidence: number;
  sourceEventIds: string[];
  energyBefore: number;
  energyAfter: number;
  deltaEnergy: number;
  priority: number;
};

export type EventCluster = {
  id: string;
  time: number;
  changePoints: ChangePoint[];
  dominantType: ChangePointType;
  totalStrength: number;
  confidence: number;
  isMajor: boolean;
};

export type SectionBoundaryWeights = {
  energyChange: number;
  spectralChange: number;
  rhythmChange: number;
  bassChange: number;
  onsetChange: number;
  phraseStructureChange: number;
};

export type MusicStructureConfig = {
  minimumSectionBars: number;
  sectionBoundaryThreshold: number;
  minimumPhraseBars: number;
  maximumPhraseBars: number;
  eventClusterWindowSeconds: number;
  majorEnergyRiseThreshold: number;
  majorEnergyDropThreshold: number;
  silenceThreshold: number;
  silenceMinimumDuration: number;
  drumDensityWindow: number;
  bassRiseThreshold: number;
  spectralChangeThreshold: number;
  beatSnapTolerance: number;
  sectionBoundaryWeights: SectionBoundaryWeights;
};

export type MusicStructureAnalysisResult = {
  sections: MusicSection[];
  phrases: MusicPhrase[];
  hits: HitEvent[];
  changePoints: ChangePoint[];
  eventClusters: EventCluster[];
  confidence: number;
  analysisVersion: string;
};

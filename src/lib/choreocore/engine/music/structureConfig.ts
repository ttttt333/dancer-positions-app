import type {
  ChangePointType,
  MusicStructureConfig,
  SectionBoundaryWeights,
} from "../types/MusicTypes";

export const STRUCTURE_ANALYSIS_VERSION = "3.0.0-phase2";

export const DEFAULT_SECTION_BOUNDARY_WEIGHTS: SectionBoundaryWeights = {
  energyChange: 0.3,
  spectralChange: 0.2,
  rhythmChange: 0.2,
  bassChange: 0.1,
  onsetChange: 0.1,
  phraseStructureChange: 0.1,
};

export const DEFAULT_MUSIC_STRUCTURE_CONFIG: MusicStructureConfig = {
  minimumSectionBars: 4,
  sectionBoundaryThreshold: 28,
  minimumPhraseBars: 4,
  maximumPhraseBars: 16,
  eventClusterWindowSeconds: 0.2,
  majorEnergyRiseThreshold: 25,
  majorEnergyDropThreshold: 25,
  silenceThreshold: 8,
  silenceMinimumDuration: 0.8,
  drumDensityWindow: 1.5,
  bassRiseThreshold: 0.22,
  spectralChangeThreshold: 0.32,
  beatSnapTolerance: 0.15,
  sectionBoundaryWeights: DEFAULT_SECTION_BOUNDARY_WEIGHTS,
};

export const CHANGE_POINT_PRIORITY: Record<ChangePointType, number> = {
  SECTION_CHANGE: 40,
  ENERGY_RISE: 30,
  ENERGY_DROP: 30,
  HIT: 35,
  PHRASE_CHANGE: 15,
  DRUM_ENTRY: 25,
  DRUM_BREAK: 25,
  BASS_ENTRY: 25,
  SILENCE: 35,
  SPECTRAL_CHANGE: 20,
};

export function resolveMusicStructureConfig(
  partial?: Partial<MusicStructureConfig>
): MusicStructureConfig {
  if (!partial) return DEFAULT_MUSIC_STRUCTURE_CONFIG;
  return {
    ...DEFAULT_MUSIC_STRUCTURE_CONFIG,
    ...partial,
    sectionBoundaryWeights: {
      ...DEFAULT_SECTION_BOUNDARY_WEIGHTS,
      ...partial.sectionBoundaryWeights,
    },
  };
}

export {
  ANALYSIS_VERSION,
  FRAME_SIZE,
  HOP_SIZE,
  MIN_BPM,
  MAX_BPM,
  DEFAULT_ANALYSIS_CONFIG,
  DEFAULT_ENERGY_WEIGHTS,
  DEFAULT_BEATS_PER_BAR,
  resolveAnalysisConfig,
} from "./constants";

export { analyzeAudio, extractAudioFeatureFrames, calculateRms } from "./audio/AudioAnalyzer";
export { decodeAudio } from "./audio/AudioDecode";
export {
  calculateEnergyCurve,
  detectEnergyInflections,
  detectEnergyPeaks,
  energyCurveFromValues,
} from "./audio/EnergyAnalyzer";
export { detectBeats, estimateTempo } from "./audio/BeatDetector";
export { detectOnsets, calculateOnsetStrength } from "./audio/OnsetDetector";
export {
  analyzeFrequencyBands,
  calculateFrequencyBandEnergy,
  FREQUENCY_BANDS_HZ,
} from "./audio/FrequencyBandAnalyzer";
export {
  computeMagnitudeSpectrum,
  calculateSpectralCentroid,
  calculateSpectralFlux,
  spectralCentroidHz,
  spectralFlux,
} from "./audio/SpectralAnalyzer";
export { beatInBarFromIndex, barIndexFromBeatIndex } from "./audio/meter";
export {
  summarizeAnalysis,
  formatAnalysisSummary,
} from "./music/MusicAnalysisPipeline";
export {
  STRUCTURE_ANALYSIS_VERSION,
  DEFAULT_MUSIC_STRUCTURE_CONFIG,
  DEFAULT_SECTION_BOUNDARY_WEIGHTS,
  CHANGE_POINT_PRIORITY,
  resolveMusicStructureConfig,
} from "./music/structureConfig";
export { analyzeMusicStructure } from "./music/MusicStructureAnalyzer";
export { detectSections, detectSectionBoundaries } from "./music/SectionDetector";
export { detectPhrases } from "./music/PhraseDetector";
export { detectChangePoints, clusterChangePoints } from "./music/ChangePointDetector";
export { classifyHits } from "./music/HitClassifier";
export { snapToBeatGrid } from "./music/structureMath";
export { generateFormationCues } from "./cue/CueEngine";
export {
  CUE_ANALYSIS_VERSION,
  DEFAULT_CUE_ENGINE_CONFIG,
  resolveCueEngineConfig,
} from "./cue/cueConfig";
export { generateFormationCandidates } from "./formation/FormationCandidateGenerator";
export {
  defaultFormationTemplateRegistry,
  FormationTemplateRegistry,
  createDefaultFormationTemplateRegistry,
} from "./formation/FormationTemplateRegistry";
export { validateFormation } from "./formation/FormationValidator";
export { formationSignature, normalizedSignature } from "./formation/FormationNormalizer";
export { stageToUnit, unitToStage, spreadForCue } from "./formation/FormationScaler";
export { FORMATION_CANDIDATE_VERSION, FormationGenerationError } from "./types/FormationTypes";
export { MOVEMENT_ANALYSIS_VERSION, DEFAULT_MOVEMENT_ABILITY } from "./types/MovementTypes";
export { FORMATION_SEQUENCE_VERSION } from "./types/ScoringTypes";
export { EVALUATION_VERSION, ANNOTATION_VERSION } from "./types/EvaluationTypes";
export { REALWORLD_VERSION } from "./types/RealWorldTypes";
export {
  runBenchmark,
  calculateBenchmarkSummary,
  detectRegression,
  recordHistory,
  AnalysisCache,
} from "./evaluation/BenchmarkRunner";
export { evaluateSong } from "./evaluation/EvaluationRunner";
export { evaluateCues } from "./evaluation/CueEvaluator";
export { evaluateSections } from "./evaluation/SectionEvaluator";
export { evaluateFormations } from "./evaluation/FormationEvaluator";
export { evaluateTransitions } from "./evaluation/TransitionEvaluator";
export { evaluateSequence } from "./evaluation/SequenceEvaluator";
export { humanCueAgreement, humanFormationAgreement } from "./evaluation/HumanRatingEvaluator";
export { formatBenchmarkReport } from "./evaluation/BenchmarkReport";
export { resolveBenchmarkConfig, DEFAULT_BENCHMARK_CONFIG } from "./evaluation/EvaluationConfig";
export { syntheticBenchmarkDataset } from "./evaluation/syntheticDataset";
export { runRealWorldBenchmark, compareBenchmarkRuns } from "./realworld/RealWorldBenchmark";
export {
  generateTuningCandidates,
  evaluateTuningCandidate,
  paretoFrontier,
  recordTuningHistory,
} from "./realworld/TuningEngine";
export {
  calculateHumanCeiling,
  calculateHumanCeilingRatio,
} from "./realworld/HumanCeiling";
export { generateFailureMatrix } from "./realworld/FailureMatrix";
export { generateTuningRecommendations } from "./realworld/TuningRecommendations";
export { formatRealWorldReport } from "./realworld/RealWorldReport";
export { adviseImprovement } from "./advisor/ImprovementAdvisor";
export { formatQualityReport } from "./advisor/QualityReport";
export { evaluateQualityGates } from "./advisor/QualityGates";
export { layerPriorityScore } from "./advisor/PriorityModel";
export { ADVISOR_VERSION, QUALITY_GATE_TARGETS } from "./types/AdvisorTypes";
export {
  createAnnotationSession,
  completeAnnotationSession,
  validateAnnotationSession,
  calculateAnnotationQuality,
  calculateInterRaterAgreement,
  generateConsensus,
  generateGroundTruthSet,
  generateConsensusReviewItems,
  runCalibration,
  importAnnotationJson,
  importAnnotationSessionsJson,
  exportAnnotationJson,
  exportGroundTruthJson,
  ANNOTATION_INSTRUCTIONS,
  ANNOTATION_WORKFLOW_VERSION,
} from "./annotation";
export {
  runRealSongPilot,
  generatePilotReport,
  generateDisagreementHeatmap,
  generateLayerDiagnostics,
  PILOT_VERSION,
} from "./pilot";
export {
  scoreFormationCandidate,
  scoreFormationSequence,
  optimizeFormationSequence,
} from "./scoring/FormationOptimizer";
export {
  DEFAULT_CANDIDATE_WEIGHTS,
  DEFAULT_SEQUENCE_WEIGHTS,
  DEFAULT_BEAM_SEARCH_CONFIG,
  resolveCandidateWeights,
  resolveBeamSearchConfig,
} from "./scoring/ScoreWeights";
export {
  analyzeFormationTransition,
  analyzeFormationTransitions,
  filterFeasibleTransitions,
} from "./movement/TransitionAnalyzer";
export { calculateTravelDistance, normalizeDistance } from "./movement/TravelDistance";
export {
  calculateRequiredTravelTime,
  calculateMovementFeasibility,
  effectiveSpeedPx,
} from "./movement/MovementSpeed";
export {
  detectFormationCollisions,
  detectMovementCollisions,
} from "./movement/CollisionDetector";
export { calculateTransitionScore } from "./movement/TransitionScorer";
export { assignDancersToTargets } from "./movement/AssignmentAdapter";
export { calculatePushingLimit } from "./movement/PushingLimitAdapter";
export {
  resolveMovementTiming,
  makeMovementTiming,
  secondsToBeats,
} from "./movement/MovementTiming";

export type { EnergyInflectionOptions } from "./audio/EnergyAnalyzer";
export type { DetectOnsetsOptions } from "./audio/OnsetDetector";

export type {
  AudioFeatureFrame,
  BeatEvent,
  TempoAnalysis,
  EngineAudioBuffer,
  FrequencyBandEnergy,
  EnergyPoint,
  EnergyCurve,
  EnergyInflection,
  EnergyInflectionType,
  EnergyPeak,
  HitEvent,
  HitType,
  AudioAnalysisErrorCode,
  EnergyWeights,
  AudioAnalysisConfig,
  MusicAnalysisResultPhase1,
  AnalysisSummary,
  MusicSectionType,
  MusicSection,
  MusicPhraseType,
  MusicPhrase,
  ChangePointType,
  ChangePoint,
  EventCluster,
  SectionBoundaryWeights,
  MusicStructureConfig,
  MusicStructureAnalysisResult,
  FormationCueAction,
  FormationChangeMagnitude,
  FormationCue,
  FormationCueIntent,
  CueEngineConfig,
  CueAnalysisResult,
  FormationRequest,
  FormationStyle,
  StageConfig,
  FormationType,
  EngineFormation,
  FormationCandidate,
  FormationTemplate,
  MovementAbility,
  MovementTiming,
  DancerMovement,
  CollisionResult,
  MovementPlan,
  TransitionContext,
  TransitionAnalysis,
  MovementEngineConfig,
  CandidateScore,
  FormationSequenceScore,
  BeamSearchConfig,
  FormationOptimizationInput,
  FormationSequenceResult,
  EvaluationResult,
  BenchmarkSummary,
  BenchmarkConfig,
  SongGroundTruth,
  RealWorldBenchmarkResult,
  TuningCandidate,
  QualityAdvisorReport,
} from "./types";
export type {
  AnnotationSession,
  GroundTruthSet,
  AnnotationQualityReport,
  InterRaterAgreement,
  CalibrationResult,
} from "./types";
export type { RealWorldPilotResult, PilotStatus } from "./types";
export type { Formation } from "./types/FormationTypes";
export type { ChangePoint as MusicChangePoint } from "./types";
export { AudioAnalysisError } from "./types";

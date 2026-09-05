/**
 * 本番が扱う音楽タイムライン契約（engine 定義の再 export）。
 */
export {
  timelineFromPhase2,
  cloneMusicStructureResult,
  finalizeProductionTimeline,
  timelineToMusicStructure,
  recordMusicEngineTrace,
  getLastMusicEngineTrace,
  resetMusicEngineTrace,
  isRealPhase1Provenance,
  type MusicAnalysisSource,
  type UnifiedMusicTimeline,
  type MusicAccuracyExpected,
  type MusicAccuracyCase,
  type MusicAccuracyMetrics,
  type MusicEngineTrace,
  type Phase2FallbackReason,
  type Phase2OverwriteSite,
} from "../engine/music/productionTimeline";

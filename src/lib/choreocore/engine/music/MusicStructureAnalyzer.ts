import type { MusicAnalysisResultPhase1 } from "../types";
import type {
  MusicStructureAnalysisResult,
  MusicStructureConfig,
} from "../types/MusicTypes";
import {
  STRUCTURE_ANALYSIS_VERSION,
  resolveMusicStructureConfig,
} from "./structureConfig";
import { buildBeatSnapshots } from "./structureMath";
import { detectSections } from "./SectionDetector";
import { detectPhrases } from "./PhraseDetector";
import { classifyHits } from "./HitClassifier";
import { detectChangePoints } from "./ChangePointDetector";
import { clamp01 } from "../audio/signalMath";

/**
 * Phase 2 structure analysis. Does not mutate the Phase 1 result.
 */
export function analyzeMusicStructure(
  phase1: MusicAnalysisResultPhase1,
  config?: Partial<MusicStructureConfig>
): MusicStructureAnalysisResult {
  const cfg = resolveMusicStructureConfig(config);
  const snaps = buildBeatSnapshots(phase1);
  const sections = detectSections(phase1, cfg, snaps);
  const phrases = detectPhrases(phase1, sections, cfg, snaps);
  const hits = classifyHits(phase1.hits, phase1);
  const { changePoints, eventClusters } = detectChangePoints(
    phase1,
    sections,
    phrases,
    hits,
    cfg,
    snaps
  );

  const sectionConf =
    sections.length === 0
      ? 0
      : sections.reduce((s, x) => s + x.confidence, 0) / sections.length;
  const clusterConf =
    eventClusters.length === 0
      ? 0.4
      : eventClusters.reduce((s, x) => s + x.confidence, 0) / eventClusters.length;
  const confidence = clamp01(0.5 * sectionConf + 0.3 * clusterConf + 0.2 * phase1.confidence);

  return {
    sections,
    phrases,
    hits,
    changePoints,
    eventClusters,
    confidence,
    analysisVersion: STRUCTURE_ANALYSIS_VERSION,
  };
}

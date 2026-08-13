import type { AnalysisSummary, MusicAnalysisResultPhase1 } from "../types";

export { analyzeAudio } from "../audio/AudioAnalyzer";
export { decodeAudio } from "../audio/AudioDecode";

/**
 * Compact debug snapshot. Does not log — callers decide whether to print.
 */
export function summarizeAnalysis(
  result: MusicAnalysisResultPhase1
): AnalysisSummary {
  return {
    duration: result.duration,
    bpm: result.tempo.bpm,
    bpmConfidence: result.tempo.confidence,
    frameCount: result.frames.length,
    beatCount: result.beats.length,
    hitCount: result.hits.length,
    energyAverage: result.energyCurve.average,
    energyPeak: result.energyCurve.peak,
    dynamicRange: result.energyCurve.dynamicRange,
  };
}

export function formatAnalysisSummary(result: MusicAnalysisResultPhase1): string {
  const s = summarizeAnalysis(result);
  return [
    `Duration ${s.duration.toFixed(3)}s`,
    `BPM ${s.bpm} (confidence ${s.bpmConfidence.toFixed(2)})`,
    `Frames ${s.frameCount}`,
    `Beats ${s.beatCount}`,
    `Hits ${s.hitCount}`,
    `Energy avg ${s.energyAverage.toFixed(1)} peak ${s.energyPeak.toFixed(1)} range ${s.dynamicRange.toFixed(1)}`,
  ].join("\n");
}

import type { FormationCue } from "../types/CueTypes";
import type { CueMetrics, HumanCueAnnotation } from "../types/EvaluationTypes";
import { beatPeriodSec, matchingWindowSec } from "./EvaluationConfig";
import { clamp, f1Score, finite, mean, median } from "./EvaluationMetrics";

export type CueMatch = {
  humanIndex: number;
  aiIndex: number;
  timeError: number;
  beatError: number;
};

export function matchCues(
  ai: FormationCue[],
  human: HumanCueAnnotation[],
  bpm: number,
  matchingBeats: number
): CueMatch[] {
  const window = matchingWindowSec(bpm, matchingBeats);
  const period = beatPeriodSec(bpm);
  const aiSorted = ai
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.rawTime - b.c.rawTime || a.c.id.localeCompare(b.c.id));
  const humanSorted = human
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.time - b.c.time || a.c.annotatorId.localeCompare(b.c.annotatorId));
  const usedAi = new Set<number>();
  const matches: CueMatch[] = [];
  for (const h of humanSorted) {
    let best = -1;
    let bestAbs = Infinity;
    for (const a of aiSorted) {
      if (usedAi.has(a.i)) continue;
      const err = Math.abs(a.c.rawTime - h.c.time);
      if (err <= window + 1e-9 && err < bestAbs) {
        bestAbs = err;
        best = a.i;
      }
    }
    if (best >= 0) {
      usedAi.add(best);
      const aiCue = ai[best]!;
      matches.push({
        humanIndex: h.i,
        aiIndex: best,
        timeError: Math.abs(aiCue.rawTime - h.c.time),
        beatError: Math.abs(aiCue.rawTime - h.c.time) / period,
      });
    }
  }
  matches.sort((a, b) => a.humanIndex - b.humanIndex || a.aiIndex - b.aiIndex);
  return matches;
}

export function evaluateCues(
  ai: FormationCue[],
  human: HumanCueAnnotation[],
  bpm: number,
  matchingBeats: number,
  majorImportance: number
): CueMetrics {
  const activeHuman = [...human].sort((a, b) => a.time - b.time || a.annotatorId.localeCompare(b.annotatorId));
  const activeAi = [...ai].filter((c) => !c.suppressed);
  if (activeHuman.length === 0 && activeAi.length === 0) {
    return {
      precision: 1,
      recall: 1,
      f1: 1,
      timingErrorMean: 0,
      timingErrorMedian: 0,
      beatErrorMean: 0,
      overgenerationRate: 0,
      underGenerationRate: 0,
      majorCueRecall: 1,
    };
  }
  const matches = matchCues(activeAi, activeHuman, bpm, matchingBeats);
  const tp = matches.length;
  const fp = Math.max(0, activeAi.length - tp);
  const fn = Math.max(0, activeHuman.length - tp);
  const precision = activeAi.length === 0 ? 1 : tp / activeAi.length;
  const recall = activeHuman.length === 0 ? 1 : tp / activeHuman.length;
  const timing = matches.map((m) => m.timeError);
  const beats = matches.map((m) => m.beatError);
  const majors = activeHuman.filter((h) => h.importance >= majorImportance);
  const matchedHuman = new Set(matches.map((m) => m.humanIndex));
  let majorHits = 0;
  for (let i = 0; i < activeHuman.length; i += 1) {
    if (activeHuman[i]!.importance < majorImportance) continue;
    if (!matchedHuman.has(i)) continue;
    const match = matches.find((m) => m.humanIndex === i);
    const cue = match ? activeAi[match.aiIndex] : undefined;
    if (
      cue &&
      (cue.isMajor ||
        cue.action === "MAJOR_CHANGE" ||
        cue.magnitude === "LARGE" ||
        cue.magnitude === "MAX")
    ) {
      majorHits += 1;
    } else if (cue) {
      majorHits += 0.5;
    }
  }
  const majorCueRecall = majors.length === 0 ? 1 : majorHits / majors.length;
  return {
    precision: clamp(finite(precision), 0, 1),
    recall: clamp(finite(recall), 0, 1),
    f1: clamp(f1Score(precision, recall), 0, 1),
    timingErrorMean: mean(timing),
    timingErrorMedian: median(timing),
    beatErrorMean: mean(beats),
    overgenerationRate: activeHuman.length === 0 ? (fp > 0 ? 1 : 0) : fp / activeHuman.length,
    underGenerationRate: activeHuman.length === 0 ? 0 : fn / activeHuman.length,
    majorCueRecall: clamp(finite(majorCueRecall), 0, 1),
  };
}

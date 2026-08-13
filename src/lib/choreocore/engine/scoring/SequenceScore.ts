import type { Formation } from "../types/FormationTypes";
import type { FormationCue } from "../types/CueTypes";
import type { MusicSection } from "../types/MusicTypes";
import type { TransitionAnalysis } from "../types/MovementTypes";
import type {
  CandidateScore,
  FormationSequenceScore,
  SequenceScoringContext,
} from "../types/ScoringTypes";
import { FORMATION_FAMILY } from "../types/ScoringTypes";
import { resolveSequenceWeights } from "./ScoreWeights";
import { clamp, finite, mean } from "./scoreMath";
import { executionScoreFromBands } from "./FeasibilityScore";
import { energyBandTargetCoverage } from "./MusicFitScore";
import { formationContrast } from "./NoveltyScore";

function expectedCoverage(section: MusicSection | undefined, cue: FormationCue): number {
  if (!section) return energyBandTargetCoverage(cue.energyAfter);
  const byType: Record<string, number> = {
    INTRO: 28,
    VERSE: 42,
    PRE_CHORUS: 58,
    CHORUS: 78,
    DROP: 86,
    BREAK: 26,
    BRIDGE: 52,
    FINAL_CHORUS: 90,
    OUTRO: 32,
    UNKNOWN: energyBandTargetCoverage(cue.energyAfter),
  };
  const base = byType[section.type] ?? 50;
  return (base + energyBandTargetCoverage(cue.energyAfter)) / 2;
}

export function musicStoryScore(
  formations: Formation[],
  cues: FormationCue[],
  sections: MusicSection[]
): number {
  if (formations.length === 0) return 0;
  const fits: number[] = [];
  for (let i = 0; i < formations.length; i += 1) {
    const cue = cues[i];
    const section = cue
      ? sections.find((s) => cue.rawTime >= s.startTime && cue.rawTime < s.endTime)
      : undefined;
    const expected = cue ? expectedCoverage(section, cue) : 50;
    fits.push(clamp(100 - Math.abs(formations[i]!.stageCoverage - expected), 0, 100));
  }
  let flow = 70;
  if (formations.length >= 3) {
    const coverages = formations.map((f) => f.stageCoverage);
    const first = mean(coverages.slice(0, Math.ceil(coverages.length / 3)));
    const last = mean(coverages.slice(-Math.ceil(coverages.length / 3)));
    const hasChorus = cues.some((c) =>
      sections.some((s) => s.type === "CHORUS" && c.rawTime >= s.startTime && c.rawTime < s.endTime)
    );
    if (hasChorus && last > first + 8) flow = 88;
    if (last + 5 < first && !cues.some((c) => c.action === "CONTRACT")) flow = 55;
  }
  return clamp(mean(fits) * 0.7 + flow * 0.3, 0, 100);
}

export function visualStoryScore(formations: Formation[]): number {
  if (formations.length === 0) return 0;
  const coverages = formations.map((f) => f.stageCoverage);
  const min = Math.min(...coverages);
  const max = Math.max(...coverages);
  const range = max - min;
  const flatPenalty = range < 8 ? 25 : range < 18 ? 10 : 0;
  let arc = 70;
  if (formations.length >= 3) {
    const a = mean(coverages.slice(0, Math.ceil(coverages.length / 3)));
    const b = mean(
      coverages.slice(
        Math.floor(coverages.length / 3),
        Math.ceil((coverages.length * 2) / 3)
      )
    );
    const c = mean(coverages.slice(-Math.ceil(coverages.length / 3)));
    if (a < b - 4 && b < c - 4) arc = 92;
    else if (a < b - 4 && c < b - 4) arc = 84;
    else if (Math.abs(a - b) < 4 && Math.abs(b - c) < 4) arc = 48;
  }
  return clamp(arc - flatPenalty, 0, 100);
}

export function varietyScore(formations: Formation[], cues: FormationCue[]): number {
  if (formations.length === 0) return 100;
  const unique = new Set(formations.map((f) => f.type)).size;
  const familyUnique = new Set(formations.map((f) => FORMATION_FAMILY[f.type])).size;
  let consecutive = 0;
  for (let i = 1; i < formations.length; i += 1) {
    if (formations[i]!.type === formations[i - 1]!.type) {
      const intended =
        cues[i]?.action === "HOLD" || cues[i]?.action === "MICRO_SHIFT";
      if (!intended) consecutive += 1;
    }
  }
  const ratio = unique / formations.length;
  return clamp(ratio * 90 + familyUnique * 6 - consecutive * 10, 0, 100);
}

export function scoreFormationSequence(
  formations: Formation[],
  candidateScores: CandidateScore[],
  transitions: TransitionAnalysis[],
  context: SequenceScoringContext
): FormationSequenceScore {
  const weights = resolveSequenceWeights(context.style ?? "SHOW");
  const musicStory = musicStoryScore(formations, context.cues, context.sections);
  const visualStory = visualStoryScore(formations);
  const execution = executionScoreFromBands(transitions);
  const variety = varietyScore(formations, context.cues);
  const candidateQuality = mean(candidateScores.map((s) => s.totalScore));
  const transitionQuality = mean(
    candidateScores.map((s) => s.transitionQuality).concat(transitions.map((t) => t.transitionScore))
  );
  const future = mean(candidateScores.map((s) => s.futurePotential));
  const total =
    candidateQuality * weights.candidateQuality +
    transitionQuality * weights.transitionQuality +
    musicStory * weights.musicStory +
    visualStory * weights.visualStory +
    execution * weights.execution +
    variety * weights.variety +
    future * weights.futurePotential;

  return {
    formations: formations.map((f) => f.id),
    candidateScores,
    transitionScores: transitions.map((t) => t.transitionScore),
    musicStoryScore: finite(musicStory),
    visualStoryScore: finite(visualStory),
    executionScore: finite(execution),
    varietyScore: finite(variety),
    totalScore: clamp(finite(total), 0, 100),
  };
}

export function contrastBetween(a: Formation, b: Formation): number {
  return formationContrast(a.type, b.type);
}

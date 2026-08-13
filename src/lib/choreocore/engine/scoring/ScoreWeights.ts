import type { FormationCue, FormationStyle } from "../types/CueTypes";
import type {
  BeamSearchConfig,
  CandidateScoreWeights,
  SequenceScoreWeights,
  SequenceUpperBound,
} from "../types/ScoringTypes";

export const DEFAULT_CANDIDATE_WEIGHTS: CandidateScoreWeights = {
  musicFit: 0.25,
  visualImpact: 0.2,
  transitionQuality: 0.2,
  feasibility: 0.15,
  spacing: 0.08,
  symmetry: 0.05,
  complexity: 0.05,
  novelty: 0.02,
};

export const DEFAULT_SEQUENCE_WEIGHTS: SequenceScoreWeights = {
  candidateQuality: 0.3,
  transitionQuality: 0.2,
  musicStory: 0.15,
  visualStory: 0.1,
  execution: 0.15,
  variety: 0.05,
  futurePotential: 0.05,
};

export const DEFAULT_BEAM_SEARCH_CONFIG: BeamSearchConfig = {
  beamWidth: 5,
  lookAhead: 3,
  minimumCandidateScore: 55,
  minimumFeasibility: 60,
  repetitionPenalty: 10,
  monotonyPenalty: 8,
  futurePotentialWeight: 5,
  deadEndPenalty: 30,
  trapPenalty: 20,
  debug: false,
};

const STYLE_SHIFTS: Record<FormationStyle, Partial<CandidateScoreWeights>> = {
  POWER: { visualImpact: 0.26, musicFit: 0.23, feasibility: 0.14, novelty: 0.02, symmetry: 0.03, spacing: 0.07 },
  CLEAN: { symmetry: 0.12, spacing: 0.13, visualImpact: 0.14, novelty: 0.01, musicFit: 0.23, complexity: 0.03 },
  DYNAMIC: { novelty: 0.1, visualImpact: 0.17, complexity: 0.07, symmetry: 0.02, musicFit: 0.23 },
  ARTISTIC: { novelty: 0.08, symmetry: 0.02, complexity: 0.08, visualImpact: 0.16, musicFit: 0.24 },
  STREET: { complexity: 0.09, novelty: 0.05, symmetry: 0.02, spacing: 0.06, visualImpact: 0.18 },
  SHOW: { visualImpact: 0.24, musicFit: 0.29, novelty: 0.01, complexity: 0.03, feasibility: 0.15 },
};

function renormalize(weights: CandidateScoreWeights): CandidateScoreWeights {
  const sum =
    weights.musicFit +
    weights.visualImpact +
    weights.transitionQuality +
    weights.feasibility +
    weights.spacing +
    weights.symmetry +
    weights.complexity +
    weights.novelty;
  const s = sum > 0 ? sum : 1;
  return {
    musicFit: weights.musicFit / s,
    visualImpact: weights.visualImpact / s,
    transitionQuality: weights.transitionQuality / s,
    feasibility: weights.feasibility / s,
    spacing: weights.spacing / s,
    symmetry: weights.symmetry / s,
    complexity: weights.complexity / s,
    novelty: weights.novelty / s,
  };
}

export function resolveCandidateWeights(
  style: FormationStyle = "SHOW",
  cue?: FormationCue
): CandidateScoreWeights {
  const shifted = { ...DEFAULT_CANDIDATE_WEIGHTS, ...STYLE_SHIFTS[style] };
  let weights = renormalize(shifted);
  if (cue?.action === "MAJOR_CHANGE") {
    weights = renormalize({
      ...weights,
      visualImpact: weights.visualImpact * 1.2,
      novelty: Math.max(0.04, weights.novelty * 1.8),
      musicFit: weights.musicFit * 1.15,
      feasibility: Math.max(0.12, weights.feasibility),
    });
  }
  if (cue?.magnitude === "MAX") {
    weights = renormalize({
      ...weights,
      visualImpact: weights.visualImpact * 1.08,
      feasibility: Math.max(0.12, weights.feasibility),
    });
  }
  return weights;
}

export function resolveSequenceWeights(
  style: FormationStyle = "SHOW"
): SequenceScoreWeights {
  const base = { ...DEFAULT_SEQUENCE_WEIGHTS };
  if (style === "POWER" || style === "SHOW") {
    base.visualStory += 0.03;
    base.musicStory += 0.02;
    base.variety -= 0.03;
    base.candidateQuality -= 0.02;
  }
  if (style === "DYNAMIC" || style === "ARTISTIC") {
    base.variety += 0.04;
    base.visualStory += 0.02;
    base.candidateQuality -= 0.03;
    base.execution -= 0.03;
  }
  if (style === "CLEAN") {
    base.execution += 0.04;
    base.variety -= 0.02;
    base.futurePotential -= 0.02;
  }
  const sum =
    base.candidateQuality +
    base.transitionQuality +
    base.musicStory +
    base.visualStory +
    base.execution +
    base.variety +
    base.futurePotential;
  const s = sum > 0 ? sum : 1;
  return {
    candidateQuality: base.candidateQuality / s,
    transitionQuality: base.transitionQuality / s,
    musicStory: base.musicStory / s,
    visualStory: base.visualStory / s,
    execution: base.execution / s,
    variety: base.variety / s,
    futurePotential: base.futurePotential / s,
  };
}

export function resolveBeamSearchConfig(
  partial?: Partial<BeamSearchConfig>
): BeamSearchConfig {
  const merged = { ...DEFAULT_BEAM_SEARCH_CONFIG, ...partial };
  return {
    ...merged,
    beamWidth: Math.max(1, Math.round(merged.beamWidth)),
    lookAhead: Math.max(1, Math.round(merged.lookAhead)),
  };
}

export const defaultSequenceUpperBound: SequenceUpperBound = {
  estimate(state, remainingCueCount) {
    return state.score + remainingCueCount * 30;
  },
};

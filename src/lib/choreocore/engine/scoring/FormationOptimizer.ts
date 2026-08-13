import type { FormationOptimizationInput, FormationSequenceResult } from "../types/ScoringTypes";
import { runBeamSearch } from "./BeamSearch";
import { scoreFormationCandidate } from "./CandidateScorer";
import { scoreFormationSequence } from "./SequenceScore";

export function optimizeFormationSequence(
  input: FormationOptimizationInput
): FormationSequenceResult {
  return runBeamSearch(input, input.config);
}

export { scoreFormationCandidate, scoreFormationSequence, runBeamSearch };
export { holdCandidate } from "./BeamSearch";

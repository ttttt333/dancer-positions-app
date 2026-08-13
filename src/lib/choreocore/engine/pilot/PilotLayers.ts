import type { EvaluationResult } from "../types/EvaluationTypes";
import type { LayerScores } from "../types/RealWorldTypes";
import { meanLayerScores } from "../realworld/LayerDiagnostics";

export type PilotLayerDiagnostics = {
  phase1: number;
  phase2: number;
  phase3: number;
  phase4: number;
  phase5: number;
  phase6: number;
};

export function layerScoresToDiagnostics(scores: LayerScores): PilotLayerDiagnostics {
  return {
    phase1: scores.phase1Audio,
    phase2: scores.phase2Structure,
    phase3: scores.phase3Cue,
    phase4: scores.phase4Formation,
    phase5: scores.phase5Movement,
    phase6: scores.phase6Sequence,
  };
}

export function generateLayerDiagnostics(input: LayerScores | EvaluationResult[]): PilotLayerDiagnostics {
  const scores = Array.isArray(input) ? meanLayerScores(input) : input;
  return layerScoresToDiagnostics(scores);
}

export const LAYER_REPORT_LABEL: Record<keyof LayerScores, string> = {
  phase1Audio: "Phase 1 Audio",
  phase2Structure: "Phase 2 Structure",
  phase3Cue: "Phase 3 Cue",
  phase4Formation: "Phase 4 Formation",
  phase5Movement: "Phase 5 Movement",
  phase6Sequence: "Phase 6 Sequence",
};

/**
 * Analyzer–analyzer agreement (NOT accuracy).
 */

import type { AnalyzerAgreementPair, FlyBenchmarkHypothesis } from "./types";
import { scoreBeats, scoreSections, scoreTempo } from "./metrics";

export function scoreAnalyzerAgreement(
  songId: string,
  a: FlyBenchmarkHypothesis,
  b: FlyBenchmarkHypothesis
): AnalyzerAgreementPair {
  const tempo = scoreTempo(a.bpm ?? null, b.bpm ?? null);
  let tempoAgreement: number | null = null;
  if (tempo.status === "OK") {
    tempoAgreement = tempo.tempoClassError ? 0 : 1;
  }

  const beat = scoreBeats(a.beats ?? [], b.beats ?? []);
  const beatAgreement =
    beat.status === "OK" ? beat.byThreshold["40"]?.f1 ?? null : null;

  const section = scoreSections(a.sections ?? [], b.sections ?? []);
  const sectionAgreement =
    section.status === "OK" ? section.labelF1 ?? section.meanIoU : null;

  return {
    analyzerA: a.analyzerId,
    analyzerB: b.analyzerId,
    songId,
    tempoAgreement,
    beatAgreement,
    sectionAgreement,
    note: "agreement_is_not_accuracy",
  };
}

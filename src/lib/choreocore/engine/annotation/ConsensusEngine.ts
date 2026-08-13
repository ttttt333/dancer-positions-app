import type { AnnotationSession, ConsensusConfig, ConsensusReviewItem, InterRaterAgreement } from "../types/AnnotationTypes";
import { DEFAULT_CONSENSUS_CONFIG } from "../types/AnnotationTypes";
import { clamp, cohenKappa, mean, pearson } from "../evaluation/EvaluationMetrics";
import { clusterCues, cueAgreementPair, cueTimingDisagreement } from "./CueConsensus";
import { clusterSections, sectionBoundaryMae } from "./SectionConsensus";
import { formationTop3Overlap, top3FromSession } from "./FormationConsensus";
import { sequenceDisagreement, sequenceSpearmanPair } from "./SequenceConsensus";

function pairs<T>(items: T[]): Array<[T, T]> {
  const out: Array<[T, T]> = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) out.push([items[i]!, items[j]!]);
  }
  return out;
}

export function calculateInterRaterAgreement(
  sessions: AnnotationSession[],
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG
): InterRaterAgreement {
  const blind = sessions.filter((s) => s.mode === "BLIND");
  const rows = (blind.length >= 2 ? blind : sessions).sort((a, b) => a.annotatorId.localeCompare(b.annotatorId));
  const ps = pairs(rows);
  if (ps.length === 0) {
    return {
      cue: { timeAgreement: 0, actionAgreement: 0, magnitudeAgreement: 0, importanceAgreement: 0, overall: 0 },
      cueKappa: 0,
      sectionBoundaryMae: 0,
      formationTop3Overlap: 0,
      sequenceSpearman: 0,
      ratingPearson: 0,
      overall: 0,
      pairs: 0,
    };
  }
  const cueParts = ps.map(([a, b]) => cueAgreementPair(a.cues, b.cues, a.bpm || 120, config));
  const kappas = ps.map(([a, b]) => {
    const agr = cueAgreementPair(a.cues, b.cues, a.bpm || 120, config);
    return cohenKappa(agr.actionAgreement * Math.max(a.cues.length, b.cues.length, 1), Math.max(a.cues.length, b.cues.length, 1), 0.2);
  });
  const top3 = ps.map(([a, b]) => formationTop3Overlap(top3FromSession(a), top3FromSession(b)));
  const formationAgreement = mean(top3.map((v) => clamp(v / 3, 0, 1)));
  const seq = ps.map(([a, b]) => sequenceSpearmanPair(a.sequence, b.sequence));
  const ratings = ps.map(([a, b]) => {
    const xa = a.formations.map((f) => f.score);
    const xb = b.formations.map((f) => f.score);
    const n = Math.min(xa.length, xb.length);
    if (n < 2) return n === 1 && xa[0] === xb[0] ? 1 : 0.5;
    return (pearson(xa.slice(0, n), xb.slice(0, n)) + 1) / 2;
  });
  const cue = {
    timeAgreement: mean(cueParts.map((c) => c.timeAgreement)),
    actionAgreement: mean(cueParts.map((c) => c.actionAgreement)),
    magnitudeAgreement: mean(cueParts.map((c) => c.magnitudeAgreement)),
    importanceAgreement: mean(cueParts.map((c) => c.importanceAgreement)),
    overall: mean(cueParts.map((c) => c.overall)),
  };
  const formationTop3 = mean(top3);
  const sequenceSpearman = mean(seq);
  const overall = mean([cue.overall, formationAgreement, sequenceSpearman]);
  return {
    cue,
    cueKappa: mean(kappas),
    sectionBoundaryMae: sectionBoundaryMae(rows),
    formationTop3Overlap: formationTop3,
    sequenceSpearman,
    ratingPearson: mean(ratings),
    overall: clamp(overall, 0, 1),
    pairs: ps.length,
  };
}

export function generateConsensusReviewItems(
  sessions: AnnotationSession[],
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG
): ConsensusReviewItem[] {
  const blind = sessions.filter((s) => s.mode === "BLIND");
  const rows = (blind.length >= 2 ? blind : sessions).sort((a, b) => a.annotatorId.localeCompare(b.annotatorId));
  const songId = rows[0]?.songId ?? "";
  const annotators = [...new Set(rows.map((s) => s.annotatorId))].sort();
  const items: ConsensusReviewItem[] = [];
  if (rows.length === 0) return items;
  if (cueTimingDisagreement(rows, config)) {
    const clusters = clusterCues(rows, config);
    const wide = clusters.find((c) => {
      const times = c.cues.map((x) => x.time);
      return Math.max(...times) - Math.min(...times) > 1e-9;
    });
    items.push({
      songId,
      time: wide?.time,
      type: "CUE",
      severity: "HIGH",
      annotators,
      reasons: ["time diff > 2 beats"],
    });
  }
  const actionSplit = clusterCues(rows, config).some((c) => new Set(c.cues.map((x) => x.action)).size > 1);
  if (actionSplit) {
    items.push({
      songId,
      type: "CUE",
      severity: "MEDIUM",
      annotators,
      reasons: ["cue action disagreement"],
    });
  }
  const sectionTypes = clusterSections(rows, config).some((c) => new Set(c.sections.map((s) => s.type)).size > 1);
  if (sectionTypes) {
    items.push({
      songId,
      type: "SECTION",
      severity: "MEDIUM",
      annotators,
      reasons: ["section type disagreement"],
    });
  }
  const overlaps =
    rows.length >= 2
      ? pairs(rows).map(([a, b]) => formationTop3Overlap(top3FromSession(a), top3FromSession(b)))
      : [1];
  const overlap = overlaps.length ? Math.min(...overlaps) : 1;
  if (rows.length >= 2 && overlap < 1) {
    items.push({
      songId,
      type: "FORMATION",
      severity: overlap <= 0 ? "HIGH" : "MEDIUM",
      annotators,
      reasons: ["Top3 overlap < 1"],
    });
  }
  if (sequenceDisagreement(rows, config)) {
    items.push({
      songId,
      type: "SEQUENCE",
      severity: "HIGH",
      annotators,
      reasons: ["overall difference > 20"],
    });
  }
  items.sort((a, b) => a.type.localeCompare(b.type) || a.severity.localeCompare(b.severity));
  return items;
}

export function generateConsensus(sessions: AnnotationSession[], config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG) {
  const blind = sessions.filter((s) => s.mode === "BLIND");
  const usable = (blind.length > 0 ? blind : sessions).sort((a, b) => a.annotatorId.localeCompare(b.annotatorId));
  return {
    sessions: usable,
    agreement: calculateInterRaterAgreement(usable, config),
    reviews: generateConsensusReviewItems(usable, config),
  };
}

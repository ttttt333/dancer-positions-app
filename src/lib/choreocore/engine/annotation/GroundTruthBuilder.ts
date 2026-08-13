import type { RealSongAnnotations } from "../types/RealWorldTypes";
import type { AnnotationSession, ConsensusConfig, GroundTruthSet } from "../types/AnnotationTypes";
import { ANNOTATION_WORKFLOW_VERSION, DEFAULT_CONSENSUS_CONFIG, groundTruthConfidenceBand } from "../types/AnnotationTypes";
import { generateConsensus } from "./ConsensusEngine";
import { clusterCues, consensusCue } from "./CueConsensus";
import { clusterSections, consensusSection } from "./SectionConsensus";
import { consensusFormations, top3FromSession } from "./FormationConsensus";
import { consensusSequence } from "./SequenceConsensus";

export function generateGroundTruthSet(
  sessions: AnnotationSession[],
  options: { reviewedBy?: string; config?: ConsensusConfig } = {}
): GroundTruthSet {
  const config = options.config ?? DEFAULT_CONSENSUS_CONFIG;
  const { sessions: usable, agreement, reviews } = generateConsensus(sessions, config);
  const high = reviews.some((r) => r.severity === "HIGH");
  const reviewedBy = options.reviewedBy;
  const consensusMethod = reviewedBy ? "REVIEWED" : "AUTO";
  const confidence = high && !reviewedBy ? Math.min(agreement.overall, 0.64) : agreement.overall;
  const band = groundTruthConfidenceBand(confidence);
  const songId = usable[0]?.songId ?? sessions[0]?.songId ?? "unknown";
  return {
    songId,
    annotationVersion: ANNOTATION_WORKFLOW_VERSION,
    sections: clusterSections(usable, config).map(consensusSection),
    cues: clusterCues(usable, config).map(consensusCue),
    formations: consensusFormations(usable),
    sequence: consensusSequence(usable),
    consensusMethod,
    annotatorCount: new Set(usable.map((s) => s.annotatorId)).size,
    agreementScore: agreement.overall,
    confidence,
    confidenceBand: band,
    reviewedBy,
    groundTruthUncertainty: band === "LOW",
    reviews,
  };
}

export function groundTruthToRealAnnotations(gt: GroundTruthSet): RealSongAnnotations {
  return {
    songId: gt.songId,
    annotatorId: "consensus",
    annotationVersion: gt.annotationVersion,
    sections: gt.sections,
    phrases: [],
    cues: gt.cues,
    formations: gt.formations,
    sequence: gt.sequence,
  };
}

export function sessionToRealAnnotations(session: AnnotationSession): RealSongAnnotations {
  return {
    songId: session.songId,
    annotatorId: session.annotatorId,
    annotationVersion: session.version,
    sections: session.sections,
    phrases: [],
    cues: session.cues,
    formations: session.formations,
    formationTop3: session.formationTop3 && session.formationTop3.length > 0 ? session.formationTop3 : top3FromSession(session),
    sequence: session.sequence,
  };
}

export function groundTruthToSongGroundTruth(gt: GroundTruthSet) {
  return {
    songId: gt.songId,
    annotationVersion: gt.annotationVersion,
    sections: gt.sections,
    cues: gt.cues,
    formations: gt.formations,
    sequence: gt.sequence,
  };
}

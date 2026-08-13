import type { HumanSequenceRating } from "../types/EvaluationTypes";
import type { AnnotationSession, ConsensusConfig } from "../types/AnnotationTypes";
import { DEFAULT_CONSENSUS_CONFIG } from "../types/AnnotationTypes";
import { mean, spearman } from "../evaluation/EvaluationMetrics";

export function geometrySignature(ids: string[]): string {
  return [...ids].map((id) => id.trim()).filter(Boolean).sort().join("|");
}

export function geometrySimilarity(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 1 : inter / union;
}

export function consensusSequence(sessions: AnnotationSession[]): HumanSequenceRating[] {
  const seqs = sessions.flatMap((s) => s.sequence);
  if (seqs.length === 0) return [];
  const bySig = new Map<string, HumanSequenceRating[]>();
  for (const seq of seqs) {
    const sig = geometrySignature(seq.formationIds);
    const list = bySig.get(sig) ?? [];
    list.push(seq);
    bySig.set(sig, list);
  }
  const winner = [...bySig.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0]!;
  const group = winner[1];
  const first = [...group].sort((a, b) => a.annotatorId.localeCompare(b.annotatorId))[0]!;
  return [
    {
      ...first,
      annotatorId: "consensus",
      musicStory: mean(group.map((s) => s.musicStory)),
      visualStory: mean(group.map((s) => s.visualStory)),
      execution: mean(group.map((s) => s.execution)),
      variety: mean(group.map((s) => s.variety)),
      overall: mean(group.map((s) => s.overall)),
    },
  ];
}

export function sequenceOverallSpread(sessions: AnnotationSession[]): number {
  const overalls = sessions.flatMap((s) => s.sequence.map((x) => x.overall));
  if (overalls.length === 0) return 0;
  return Math.max(...overalls) - Math.min(...overalls);
}

export function sequenceSpearmanPair(a: HumanSequenceRating[], b: HumanSequenceRating[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 1;
  if (n === 1) return 1 - Math.min(1, Math.abs(a[0]!.overall - b[0]!.overall) / 50);
  return spearman(
    a.slice(0, n).map((s) => s.overall),
    b.slice(0, n).map((s) => s.overall)
  );
}

export function sequenceDisagreement(
  sessions: AnnotationSession[],
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG
): boolean {
  return sequenceOverallSpread(sessions) > config.sequenceOverallDiff;
}

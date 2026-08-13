import type { HumanFormationRating } from "../types/EvaluationTypes";
import type { HumanFormationTop3 } from "../types/RealWorldTypes";
import type { AnnotationSession } from "../types/AnnotationTypes";
import { mean } from "../evaluation/EvaluationMetrics";

const RANK_POINTS: Record<number, number> = { 1: 3, 2: 2, 3: 1 };

function top3FromSession(session: AnnotationSession): HumanFormationTop3[] {
  if (session.formationTop3 && session.formationTop3.length > 0) return session.formationTop3;
  const byCue = new Map<string, HumanFormationRating[]>();
  for (const f of session.formations) {
    const list = byCue.get(f.cueId) ?? [];
    list.push(f);
    byCue.set(f.cueId, list);
  }
  const out: HumanFormationTop3[] = [];
  for (const [cueId, list] of [...byCue.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ordered = [...list].sort(
      (a, b) => (a.rank ?? 99) - (b.rank ?? 99) || (b.overall ?? b.score) - (a.overall ?? a.score) || a.formationType.localeCompare(b.formationType)
    );
    out.push({
      songId: session.songId,
      cueId,
      annotatorId: session.annotatorId,
      ranks: ordered.slice(0, 3).map((f, i) => ({
        formationType: f.formationType,
        score: f.overall ?? f.score,
        rank: (f.rank ?? (i + 1)) as 1 | 2 | 3,
      })),
      musicFit: ordered[0]?.musicFit ?? 0,
      visualImpact: ordered[0]?.visualImpact ?? 0,
      transitionQuality: ordered[0]?.transitionQuality ?? 0,
      execution: ordered[0]?.execution ?? 0,
      originality: ordered[0]?.originality ?? 0,
      overall: ordered[0]?.overall ?? ordered[0]?.score ?? 0,
    });
  }
  return out;
}

export function formationRankVotes(sessions: AnnotationSession[]): Array<{ formationType: string; points: number }> {
  const points = new Map<string, number>();
  for (const session of sessions) {
    for (const row of top3FromSession(session)) {
      for (const rank of row.ranks) {
        const add = RANK_POINTS[rank.rank] ?? 0;
        points.set(rank.formationType, (points.get(rank.formationType) ?? 0) + add);
      }
    }
  }
  return [...points.entries()]
    .map(([formationType, pts]) => ({ formationType, points: pts }))
    .sort((a, b) => b.points - a.points || a.formationType.localeCompare(b.formationType));
}

export function formationTop3Overlap(a: HumanFormationTop3[], b: HumanFormationTop3[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const scores: number[] = [];
  const bByCue = new Map(b.map((row) => [row.cueId, row]));
  for (const left of a) {
    const right = bByCue.get(left.cueId);
    if (!right) continue;
    const setA = new Set(left.ranks.map((r) => r.formationType));
    const setB = new Set(right.ranks.map((r) => r.formationType));
    const inter = [...setA].filter((t) => setB.has(t)).length;
    scores.push(inter);
  }
  return scores.length ? mean(scores) : 0;
}

export function consensusFormations(sessions: AnnotationSession[]): HumanFormationRating[] {
  const votes = formationRankVotes(sessions);
  const songId = sessions[0]?.songId ?? "unknown";
  return votes.slice(0, 3).map((v, i) => {
    const samples = sessions.flatMap((s) => s.formations.filter((f) => f.formationType === v.formationType));
    const pick = samples[0];
    return {
      songId,
      cueId: pick?.cueId ?? "cue-main",
      annotatorId: "consensus",
      formationType: v.formationType,
      formationId: pick?.formationId ?? v.formationType,
      rank: (i + 1) as 1 | 2 | 3,
      score: pick ? mean(samples.map((s) => s.score)) : 80 - i * 4,
      musicFit: pick ? mean(samples.map((s) => s.musicFit)) : 80,
      visualImpact: pick ? mean(samples.map((s) => s.visualImpact)) : 80,
      transitionQuality: pick ? mean(samples.map((s) => s.transitionQuality)) : 80,
      execution: pick ? mean(samples.map((s) => s.execution)) : 80,
      originality: pick ? mean(samples.map((s) => s.originality)) : 70,
      overall: pick ? mean(samples.map((s) => s.overall ?? s.score)) : 80 - i * 4,
    };
  });
}

export { top3FromSession };

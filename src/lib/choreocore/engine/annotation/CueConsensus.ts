import type { HumanCueAnnotation } from "../types/EvaluationTypes";
import type { AnnotationSession, ConsensusConfig, CueAgreement } from "../types/AnnotationTypes";
import { DEFAULT_CONSENSUS_CONFIG } from "../types/AnnotationTypes";
import { mean } from "../evaluation/EvaluationMetrics";
import { actionFamily, beatWindowSec } from "./AnnotationValidator";

export type CueCluster = {
  time: number;
  cues: HumanCueAnnotation[];
};

export function clusterCues(
  sessions: AnnotationSession[],
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG
): CueCluster[] {
  const bpm = sessions[0]?.bpm ?? 120;
  const window = beatWindowSec(bpm, config.matchingBeats);
  const all = sessions
    .flatMap((s) => s.cues)
    .sort((a, b) => a.time - b.time || a.annotatorId.localeCompare(b.annotatorId));
  const clusters: CueCluster[] = [];
  for (const cue of all) {
    const family = actionFamily(cue.action);
    let found = -1;
    for (let i = 0; i < clusters.length; i += 1) {
      const c = clusters[i]!;
      const sameFamily = c.cues.some((x) => actionFamily(x.action) === family);
      if (sameFamily && Math.abs(c.time - cue.time) <= window + 1e-9) {
        found = i;
        break;
      }
    }
    if (found < 0) clusters.push({ time: cue.time, cues: [cue] });
    else {
      const c = clusters[found]!;
      c.cues.push(cue);
      c.time = mean(c.cues.map((x) => x.time));
    }
  }
  clusters.sort((a, b) => a.time - b.time);
  return clusters;
}

export function consensusCue(cluster: CueCluster): HumanCueAnnotation {
  const cues = [...cluster.cues].sort((a, b) => a.annotatorId.localeCompare(b.annotatorId));
  const actionVotes = new Map<string, number>();
  const magVotes = new Map<string, number>();
  for (const cue of cues) {
    actionVotes.set(cue.action, (actionVotes.get(cue.action) ?? 0) + (cue.confidence > 1 ? cue.confidence / 100 : cue.confidence) + 0.5);
    magVotes.set(cue.magnitude, (magVotes.get(cue.magnitude) ?? 0) + 1);
  }
  const action = [...actionVotes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0] as HumanCueAnnotation["action"];
  const magnitude = [...magVotes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0] as HumanCueAnnotation["magnitude"];
  const first = cues[0]!;
  return {
    ...first,
    annotatorId: "consensus",
    time: cluster.time,
    action,
    magnitude,
    importance: mean(cues.map((c) => c.importance)),
    confidence: mean(cues.map((c) => (c.confidence > 1 ? c.confidence / 100 : c.confidence))),
  };
}

export function cueAgreementPair(a: HumanCueAnnotation[], b: HumanCueAnnotation[], bpm: number, config: ConsensusConfig): CueAgreement {
  const window = beatWindowSec(bpm, config.matchingBeats);
  const as = [...a].sort((x, y) => x.time - y.time);
  const bs = [...b].sort((x, y) => x.time - y.time);
  const used = new Set<number>();
  let timeHits = 0;
  let actionHits = 0;
  let magHits = 0;
  let impHits = 0;
  for (const left of as) {
    let best = -1;
    let bestErr = Infinity;
    for (let i = 0; i < bs.length; i += 1) {
      if (used.has(i)) continue;
      const err = Math.abs(bs[i]!.time - left.time);
      if (err <= window && err < bestErr) {
        bestErr = err;
        best = i;
      }
    }
    if (best >= 0) {
      used.add(best);
      timeHits += 1;
      const right = bs[best]!;
      if (right.action === left.action || actionFamily(right.action) === actionFamily(left.action)) actionHits += 1;
      if (right.magnitude === left.magnitude) magHits += 1;
      if (Math.abs(right.importance - left.importance) <= 15) impHits += 1;
    }
  }
  const n = Math.max(as.length, bs.length, 1);
  const timeAgreement = timeHits / n;
  const actionAgreement = actionHits / n;
  const magnitudeAgreement = magHits / n;
  const importanceAgreement = impHits / n;
  return {
    timeAgreement,
    actionAgreement,
    magnitudeAgreement,
    importanceAgreement,
    overall: mean([timeAgreement, actionAgreement, magnitudeAgreement, importanceAgreement]),
  };
}

export function cueTimingDisagreement(
  sessions: AnnotationSession[],
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG
): boolean {
  const bpm = sessions[0]?.bpm ?? 120;
  const limit = beatWindowSec(bpm, config.disagreementBeats);
  const clusters = clusterCues(sessions, config);
  if (
    clusters.some((c) => {
      const times = c.cues.map((x) => x.time);
      return Math.max(...times) - Math.min(...times) > limit + 1e-9;
    })
  ) {
    return true;
  }
  const rows = [...sessions].sort((a, b) => a.annotatorId.localeCompare(b.annotatorId));
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const agr = cueAgreementPair(rows[i]!.cues, rows[j]!.cues, bpm, {
        ...config,
        matchingBeats: config.disagreementBeats,
      });
      if (agr.timeAgreement < 1 - 1e-9) return true;
    }
  }
  return false;
}

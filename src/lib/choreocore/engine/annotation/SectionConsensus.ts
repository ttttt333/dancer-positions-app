import type { HumanSectionAnnotation } from "../types/EvaluationTypes";
import type { AnnotationSession, ConsensusConfig } from "../types/AnnotationTypes";
import { DEFAULT_CONSENSUS_CONFIG } from "../types/AnnotationTypes";
import { mean } from "../evaluation/EvaluationMetrics";
import { beatWindowSec } from "./AnnotationValidator";

export type SectionCluster = {
  startTime: number;
  endTime: number;
  sections: HumanSectionAnnotation[];
};

export function clusterSections(
  sessions: AnnotationSession[],
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG
): SectionCluster[] {
  const bpm = sessions[0]?.bpm ?? 120;
  const window = beatWindowSec(bpm, config.matchingBeats);
  const all = sessions
    .flatMap((s) => s.sections)
    .sort((a, b) => a.startTime - b.startTime || a.annotatorId.localeCompare(b.annotatorId));
  const clusters: SectionCluster[] = [];
  for (const section of all) {
    let found = -1;
    for (let i = 0; i < clusters.length; i += 1) {
      if (Math.abs(clusters[i]!.startTime - section.startTime) <= window + 1e-9) {
        found = i;
        break;
      }
    }
    if (found < 0) {
      clusters.push({ startTime: section.startTime, endTime: section.endTime, sections: [section] });
    } else {
      const c = clusters[found]!;
      c.sections.push(section);
      c.startTime = mean(c.sections.map((s) => s.startTime));
      c.endTime = mean(c.sections.map((s) => s.endTime));
    }
  }
  clusters.sort((a, b) => a.startTime - b.startTime);
  return clusters;
}

export function consensusSection(cluster: SectionCluster): HumanSectionAnnotation {
  const votes = new Map<string, number>();
  for (const s of cluster.sections) {
    const w = s.confidence > 1 ? s.confidence / 100 : s.confidence;
    votes.set(s.type, (votes.get(s.type) ?? 0) + w);
  }
  const type = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0] as HumanSectionAnnotation["type"];
  const first = [...cluster.sections].sort((a, b) => a.annotatorId.localeCompare(b.annotatorId))[0]!;
  return {
    ...first,
    annotatorId: "consensus",
    startTime: cluster.startTime,
    endTime: cluster.endTime,
    type,
    confidence: mean(cluster.sections.map((s) => (s.confidence > 1 ? s.confidence / 100 : s.confidence))),
  };
}

export function sectionBoundaryMae(sessions: AnnotationSession[]): number {
  if (sessions.length < 2) return 0;
  const a = [...sessions[0]!.sections].sort((x, y) => x.startTime - y.startTime);
  const b = [...sessions[1]!.sections].sort((x, y) => x.startTime - y.startTime);
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i += 1) s += Math.abs(a[i]!.startTime - b[i]!.startTime);
  return s / n;
}

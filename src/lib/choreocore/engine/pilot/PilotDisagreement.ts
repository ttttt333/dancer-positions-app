import type { AnnotationSession, ConsensusReviewItem } from "../types/AnnotationTypes";
import type { DisagreementHeatmapPoint, DisagreementKind, PilotDisagreement } from "../types/PilotTypes";
import { generateConsensusReviewItems } from "../annotation/ConsensusEngine";
import { top3FromSession } from "../annotation/FormationConsensus";
import { sectionBoundaryMae } from "../annotation/SectionConsensus";
import { beatPeriodSec } from "../evaluation/EvaluationConfig";

const REASON_TO_KIND: Array<{ needle: string; kind: DisagreementKind }> = [
  { needle: "time diff", kind: "CUE_TIME_DISAGREEMENT" },
  { needle: "action disagreement", kind: "CUE_ACTION_DISAGREEMENT" },
  { needle: "section type", kind: "SECTION_TYPE_DISAGREEMENT" },
  { needle: "Top3 overlap", kind: "FORMATION_RANK_DISAGREEMENT" },
  { needle: "overall difference", kind: "SEQUENCE_DISAGREEMENT" },
];

function kindFromReview(item: ConsensusReviewItem): DisagreementKind {
  const joined = item.reasons.join(" ").toLowerCase();
  for (const row of REASON_TO_KIND) {
    if (joined.includes(row.needle.toLowerCase())) return row.kind;
  }
  if (item.type === "CUE") return "CUE_TIME_DISAGREEMENT";
  if (item.type === "SECTION") return "SECTION_TYPE_DISAGREEMENT";
  if (item.type === "FORMATION") return "FORMATION_RANK_DISAGREEMENT";
  return "SEQUENCE_DISAGREEMENT";
}

function heatmapType(kind: DisagreementKind): DisagreementHeatmapPoint["type"] {
  if (kind.startsWith("CUE")) return "CUE";
  if (kind.startsWith("SECTION")) return "SECTION";
  if (kind.startsWith("FORMATION")) return "FORMATION";
  return "SEQUENCE";
}

function formationChoices(sessions: AnnotationSession[]): Array<{ annotatorId: string; value: string }> {
  return [...sessions]
    .sort((a, b) => a.annotatorId.localeCompare(b.annotatorId))
    .map((s) => {
      const top = top3FromSession(s)[0];
      const first = top ? [...top.ranks].sort((x, y) => x.rank - y.rank)[0] : undefined;
      return { annotatorId: s.annotatorId, value: first?.formationType ?? "NONE" };
    });
}

function cueChoices(sessions: AnnotationSession[]): Array<{ annotatorId: string; value: string }> {
  return [...sessions]
    .sort((a, b) => a.annotatorId.localeCompare(b.annotatorId))
    .map((s) => {
      const cue = [...s.cues].sort((a, b) => a.time - b.time)[0];
      return {
        annotatorId: s.annotatorId,
        value: cue ? `${cue.action}@${cue.time.toFixed(2)}` : "NONE",
      };
    });
}

export function classifyCalibrationReasons(items: ConsensusReviewItem[]): string[] {
  const reasons = new Set<string>();
  for (const item of items) {
    const kind = kindFromReview(item);
    if (kind === "CUE_TIME_DISAGREEMENT") reasons.add("Cue timing disagreement");
    else if (kind === "CUE_ACTION_DISAGREEMENT") reasons.add("Cue action disagreement");
    else if (kind === "SECTION_TYPE_DISAGREEMENT" || kind === "SECTION_BOUNDARY_DISAGREEMENT") {
      reasons.add("Section disagreement");
    } else if (kind === "FORMATION_RANK_DISAGREEMENT") reasons.add("Formation ranking disagreement");
    else reasons.add("Sequence disagreement");
  }
  if (reasons.size === 0) reasons.add("Annotation rule confusion");
  return [...reasons].sort();
}

export function collectPilotDisagreements(sessions: AnnotationSession[]): PilotDisagreement[] {
  const songs = [...new Set(sessions.map((s) => s.songId))].sort();
  const out: PilotDisagreement[] = [];
  for (const songId of songs) {
    const rows = sessions.filter((s) => s.songId === songId);
    const reviews = generateConsensusReviewItems(rows);
    const beat = beatPeriodSec(rows[0]?.bpm || 120);
    if (sectionBoundaryMae(rows) > 2 * beat + 1e-9 && !reviews.some((r) => r.type === "SECTION")) {
      reviews.push({
        songId,
        type: "SECTION",
        severity: "MEDIUM",
        annotators: [...new Set(rows.map((s) => s.annotatorId))].sort(),
        reasons: ["section boundary disagreement"],
      });
    }
    for (const review of reviews) {
      const kind = review.reasons.join(" ").includes("boundary")
        ? "SECTION_BOUNDARY_DISAGREEMENT"
        : kindFromReview(review);
      const high = review.severity === "HIGH";
      out.push({
        songId,
        time: review.time,
        type: kind,
        severity: review.severity,
        annotators: review.annotators,
        choices: kind === "FORMATION_RANK_DISAGREEMENT" ? formationChoices(rows) : cueChoices(rows),
        reason: review.reasons[0] ?? kind,
        status: high ? "REVIEW_REQUIRED" : "AUTO_CONSENSUS",
      });
    }
  }
  out.sort((a, b) => a.songId.localeCompare(b.songId) || (a.time ?? 0) - (b.time ?? 0) || a.type.localeCompare(b.type));
  return out;
}

export function generateDisagreementHeatmap(items: PilotDisagreement[]): DisagreementHeatmapPoint[] {
  return items.map((item) => ({
    songId: item.songId,
    time: item.time ?? 0,
    type: heatmapType(item.type),
    annotatorCount: item.annotators.length,
    severity: item.severity,
  }));
}

export function formatDisagreementReport(items: PilotDisagreement[]): string {
  if (items.length === 0) return "No human disagreements.";
  return items
    .map((item) => {
      const lines = [
        `SONG ${item.songId}`,
        item.time !== undefined ? `${item.time.toFixed(2)}s` : "",
        ...item.choices.map((c) => `Annotator ${c.annotatorId}: ${c.value}`),
        `Status: ${item.severity} DISAGREEMENT`,
        `Reason: ${item.reason}`,
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}

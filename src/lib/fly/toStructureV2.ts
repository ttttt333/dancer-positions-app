/**
 * FlyAnalysisResult → StructureResultV2（Formation Engine 向け）
 */

import type {
  SectionLabelV2,
  StructureResultV2,
} from "../choreocore/types/songStructure";
import type { FlyAnalysisResult, FlySectionType } from "./types";

function flyTypeToV2Label(type: FlySectionType): SectionLabelV2 {
  switch (type) {
    case "intro":
      return "INTRO";
    case "outro":
      return "OUTRO";
    case "verse":
      return "A_MELO";
    case "pre_chorus":
    case "bridge":
    case "post_chorus":
      return "B_MELO";
    case "chorus":
    case "drop":
      return "CHORUS";
    case "break":
      return "BREAKDOWN";
    default:
      return "A_MELO";
  }
}

/** Formation Engine / overlay が期待する StructureResultV2 を復元 */
export function structureV2FromFlyAnalysis(
  fly: FlyAnalysisResult
): StructureResultV2 {
  const bpm = fly.tempo.estimatedBpm || fly.beat.bpm || 120;
  return {
    bpm,
    duration: fly.metadata.durationSeconds,
    eight_times: fly.countGrid.eights.map((e) => e.startTime),
    sections: fly.sections.map((s, i) => ({
      label: flyTypeToV2Label(s.type),
      start_eight: s.startEight,
      end_eight: s.endEight,
      start_time: s.startTime,
      end_time: s.endTime,
      cluster_id: i,
      mean_energy: s.energy,
      energy_trend: s.tension * (s.impact > 0.5 ? 1 : -1),
      repeat_count: 1,
      confidence: s.confidence,
    })),
    change_points: fly.formationChangePoints.map((cp) => ({
      time: cp.musicTime,
      eight_index: cp.eightIndex,
      type: cp.sectionType,
      is_major: (cp.tier ?? "MEDIUM") === "MAJOR",
      confidence: cp.confidence,
      note: cp.reasons.join("|"),
    })),
    source: `fly:${fly.versions.fusionVersion}`,
    beats: fly.beat.beats,
    downbeats: fly.countGrid.beats
      .filter((b) => b.index % 4 === 0)
      .map((b) => b.time),
  };
}

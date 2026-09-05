/**
 * MusicStructureAnalysisResult → MusicalEvent。
 * 解析器は呼ばない。section_families があれば chorusFamilyId を流す。
 */

import type {
  EventCluster,
  MusicSection,
  MusicStructureAnalysisResult,
} from "../types/MusicTypes";
import type { MusicalEvent, MusicalEventKind } from "./musicalEventTypes";
import {
  sectionFamilyAt,
  type SectionFamily,
} from "./sectionFamilies";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function sectionImportance(type: MusicSection["type"]): number {
  if (type === "DROP" || type === "FINAL_CHORUS") return 0.9;
  if (type === "CHORUS") return 0.82;
  if (type === "PRE_CHORUS" || type === "BREAK") return 0.7;
  if (type === "INTRO" || type === "OUTRO") return 0.45;
  return 0.35;
}

function kindForCluster(cluster: EventCluster): MusicalEventKind {
  if (cluster.dominantType === "DRUM_BREAK" || cluster.dominantType === "SILENCE") {
    return "BREAK";
  }
  if (cluster.dominantType === "HIT") return "HIT";
  if (cluster.dominantType === "ENERGY_RISE") return "BUILD";
  if (cluster.dominantType === "ENERGY_DROP") return "SILENCE";
  if (cluster.dominantType === "PHRASE_CHANGE") return "PHRASE_BOUNDARY";
  return "SECTION_BOUNDARY";
}

function sectionAt(time: number, sections: MusicSection[]): MusicSection | null {
  for (const section of sections) {
    if (time >= section.startTime && time < section.endTime) return section;
  }
  return sections[sections.length - 1] ?? null;
}

function familyFields(
  time: number,
  sectionType: MusicSection["type"],
  families: SectionFamily[] | undefined
): Pick<
  MusicalEvent,
  "chorusFamilyId" | "chorusOccurrence" | "variation" | "flags"
> & { familyReason: string | null } {
  const hit = sectionFamilyAt(families, time);
  const variation = hit?.occurrence.variation ?? "none";
  const isLastChorus =
    variation === "final" ||
    sectionType === "FINAL_CHORUS" ||
    hit?.family.type === "FINAL_CHORUS";
  return {
    chorusFamilyId: hit?.family.familyId ?? null,
    chorusOccurrence: hit ? hit.occurrenceIndex + 1 : null,
    variation,
    familyReason: hit ? `FAMILY_${hit.family.familyId}` : null,
    flags: {
      isDownbeatAligned: false,
      isQuietChorus: false,
      isLastChorus,
    },
  };
}

export function toMusicalEvents(input: {
  structure: MusicStructureAnalysisResult;
  bpm?: number;
  durationSec?: number;
  sectionFamilies?: SectionFamily[];
}): MusicalEvent[] {
  const { structure } = input;
  const events: MusicalEvent[] = [];

  for (const section of structure.sections) {
    const family = familyFields(
      section.startTime,
      section.type,
      input.sectionFamilies
    );
    events.push({
      id: `me-sec-${section.id}`,
      time: section.startTime,
      beatTime: null,
      barTime: null,
      kind: section.type === "BREAK" ? "BREAK" : "SECTION_BOUNDARY",
      sectionType: section.type,
      structuralImportance: sectionImportance(section.type),
      instantaneousImpact: clamp01(section.energyDelta / 100),
      confidence: section.confidence,
      energyBefore: Math.max(0, section.energyMean - section.energyDelta / 2),
      energyAfter: section.energyMean,
      sourceEventIds: [section.id],
      reasonCodes: [
        `SECTION_${section.type}`,
        ...(family.familyReason ? [family.familyReason] : []),
      ],
      chorusFamilyId: family.chorusFamilyId,
      chorusOccurrence: family.chorusOccurrence,
      variation: family.variation,
      flags: family.flags,
    });
  }

  for (const cluster of structure.eventClusters) {
    const section = sectionAt(cluster.time, structure.sections);
    const family = familyFields(
      cluster.time,
      section?.type ?? "UNKNOWN",
      input.sectionFamilies
    );
    events.push({
      id: `me-ec-${cluster.id}`,
      time: cluster.time,
      beatTime: cluster.changePoints[0]?.beatTime ?? null,
      barTime: cluster.changePoints[0]?.barTime ?? null,
      kind: kindForCluster(cluster),
      sectionType: section?.type ?? "UNKNOWN",
      structuralImportance: clamp01(cluster.totalStrength / 120),
      instantaneousImpact: clamp01(cluster.totalStrength / 100),
      confidence: cluster.confidence,
      energyBefore: cluster.changePoints[0]?.energyBefore ?? 0,
      energyAfter: cluster.changePoints[0]?.energyAfter ?? 0,
      sourceEventIds: [cluster.id, ...cluster.changePoints.map((p) => p.id)],
      reasonCodes: [
        cluster.dominantType,
        ...(family.familyReason ? [family.familyReason] : []),
      ],
      chorusFamilyId: family.chorusFamilyId,
      chorusOccurrence: family.chorusOccurrence,
      variation: family.variation,
      flags: {
        ...family.flags,
        isDownbeatAligned: cluster.changePoints.some(
          (p) => p.beatTime != null && Math.abs(p.time - p.beatTime) < 0.08
        ),
      },
    });
  }

  return events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

export function musicalEventAt(
  events: MusicalEvent[],
  time: number
): MusicalEvent | null {
  if (events.length === 0) return null;
  let best = events[0]!;
  let bestDist = Math.abs(best.time - time);
  for (const event of events) {
    const d = Math.abs(event.time - time);
    if (d < bestDist) {
      best = event;
      bestDist = d;
    }
  }
  return bestDist <= 2.5 ? best : null;
}

/**
 * Musical Event + Cue → Choreographic Intent。
 * Formation / 座標 / 経路は扱わない。pure / deterministic。
 */

import { energyContext } from "../cue/CueScorer";
import { musicalEventAt } from "../music/musicalEvents";
import type { MusicalEvent } from "../music/musicalEventTypes";
import type { CueAnalysisResult, FormationCue } from "../types/CueTypes";
import type { EventCluster, MusicSection } from "../types/MusicTypes";
import type {
  ChoreographicIntent,
  ChoreographicIntentCandidate,
  ChoreographicIntentContext,
  ChoreographicIntentSequence,
  ChoreographicIntentType,
} from "./ChoreographicIntentTypes";

export const CHOREOGRAPHIC_INTENT_VERSION = "5.1.0-intent";

const CONTRAST: Array<[ChoreographicIntentType, ChoreographicIntentType]> = [
  ["CONTRACT", "EXPAND"],
  ["HOLD", "HIT"],
  ["HIDE", "REVEAL"],
  ["MERGE", "SPLIT"],
  ["HOLD", "MAJOR_CHANGE"],
  ["HOLD", "EXPAND"],
];

export function intentContrast(
  a: ChoreographicIntentType | null | undefined,
  b: ChoreographicIntentType
): number {
  if (!a) return 0;
  if (a === b) return 0;
  for (const [x, y] of CONTRAST) {
    if ((a === x && b === y) || (a === y && b === x)) return 0.85;
  }
  return 0.25;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function sectionImportance(type: MusicSection["type"] | undefined): number {
  if (type === "DROP" || type === "FINAL_CHORUS") return 0.34;
  if (type === "CHORUS") return 0.3;
  if (type === "PRE_CHORUS" || type === "BREAK") return 0.22;
  if (type === "OUTRO" || type === "INTRO") return 0.16;
  return 0.1;
}

function add(
  bag: Map<ChoreographicIntentType, { score: number; reasons: string[] }>,
  intent: ChoreographicIntentType,
  weight: number,
  reason: string
): void {
  const cur = bag.get(intent) ?? { score: 0.28, reasons: [] };
  cur.score += weight;
  if (!cur.reasons.includes(reason)) cur.reasons.push(reason);
  bag.set(intent, cur);
}

function eventTypes(event: EventCluster | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!event) return out;
  out.add(event.dominantType);
  for (const p of event.changePoints) out.add(p.type);
  return out;
}

/**
 * 複数信号を加算して候補を作る。1イベント=1意図の固定表ではない。
 */
export function generateChoreographicIntent(
  context: ChoreographicIntentContext
): ChoreographicIntent {
  const { cue, event, section, previousSection, energyTrend, energyLevel } =
    context;
  const types = eventTypes(event);
  const reasonsCue = cue.reasonCodes;
  const bag = new Map<
    ChoreographicIntentType,
    { score: number; reasons: string[] }
  >();

  const sectionType = section?.type;
  const fromTo =
    previousSection &&
    section &&
    previousSection.type !== section.type
      ? `${previousSection.type}_TO_${section.type}`
      : null;

  if (cue.isMajor) {
    add(bag, "MAJOR_CHANGE", 0.12, "MAJOR_CUE");
  }
  const isPreChorusTension =
    sectionType === "PRE_CHORUS" ||
    reasonsCue.includes("PREPARATION") ||
    reasonsCue.includes("PHRASE_PREPARATION") ||
    reasonsCue.includes("ANTICIPATION") ||
    reasonsCue.includes("SECTION_PRE_CHORUS") ||
    reasonsCue.includes("TENSION_CONTRACT") ||
    context.musicalEvent?.kind === "BUILD";

  if (types.has("ENERGY_RISE") || reasonsCue.includes("ENERGY_RISE")) {
    add(bag, "EXPAND", isPreChorusTension ? 0.08 : 0.22, "ENERGY_RISE");
    if (!isPreChorusTension) {
      add(bag, "SPLIT", 0.14, "ENERGY_RISE");
      add(bag, "REVEAL", 0.1, "ENERGY_RISE");
    }
  }
  if (types.has("ENERGY_DROP") || reasonsCue.includes("ENERGY_DROP")) {
    add(bag, "CONTRACT", 0.2, "ENERGY_DROP");
    add(bag, "HOLD", 0.1, "ENERGY_DROP");
    add(bag, "HIDE", 0.08, "ENERGY_RELEASE");
  }
  if (types.has("SECTION_CHANGE") || reasonsCue.includes("SECTION_CHANGE")) {
    add(bag, "MAJOR_CHANGE", 0.16, "SECTION_CHANGE");
    add(bag, "EXPAND", 0.1, "SECTION_CHANGE");
  }
  if (types.has("HIT") || reasonsCue.includes("HIT")) {
    add(bag, "HIT", 0.2, "STRONG_HIT");
    add(bag, "SHIFT_CENTER", 0.12, "STRONG_HIT");
  }
  if (types.has("SILENCE")) {
    add(bag, "HOLD", 0.22, "SILENCE");
    add(bag, "HIDE", 0.1, "SILENCE");
  }
  if (types.has("DRUM_BREAK") || sectionType === "BREAK") {
    add(bag, "HOLD", 0.24, "BREAK");
    add(bag, "HIDE", 0.12, "BREAK");
    add(bag, "REVEAL", 0.1, "BREAK");
    add(bag, "CONTRACT", 0.1, "BREAK");
  }
  if (sectionType === "DROP") {
    add(bag, "EXPAND", 0.26, "DROP");
    add(bag, "SPLIT", 0.18, "DROP");
    add(bag, "REVEAL", 0.14, "DROP");
    add(bag, "HIT", 0.12, "DROP");
    add(bag, "SHIFT_CENTER", 0.1, "DROP");
  }
  if (sectionType === "CHORUS" || sectionType === "FINAL_CHORUS") {
    add(bag, "EXPAND", 0.18, "CHORUS_START");
    add(bag, "MAJOR_CHANGE", 0.16, "CHORUS_START");
    add(bag, "REVEAL", 0.1, "CHORUS_START");
    add(bag, "HIT", 0.08, "CHORUS_START");
  }
  if (isPreChorusTension) {
    add(bag, "CONTRACT", 0.32, "TENSION_CONTRACT");
    add(bag, "MICRO_SHIFT", 0.14, "BUILD_UP");
    add(bag, "TRAVEL", 0.08, "BUILD_UP");
    add(bag, "ROTATE", 0.06, "BUILD_UP");
  }
  if (sectionType === "OUTRO") {
    add(bag, "HOLD", 0.18, "ENERGY_RELEASE");
    add(bag, "RESET", 0.16, "ENERGY_RELEASE");
    add(bag, "HIDE", 0.1, "ENERGY_RELEASE");
  }
  if (energyTrend === "RISING" && !isPreChorusTension) {
    add(bag, "EXPAND", 0.08, "ENERGY_RISE");
  }
  if (energyTrend === "FALLING") {
    add(bag, "CONTRACT", 0.08, "ENERGY_RELEASE");
    add(bag, "HOLD", 0.06, "ENERGY_RELEASE");
  }
  if (energyTrend === "STABLE" && energyLevel !== "HIGH" && !cue.isMajor) {
    add(bag, "HOLD", 0.16, "STABLE");
  }
  if (energyLevel === "HIGH" && Math.abs(cue.deltaEnergy) >= 18) {
    add(bag, "EXPAND", 0.08, "ENERGY_SPIKE");
  }
  if (fromTo) {
    add(bag, "MAJOR_CHANGE", 0.08, fromTo);
  }
  if (bag.size === 0) {
    add(bag, cue.isMajor ? "MAJOR_CHANGE" : "MICRO_SHIFT", 0.2, "FALLBACK");
  }

  const eventConf = event?.confidence ?? cue.confidence;
  const confidence = clamp01(0.55 * cue.confidence + 0.45 * eventConf);
  const intensity = clamp01(
    0.32 +
      sectionImportance(sectionType) +
      (cue.isMajor ? 0.22 : 0) +
      cue.priority / 280
  );

  const sourceEventIds = [
    cue.sourceEventClusterId,
    ...(event ? [event.id] : []),
  ].filter((id, i, arr) => id && arr.indexOf(id) === i);

  const prev = context.previousIntent ?? null;
  const ranked: ChoreographicIntentCandidate[] = [...bag.entries()]
    .map(([intent, rec]) => {
      let score = rec.score;
      const reasons = rec.reasons.slice();
      if (prev === intent && !cue.isMajor) {
        score *= 0.42;
        reasons.push("INTENT_REPEAT");
      } else if (prev === intent && cue.isMajor) {
        score *= 0.78;
        reasons.push("INTENT_REPEAT");
      }
      const contrast = intentContrast(prev, intent);
      if (contrast >= 0.8) {
        score += 0.1;
        reasons.push("INTENT_CONTRAST");
      }
      return {
        intent,
        score: clamp01(score),
        confidence,
        intensity,
        sourceEventIds,
        reasonCodes: reasons.sort((a, b) => a.localeCompare(b)),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.intent.localeCompare(b.intent)
    );

  const primary = ranked[0]!;
  const alternatives = ranked
    .slice(1)
    .filter((c) => c.score >= 0.38 && c.intent !== primary.intent)
    .slice(0, 2);

  return {
    cueId: cue.id,
    primary,
    alternatives,
    contrastFromPrevious: intentContrast(prev, primary.intent),
    previousIntent: prev,
    sourceEventId:
      context.musicalEvent?.id ??
      event?.id ??
      cue.sourceEventClusterId ??
      cue.id,
    chorusFamilyId: context.musicalEvent?.chorusFamilyId ?? null,
    variation: intentVariation(section, context.musicalEvent),
  };
}

function intentVariation(
  section: MusicSection | null | undefined,
  musicalEvent: MusicalEvent | null | undefined
): ChoreographicIntent["variation"] {
  if (musicalEvent?.variation && musicalEvent.variation !== "none") {
    return musicalEvent.variation;
  }
  if (musicalEvent?.flags.isLastChorus || section?.type === "FINAL_CHORUS") {
    return "final";
  }
  if (musicalEvent?.chorusOccurrence === 1) return "first";
  if (musicalEvent?.chorusOccurrence != null && musicalEvent.chorusOccurrence >= 2) {
    return "repeat";
  }
  return "none";
}

function itemAt(
  time: number,
  sections: MusicSection[]
): MusicSection | null {
  for (const section of sections) {
    if (time >= section.startTime && time < section.endTime) return section;
  }
  return sections[sections.length - 1] ?? null;
}

function previousSectionAt(
  time: number,
  sections: MusicSection[]
): MusicSection | null {
  let best: MusicSection | null = null;
  for (const section of sections) {
    if (section.endTime <= time + 0.05) {
      if (!best || section.endTime > best.endTime) best = section;
    }
  }
  return best;
}

export function generateChoreographicIntentSequence(input: {
  analysis: CueAnalysisResult | { cues: FormationCue[] };
  eventClusters: EventCluster[];
  sections: MusicSection[];
  durationSec: number;
  musicalEvents?: MusicalEvent[];
}): ChoreographicIntentSequence {
  const clusterById = new Map(input.eventClusters.map((c) => [c.id, c]));
  const duration = Math.max(0.5, input.durationSec);
  const active = input.analysis.cues
    .filter((c) => !c.suppressed)
    .sort((a, b) => a.rawTime - b.rawTime || a.id.localeCompare(b.id));

  const intents: ChoreographicIntent[] = [];
  let previousIntent: ChoreographicIntentType | null = null;
  for (const cue of active) {
    const event = clusterById.get(cue.sourceEventClusterId) ?? null;
    const energy = energyContext(cue.energyBefore, cue.energyAfter);
    const musicalEvent = input.musicalEvents
      ? musicalEventAt(input.musicalEvents, cue.rawTime)
      : null;
    const next = generateChoreographicIntent({
      cue,
      event,
      section: itemAt(cue.rawTime, input.sections),
      previousSection: previousSectionAt(cue.rawTime, input.sections),
      energyTrend: energy.direction,
      energyLevel: energy.level,
      musicEnergy: cue.energyAfter,
      previousIntent,
      timelinePosition: clamp01(cue.rawTime / duration),
      musicalEvent,
    });
    intents.push(next);
    previousIntent = next.primary.intent;
  }

  return {
    intents,
    analysisVersion: CHOREOGRAPHIC_INTENT_VERSION,
  };
}

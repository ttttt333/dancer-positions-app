import type { MusicAnalysisResultPhase1 } from "../types";
import type {
  EventCluster,
  MusicPhrase,
  MusicSection,
  MusicStructureAnalysisResult,
} from "../types/MusicTypes";
import type {
  CueAnalysisResult,
  CueEngineConfig,
  FormationCue,
  FormationCueIntent,
} from "../types/CueTypes";
import { CUE_ANALYSIS_VERSION, resolveCueEngineConfig } from "./cueConfig";
import {
  calculateCuePriority,
  clusterEnergy,
  clusterTypes,
  cooldownBeatsForPriority,
  energyContext,
  isMajorCandidate,
  magnitudeFromPriority,
} from "./CueScorer";
import { decideActionAndIntent } from "./CueGenerator";
import { clamp01 } from "../audio/signalMath";

function beatPeriodSec(phase1: MusicAnalysisResultPhase1): number {
  const bpm = phase1.tempo.bpm > 0 ? phase1.tempo.bpm : 120;
  return 60 / bpm;
}

function nearestBeatTime(
  time: number,
  phase1: MusicAnalysisResultPhase1
): { beatTime: number | null; barTime: number | null } {
  if (phase1.beats.length === 0) return { beatTime: null, barTime: null };
  let beat = phase1.beats[0]!;
  let best = Math.abs(beat.time - time);
  for (const b of phase1.beats) {
    const d = Math.abs(b.time - time);
    if (d < best) {
      beat = b;
      best = d;
    }
  }
  let bar = beat;
  for (const b of phase1.beats) {
    if (b.barIndex === beat.barIndex && b.beatInBar === 0) {
      bar = b;
      break;
    }
  }
  return { beatTime: beat.time, barTime: bar.time };
}

function itemAt<T extends { startTime: number; endTime: number }>(
  time: number,
  items: T[]
): T | null {
  for (const item of items) {
    if (time >= item.startTime && time < item.endTime) return item;
  }
  return items[items.length - 1] ?? null;
}

function previousSection(
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

function mergeClusters(
  clusters: EventCluster[],
  windowSec: number
): { merged: EventCluster[]; suppressed: CueAnalysisResult["suppressedEvents"] } {
  const sorted = [...clusters].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  const out: EventCluster[] = [];
  const suppressed: CueAnalysisResult["suppressedEvents"] = [];
  for (const cluster of sorted) {
    const prev = out[out.length - 1];
    const prevEnd = prev
      ? Math.max(prev.time, ...prev.changePoints.map((p) => p.time))
      : 0;
    if (prev && cluster.time - prevEnd <= windowSec) {
      const mergedPoints = [...prev.changePoints, ...cluster.changePoints].sort(
        (a, b) => a.time - b.time || a.id.localeCompare(b.id)
      );
      const keepPrev = prev.totalStrength >= cluster.totalStrength;
      out[out.length - 1] = {
        id: keepPrev ? prev.id : cluster.id,
        time: keepPrev ? prev.time : cluster.time,
        changePoints: mergedPoints,
        dominantType: keepPrev ? prev.dominantType : cluster.dominantType,
        totalStrength: Math.max(prev.totalStrength, cluster.totalStrength),
        confidence: Math.max(prev.confidence, cluster.confidence),
        isMajor: prev.isMajor || cluster.isMajor,
      };
      suppressed.push({
        eventClusterId: keepPrev ? cluster.id : prev.id,
        reason: "CLUSTER_MERGE",
      });
    } else {
      out.push(cluster);
    }
  }
  return { merged: out, suppressed };
}

function applyPhraseSectionContext(
  cluster: EventCluster,
  priority: number,
  major: boolean,
  phrase: MusicPhrase | null,
  section: MusicSection | null,
  prevSection: MusicSection | null
): { priority: number; major: boolean; extraReasons: string[] } {
  const extraReasons: string[] = [];
  let nextPriority = priority;
  let nextMajor = major;

  if (phrase) {
    extraReasons.push(`PHRASE_${phrase.type}`);
    if (phrase.type === "RELEASE") {
      nextPriority = Math.min(priority + 5, 100);
    } else if (phrase.type === "PREPARATION") {
      extraReasons.push("PHRASE_PREPARATION");
    }
  }

  if (section) {
    extraReasons.push(`SECTION_${section.type}`);
    if (
      section.type === "FINAL_CHORUS" &&
      section.confidence >= 0.7 &&
      clusterTypes(cluster).has("SECTION_CHANGE")
    ) {
      nextMajor = true;
      extraReasons.push("FINAL_CHORUS");
    } else if (
      section.type === "CHORUS" &&
      section.confidence < 0.6 &&
      clusterTypes(cluster).has("SECTION_CHANGE")
    ) {
      extraReasons.push("SECTION_CHANGE_UNLABELED");
    }
  }

  if (
    prevSection &&
    section &&
    prevSection.type !== section.type &&
    prevSection.confidence >= 0.6 &&
    section.confidence >= 0.6
  ) {
    extraReasons.push(`SECTION_${prevSection.type}_TO_${section.type}`);
  }

  return { priority: nextPriority, major: nextMajor, extraReasons };
}

/**
 * EventCluster → Formation Cue. Does not generate dancer positions.
 */
export function generateFormationCues(
  musicStructure: MusicStructureAnalysisResult,
  phase1: MusicAnalysisResultPhase1,
  config?: Partial<CueEngineConfig>
): CueAnalysisResult {
  const cfg = resolveCueEngineConfig(config);
  const period = beatPeriodSec(phase1);
  const { merged, suppressed: mergeSuppressed } = mergeClusters(
    musicStructure.eventClusters,
    cfg.clusterMergeWindowSeconds
  );
  const suppressedEvents: CueAnalysisResult["suppressedEvents"] = [
    ...mergeSuppressed,
  ];
  const intents: Record<string, FormationCueIntent> = {};
  const accepted: FormationCue[] = [];
  let lastAcceptTime = -Infinity;
  let lastAction: FormationCue["action"] | null = null;
  let lastWasMajor = false;

  for (let i = 0; i < merged.length; i += 1) {
    const cluster = merged[i]!;
    const prev = i > 0 ? merged[i - 1] : null;
    const next = i < merged.length - 1 ? merged[i + 1] : null;
    const types = clusterTypes(cluster);
    let major = isMajorCandidate(cluster);
    const energy = clusterEnergy(cluster);
    const ctx = energyContext(energy.energyBefore, energy.energyAfter);
    const phrase = itemAt(cluster.time, musicStructure.phrases);
    const section = itemAt(cluster.time, musicStructure.sections);
    const prevSection = previousSection(cluster.time, musicStructure.sections);

    const contextual = applyPhraseSectionContext(
      cluster,
      calculateCuePriority(cluster, major),
      major,
      phrase,
      section,
      prevSection
    );
    major = contextual.major;
    let priority = contextual.priority;

    const preview = decideActionAndIntent(
      types,
      ctx,
      major,
      priority,
      cfg.microShiftThreshold
    );
    const sameActionRepeat =
      Boolean(lastAction) && preview.action === lastAction && !major;
    const riseRepeat =
      lastAction === "EXPAND" && types.has("ENERGY_RISE") && !major;
    if (sameActionRepeat || riseRepeat) {
      const extremeRise =
        types.has("ENERGY_RISE") && cluster.totalStrength >= 90;
      if (!extremeRise) {
        priority = Math.max(0, priority - cfg.repetitionPenalty);
      }
    }

    const decided = decideActionAndIntent(
      types,
      ctx,
      major,
      priority,
      cfg.microShiftThreshold
    );
    let action = decided.action;
    let reasonCodes = [...decided.reasonCodes, ...contextual.extraReasons];

    if (cluster.confidence < cfg.minimumConfidence && !major) {
      suppressedEvents.push({
        eventClusterId: cluster.id,
        reason: "LOW_CONFIDENCE",
      });
      action = "HOLD";
      reasonCodes.push("LOW_CONFIDENCE");
    }

    if (priority < 20 && !major) {
      suppressedEvents.push({
        eventClusterId: cluster.id,
        reason: "LOW_PRIORITY",
      });
      action = "HOLD";
      reasonCodes.push("LOW_PRIORITY");
    }

    const cooldownBeats = cooldownBeatsForPriority(priority, major, cfg);
    const sinceBeats = (cluster.time - lastAcceptTime) / period;
    const majorOverride = major && priority >= cfg.majorPriorityThreshold;
    if (
      lastAcceptTime > -Infinity &&
      sinceBeats < cooldownBeats &&
      !majorOverride
    ) {
      suppressedEvents.push({
        eventClusterId: cluster.id,
        reason: "COOLDOWN",
      });
      continue;
    }

    if (lastWasMajor && sinceBeats < 2 && action === "HOLD") {
      suppressedEvents.push({
        eventClusterId: cluster.id,
        reason: "POST_MAJOR_HOLD",
      });
      continue;
    }

    if (
      next &&
      isMajorCandidate(next) &&
      next.time - cluster.time > 0 &&
      next.time - cluster.time <= period * 4 &&
      action !== "MICRO_SHIFT" &&
      action !== "HOLD" &&
      !major &&
      priority < 50
    ) {
      action = "HOLD";
      reasonCodes.push("HOLD_FOR_UPCOMING_MAJOR");
    }

    if (
      prev &&
      clusterTypes(prev).has("ENERGY_RISE") &&
      types.has("ENERGY_RISE") &&
      !major &&
      action === "EXPAND"
    ) {
      action = "MICRO_SHIFT";
      reasonCodes.push("GRADED_RISE");
    }

    const magnitude = magnitudeFromPriority(priority, major, types);
    const times = nearestBeatTime(cluster.time, phase1);
    const firstCp = cluster.changePoints[0];
    const cue: FormationCue = {
      id: `cue-${Math.round(cluster.time * 1000)}-${action}`,
      rawTime: firstCp?.rawTime ?? cluster.time,
      beatTime: firstCp?.beatTime ?? times.beatTime,
      barTime: firstCp?.barTime ?? times.barTime,
      action,
      magnitude: action === "HOLD" ? "NONE" : magnitude,
      priority,
      confidence: clamp01(
        cluster.confidence * 0.6 + (priority / 100) * 0.25 + (major ? 0.15 : 0)
      ),
      reasonCodes,
      sourceEventClusterId: cluster.id,
      sourceChangePointIds: cluster.changePoints.map((p) => p.id),
      energyBefore: energy.energyBefore,
      energyAfter: energy.energyAfter,
      deltaEnergy: energy.deltaEnergy,
      isMajor: major && action !== "HOLD",
      isLocked: majorOverride,
      suppressed: false,
    };

    if (action === "HOLD" && lastAction === "HOLD") {
      suppressedEvents.push({
        eventClusterId: cluster.id,
        reason: "HOLD_COLLAPSE",
      });
      continue;
    }

    accepted.push(cue);
    intents[cue.id] = {
      ...decided.intent,
      primary: action,
      secondary: decided.intent.secondary.filter((a) => a !== action),
    };
    lastAction = action;
    if (action !== "HOLD") {
      lastAcceptTime = cluster.time;
      lastWasMajor = cue.isMajor;
    }
  }

  const withPrep = addAnticipationCues(accepted, intents, phase1, cfg, period);
  withPrep.sort((a, b) => a.rawTime - b.rawTime || a.id.localeCompare(b.id));

  const active = withPrep.filter((c) => !c.suppressed);
  const confidence =
    active.length === 0
      ? 0.4
      : active.reduce((s, c) => s + c.confidence, 0) / active.length;

  return {
    cues: withPrep,
    intents,
    suppressedEvents,
    confidence,
    analysisVersion: CUE_ANALYSIS_VERSION,
  };
}

function addAnticipationCues(
  cues: FormationCue[],
  intents: Record<string, FormationCueIntent>,
  phase1: MusicAnalysisResultPhase1,
  cfg: CueEngineConfig,
  period: number
): FormationCue[] {
  const extras: FormationCue[] = [];
  for (const cue of cues) {
    if (!cue.isMajor || cue.action === "HOLD") continue;
    const prepTime = cue.rawTime - cfg.anticipationBeats * period;
    if (prepTime <= 0.05) continue;
    const collision = cues.some(
      (other) =>
        other.action !== "HOLD" &&
        Math.abs(other.rawTime - prepTime) < period * 0.75
    );
    if (collision) continue;
    const times = nearestBeatTime(prepTime, phase1);
    const id = `cue-${Math.round(prepTime * 1000)}-MICRO_SHIFT`;
    extras.push({
      id,
      rawTime: prepTime,
      beatTime: times.beatTime,
      barTime: times.barTime,
      action: "MICRO_SHIFT",
      magnitude: "SMALL",
      priority: Math.max(30, cue.priority - 25),
      confidence: cue.confidence * 0.85,
      reasonCodes: [
        "ANTICIPATION",
        ...cue.reasonCodes.filter((r) => r !== "MAJOR_CLUSTER"),
      ],
      sourceEventClusterId: cue.sourceEventClusterId,
      sourceChangePointIds: cue.sourceChangePointIds,
      energyBefore: cue.energyBefore,
      energyAfter: cue.energyBefore,
      deltaEnergy: 0,
      isMajor: false,
      isLocked: false,
      suppressed: false,
    });
    intents[id] = {
      primary: "MICRO_SHIFT",
      secondary: ["CENTER", "EXPAND"],
      prohibited: ["MAJOR_CHANGE"],
    };
  }
  return [...cues, ...extras];
}

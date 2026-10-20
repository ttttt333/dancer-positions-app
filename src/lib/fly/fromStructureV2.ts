/**
 * StructureResultV2（＋レガシー v1 付帯）→ FlyAnalysisResult
 * Phase 1–3: 既存結果を FLY 契約へ投影。Essentia/MSAF は未接続。
 */

import type { StructureResultV2 } from "../choreocore/types/songStructure";
import type { ChangePoint } from "../choreocore/types";
import { currentFlyVersions } from "./versions";
import type {
  AnalysisQuality,
  CountGrid,
  FlyAnalysisResult,
  FlyMusicSection,
  FlySectionType,
  FlySourceContribution,
  FormationChangePoint,
  MusicEvent,
  TempoAnalysis,
} from "./types";

export type FlyFromLegacyInput = {
  structureV2: StructureResultV2;
  audioHash?: string | null;
  songDynamism?: number | null;
  analyzerVersion?: string | null;
  changePoints?: ChangePoint[] | null;
  sourceLabel?: string | null;
  sampleRate?: number;
  channels?: number;
  format?: string;
};

function mapV2LabelToFlyType(label: string): FlySectionType {
  const u = label.toUpperCase();
  if (u === "INTRO") return "intro";
  if (u === "OUTRO") return "outro";
  if (u === "A_MELO" || u === "VERSE") return "verse";
  if (u === "B_MELO" || u === "PRE_CHORUS") return "pre_chorus";
  if (u === "CHORUS" || u === "FINAL_CHORUS") return "chorus";
  if (u === "DROP") return "drop";
  if (u === "BREAKDOWN" || u === "BREAK") return "break";
  if (u === "BRIDGE" || u === "POST_CHORUS") return "bridge";
  return "unknown";
}

function buildCountGrid(v2: StructureResultV2): CountGrid {
  const bpm = v2.bpm > 0 ? v2.bpm : 120;
  const beatDuration = 60 / bpm;
  const beatsSrc =
    v2.beats && v2.beats.length > 0
      ? v2.beats
      : (() => {
          const out: number[] = [];
          for (let t = 0; t < v2.duration; t += beatDuration) out.push(t);
          return out;
        })();

  const beats = beatsSrc.map((time, index) => ({
    index,
    time,
    confidence: v2.beats?.length ? 0.85 : 0.55,
  }));

  const bars: CountGrid["bars"] = [];
  for (let i = 0; i + 3 < beats.length; i += 4) {
    bars.push({
      index: bars.length,
      startTime: beats[i]!.time,
      endTime: beats[Math.min(i + 4, beats.length - 1)]!.time,
    });
  }

  const eights =
    v2.eight_times.length > 0
      ? v2.eight_times.map((startTime, index) => {
          const endTime =
            index + 1 < v2.eight_times.length
              ? v2.eight_times[index + 1]!
              : Math.min(v2.duration, startTime + beatDuration * 8);
          return {
            index,
            startTime,
            endTime,
            confidence: 0.8,
          };
        })
      : [];

  return { bpm, beatDuration, beats, bars, eights };
}

function buildTempo(v2: StructureResultV2): TempoAnalysis {
  const bpm = v2.bpm > 0 ? v2.bpm : 120;
  const candidates = [bpm, bpm / 2, bpm * 2].filter(
    (b) => b >= 40 && b <= 240
  );
  return {
    estimatedBpm: bpm,
    bpmCandidates: [...new Set(candidates.map((b) => Math.round(b * 10) / 10))],
    confidence: v2.beats?.length ? 0.88 : 0.62,
    stability: 0.7,
    halfTimeProbability: 0.15,
    doubleTimeProbability: 0.15,
  };
}

function buildSections(v2: StructureResultV2): FlyMusicSection[] {
  return v2.sections.map((s, i) => {
    const energy = Math.max(0, Math.min(1, s.mean_energy));
    const impact = Math.max(
      0,
      Math.min(1, energy * 0.6 + Math.abs(s.energy_trend) * 0.4)
    );
    const type = mapV2LabelToFlyType(s.label);
    const confidence =
      s.confidence > 0
        ? Math.max(0, Math.min(1, s.confidence))
        : type === "unknown"
          ? 0.35
          : 0.55;
    return {
      id: `fly-sec-${i}-${Math.round(s.start_time * 100)}`,
      startTime: s.start_time,
      endTime: s.end_time,
      startEight: s.start_eight,
      endEight: s.end_eight,
      type: confidence < 0.42 ? "unknown" : type,
      confidence,
      energy,
      tension: Math.max(0, Math.min(1, Math.abs(s.energy_trend))),
      impact,
      density: energy,
      label: s.label,
    };
  });
}

function buildEventsFromChangePoints(
  v2: StructureResultV2,
  legacy?: ChangePoint[] | null
): MusicEvent[] {
  const fromV2 = v2.change_points.map((cp, i) => ({
    id: `fly-ev-v2-${i}`,
    type: "SECTION_CHANGE" as const,
    time: cp.time,
    eightIndex: cp.eight_index,
    strength: cp.is_major ? 0.85 : 0.55,
    confidence: Math.max(0, Math.min(1, cp.confidence || 0.5)),
    sourceSignals: ["structure_v2", v2.source ?? "chroma-ssm"],
    description: cp.note ?? cp.type,
  }));
  if (fromV2.length > 0) return fromV2;
  if (!legacy?.length) return [];
  return legacy.map((cp, i) => ({
    id: `fly-ev-legacy-${i}`,
    type: "SECTION_CHANGE" as const,
    time: cp.time,
    eightIndex: cp.eight_index,
    strength: cp.tier === "major" ? 0.8 : cp.tier === "medium" ? 0.55 : 0.35,
    confidence: 0.5,
    sourceSignals: ["legacy_change_points"],
    description: cp.section_type,
  }));
}

function buildFormationChangePoints(
  v2: StructureResultV2,
  sections: FlyMusicSection[]
): FormationChangePoint[] {
  return v2.change_points.map((cp) => {
    const sec =
      sections.find(
        (s) => cp.time >= s.startTime && cp.time < s.endTime
      ) ?? sections.find((s) => Math.abs(s.startTime - cp.time) < 0.35);
    const structural = cp.is_major ? 0.85 : 0.45;
    const energy = sec?.energy ?? 0.5;
    const impact = sec?.impact ?? 0.5;
    const sectionChange = Math.max(0.4, cp.confidence || 0.5);
    const contrast = cp.is_major ? 0.7 : 0.35;
    const changeStrength = Math.max(
      0,
      Math.min(
        1,
        structural * 0.25 +
          energy * 0.2 +
          impact * 0.2 +
          sectionChange * 0.2 +
          contrast * 0.15
      )
    );
    const tier =
      changeStrength >= 0.7
        ? ("MAJOR" as const)
        : changeStrength >= 0.35
          ? ("MEDIUM" as const)
          : ("MINOR" as const);
    const recommendedStartEight = Math.max(0, cp.eight_index - 1);
    return {
      eightIndex: cp.eight_index,
      musicTime: cp.time,
      sectionType: sec?.type ?? cp.type ?? "unknown",
      changeStrength,
      formationOpportunity: changeStrength,
      formationImpact: impact,
      transitionUrgency: cp.is_major ? 0.75 : 0.4,
      recommendedStartEight,
      confidence: Math.max(0.3, Math.min(1, cp.confidence || changeStrength)),
      reasons: [
        cp.is_major ? "major_boundary" : "boundary",
        `source:${v2.source ?? "structure_v2"}`,
        ...(sec ? [`section:${sec.type}`] : []),
      ],
      tier,
    };
  });
}

function buildQuality(
  v2: StructureResultV2,
  sections: FlyMusicSection[]
): AnalysisQuality {
  const beatConfidence = v2.beats?.length ? 0.88 : 0.58;
  const tempoConfidence = v2.bpm > 0 ? 0.8 : 0.4;
  const structureConfidence =
    sections.length > 0
      ? sections.reduce((s, x) => s + x.confidence, 0) / sections.length
      : 0.3;
  const eventConfidence =
    v2.change_points.length > 0
      ? v2.change_points.reduce((s, c) => s + (c.confidence || 0.5), 0) /
        v2.change_points.length
      : 0.35;
  const sourceAgreement = v2.source?.includes("all-in-one") ? 0.75 : 0.55;
  const overall =
    beatConfidence * 0.25 +
    tempoConfidence * 0.2 +
    structureConfidence * 0.3 +
    eventConfidence * 0.15 +
    sourceAgreement * 0.1;
  return {
    beatConfidence,
    tempoConfidence,
    structureConfidence,
    eventConfidence,
    sourceAgreement,
    overall: Math.max(0, Math.min(1, overall)),
  };
}

function buildSources(v2: StructureResultV2): FlySourceContribution[] {
  const src = (v2.source ?? "").toLowerCase();
  const aio = /all-in-one|aio|replicate/.test(src);
  return [
    {
      id: "librosa_chroma_ssm",
      role: aio ? "secondary" : "primary",
      available: true,
      version: "structure-v2.0.1",
      note: "chroma-SSM / Foote-like novelty (existing)",
    },
    {
      id: "all_in_one",
      role: aio ? "primary" : "optional",
      available: aio,
      version: "all-in-one-v1.0.0",
      note: aio ? "active" : "not in this result",
    },
    {
      id: "essentia",
      role: "optional",
      available: false,
      note: "Phase 2 — not wired",
    },
    {
      id: "madmom",
      role: "optional",
      available: false,
      note: "Phase 3 — not wired",
    },
    {
      id: "msaf",
      role: "optional",
      available: false,
      note: "Phase 4 — not wired",
    },
    {
      id: "cyanite",
      role: "optional",
      available: false,
      note: "OPTIONAL external — not wired",
    },
  ];
}

/** 既存 StructureResultV2 を FLY 完全契約へ投影する（非破壊） */
export function flyAnalysisFromStructureV2(
  input: FlyFromLegacyInput
): FlyAnalysisResult {
  const v2 = input.structureV2;
  const versions = currentFlyVersions(
    input.analyzerVersion ?? undefined
  );
  const sections = buildSections(v2);
  const countGrid = buildCountGrid(v2);
  const tempo = buildTempo(v2);
  const events = buildEventsFromChangePoints(v2, input.changePoints);
  const formationChangePoints = buildFormationChangePoints(v2, sections);
  const quality = buildQuality(v2, sections);
  const beats =
    v2.beats && v2.beats.length > 0
      ? v2.beats
      : countGrid.beats.map((b) => b.time);

  return {
    audioHash: input.audioHash?.trim() || "unknown",
    versions,
    metadata: {
      audioHash: input.audioHash?.trim() || "unknown",
      durationSeconds: v2.duration,
      sampleRate: input.sampleRate ?? 0,
      channels: input.channels ?? 0,
      format: input.format ?? "unknown",
      analyzerVersion: versions.analyzerVersion,
    },
    tempo,
    beat: {
      bpm: tempo.estimatedBpm,
      beats,
      confidence: tempo.confidence,
      source: v2.source ?? "structure_v2",
    },
    countGrid,
    sections,
    events,
    moments: formationChangePoints.map((cp) => ({
      time: cp.musicTime,
      eightIndex: cp.eightIndex,
      structuralChange: cp.changeStrength,
      energyChange: cp.formationImpact * 0.8,
      rhythmicImpact: cp.formationImpact,
      vocalChange: 0,
      drumChange: 0,
      bassChange: 0,
      repetitionBreak: 0,
      formationOpportunity: cp.formationOpportunity,
      formationImpact: cp.formationImpact,
      confidence: cp.confidence,
    })),
    formationChangePoints,
    songDynamism: Math.max(
      0,
      Math.min(1, input.songDynamism ?? quality.overall)
    ),
    overallConfidence: quality.overall,
    quality,
    sources: buildSources(v2),
    structureV2Compatible: true,
    degraded: false,
  };
}

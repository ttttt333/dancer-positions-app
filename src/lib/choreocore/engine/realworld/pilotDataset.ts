import { ANNOTATION_VERSION, EVALUATION_VERSION } from "../types/EvaluationTypes";
import type { HumanCueAnnotation, HumanFormationRating, HumanSectionAnnotation, HumanSequenceRating } from "../types/EvaluationTypes";
import type {
  HumanFormationTop3,
  HumanPhraseAnnotation,
  RealSongAnnotations,
  RealSongCategory,
  RealSongMetadata,
  RealWorldDataset,
  RealWorldDatasetItem,
} from "../types/RealWorldTypes";
import type { SongDifficulty } from "../types/EvaluationTypes";
import { makeCue } from "../formation/formationFixtures";
import { section as makeSection } from "../cue/cueFixtures";
import { humanCue, ratings, sequence } from "../evaluation/syntheticDataset";
import { REALWORLD_VERSION } from "../types/RealWorldTypes";

type Spec = {
  id: string;
  title: string;
  bpm: number;
  duration: number;
  category: RealSongCategory;
  difficulty: SongDifficulty;
  cueAt: number;
  action: HumanCueAnnotation["action"];
  sections: Array<[HumanSectionAnnotation["type"], number, number]>;
  extraMicro?: boolean;
  aiShift?: number;
};

const SPECS: Spec[] = [
  { id: "real-001", title: "Energy Rise A", bpm: 80, duration: 32, category: "ENERGY_DRIVEN", difficulty: "EASY", cueAt: 16, action: "MAJOR_CHANGE", sections: [["INTRO", 0, 16], ["CHORUS", 16, 32]] },
  { id: "real-002", title: "Energy Rise B", bpm: 100, duration: 40, category: "ENERGY_DRIVEN", difficulty: "MEDIUM", cueAt: 20, action: "EXPAND", sections: [["VERSE", 0, 20], ["CHORUS", 20, 40]] },
  { id: "real-003", title: "Beat Grid A", bpm: 128, duration: 32, category: "BEAT_DRIVEN", difficulty: "EASY", cueAt: 16, action: "MAJOR_CHANGE", sections: [["VERSE", 0, 16], ["CHORUS", 16, 32]], aiShift: 2 },
  { id: "real-004", title: "Beat Grid B", bpm: 160, duration: 24, category: "BEAT_DRIVEN", difficulty: "HARD", cueAt: 8, action: "MAJOR_CHANGE", sections: [["DROP", 0, 8], ["CHORUS", 8, 24]] },
  { id: "real-005", title: "Drop Heavy A", bpm: 110, duration: 36, category: "DROP_HEAVY", difficulty: "MEDIUM", cueAt: 24, action: "CONTRACT", sections: [["CHORUS", 0, 24], ["BREAK", 24, 36]] },
  { id: "real-006", title: "Drop Heavy B", bpm: 140, duration: 32, category: "DROP_HEAVY", difficulty: "HARD", cueAt: 16, action: "MAJOR_CHANGE", sections: [["CHORUS", 0, 16], ["DROP", 16, 32]], extraMicro: true },
  { id: "real-007", title: "Complex A", bpm: 95, duration: 64, category: "COMPLEX_STRUCTURE", difficulty: "HARD", cueAt: 32, action: "MAJOR_CHANGE", sections: [["INTRO", 0, 16], ["VERSE", 16, 32], ["CHORUS", 32, 48], ["BRIDGE", 48, 64]] },
  { id: "real-008", title: "Complex B", bpm: 118, duration: 48, category: "COMPLEX_STRUCTURE", difficulty: "VERY_HARD", cueAt: 24, action: "EXPAND", sections: [["VERSE", 0, 24], ["CHORUS", 24, 48]] },
  { id: "real-009", title: "Minimal A", bpm: 72, duration: 40, category: "MINIMAL_STABLE", difficulty: "EASY", cueAt: 8, action: "HOLD", sections: [["VERSE", 0, 40]] },
  { id: "real-010", title: "Minimal B", bpm: 125, duration: 32, category: "MINIMAL_STABLE", difficulty: "MEDIUM", cueAt: 16, action: "MICRO_SHIFT", sections: [["VERSE", 0, 16], ["CHORUS", 16, 32]] },
];

function meta(spec: Spec): RealSongMetadata {
  return {
    id: spec.id,
    title: spec.title,
    artist: "Pilot Artist",
    genre: "synthetic-pilot",
    bpm: spec.bpm,
    duration: spec.duration,
    category: spec.category,
    difficulty: spec.difficulty,
    audioHash: `hash-${spec.id}`,
    rightsConfirmed: true,
    notes: "Pilot metadata only. No copyrighted audio.",
  };
}

function top3(songId: string, annotatorId: string, order: Array<[string, number]>): HumanFormationTop3 {
  return {
    songId,
    cueId: "cue-main",
    annotatorId,
    ranks: order.slice(0, 3).map(([formationType, score], i) => ({
      formationType,
      score,
      rank: (i + 1) as 1 | 2 | 3,
    })),
    musicFit: order[0]?.[1] ?? 90,
    visualImpact: (order[0]?.[1] ?? 90) - 2,
    transitionQuality: (order[0]?.[1] ?? 90) - 4,
    execution: 88,
    originality: 70,
    overall: order[0]?.[1] ?? 90,
  };
}

function phrases(songId: string, annotatorId: string, sections: Spec["sections"]): HumanPhraseAnnotation[] {
  return sections.map(([ , start, end]) => ({
    songId,
    annotatorId,
    startTime: start,
    endTime: end,
    type: "DEVELOPMENT" as const,
    confidence: 0.85,
  }));
}

function annotation(
  spec: Spec,
  annotatorId: string,
  formOrder: Array<[string, number]>,
  cueTime = spec.cueAt
): RealSongAnnotations {
  const cue = humanCue(spec.id, cueTime, spec.action, {
    annotatorId,
    importance: spec.action === "MAJOR_CHANGE" ? 92 : 55,
    magnitude: spec.action === "HOLD" ? "NONE" : spec.action === "MICRO_SHIFT" ? "SMALL" : "LARGE",
  });
  const sections: HumanSectionAnnotation[] = spec.sections.map(([type, start, end]) => ({
    songId: spec.id,
    annotatorId,
    startTime: start,
    endTime: end,
    type,
    confidence: 0.9,
  }));
  const forms: HumanFormationRating[] = ratings(spec.id, "cue-main", formOrder).map((r) => ({
    ...r,
    annotatorId,
    overall: r.score,
  }));
  const seqTypes = [formOrder[0]?.[0] ?? "WIDE_V"];
  const seq: HumanSequenceRating[] = [{ ...sequence(spec.id, seqTypes, 88), annotatorId }];
  return {
    songId: spec.id,
    annotatorId,
    annotationVersion: ANNOTATION_VERSION,
    sections,
    phrases: phrases(spec.id, annotatorId, spec.sections),
    cues: [cue],
    formations: forms,
    formationTop3: [top3(spec.id, annotatorId, formOrder)],
    sequence: seq,
  };
}

function itemFromSpec(spec: Spec): RealWorldDatasetItem {
  const cue = humanCue(spec.id, spec.cueAt, spec.action, {
    importance: spec.action === "MAJOR_CHANGE" ? 92 : 55,
    magnitude: spec.action === "HOLD" ? "NONE" : spec.action === "MICRO_SHIFT" ? "SMALL" : "LARGE",
  });
  const aiCue = {
    ...makeCue(cue.action, cue.magnitude, {
      id: `ai-${spec.id}`,
      rawTime: spec.cueAt + (spec.aiShift ?? 0),
      isMajor: spec.action === "MAJOR_CHANGE",
      priority: spec.action === "MAJOR_CHANGE" ? 90 : 60,
    }),
  };
  const extra = spec.extraMicro
    ? [
        makeCue("MICRO_SHIFT", "SMALL", {
          id: `ai-${spec.id}-micro`,
          rawTime: spec.cueAt + 4,
          isMajor: false,
          priority: 20,
        }),
      ]
    : [];
  const seqType = spec.action === "CONTRACT" ? "CLUSTER" : spec.action === "MAJOR_CHANGE" ? "WIDE_V" : "DIAGONAL";
  return {
    song: meta(spec),
    ai: {
      bpm: spec.bpm,
      cues: [aiCue, ...extra],
      sections: spec.sections.map(([type, start, end]) => makeSection(type, start, end, 0.9)),
      formationRankings: [
        { formationType: "WIDE_V", score: 94 },
        { formationType: "CENTER_WINGS", score: 86 },
        { formationType: "PYRAMID", score: 81 },
      ],
      transitions: [
        { formationType: "WIDE_V", transitionScore: 90, feasible: true },
        { formationType: "CENTER_WINGS", transitionScore: 84, feasible: true },
        { formationType: "PYRAMID", transitionScore: 80, feasible: true },
      ],
      sequence: { formationTypes: [seqType], totalScore: 88 },
      analysisVersion: `${EVALUATION_VERSION}+${REALWORLD_VERSION}`,
    },
    phrases: spec.sections.map(([, start, end], i) => ({
      id: `ph-${spec.id}-${i}`,
      type: "DEVELOPMENT" as const,
      startTime: start,
      endTime: end,
      startBar: 0,
      endBar: 4,
      barCount: 4,
      energyStart: 40,
      energyEnd: 55,
      energyDelta: 15,
      confidence: 0.85,
    })),
  };
}

export function realWorldPilotDataset(): { dataset: RealWorldDataset; annotations: RealSongAnnotations[] } {
  const items = SPECS.map(itemFromSpec);
  const annotations: RealSongAnnotations[] = [];
  for (const spec of SPECS) {
    const orderA: Array<[string, number]> = [
      ["WIDE_V", 95],
      ["CENTER_WINGS", 91],
      ["PYRAMID", 88],
    ];
    const orderB: Array<[string, number]> =
      spec.id === "real-008"
        ? [
            ["PYRAMID", 96],
            ["WIDE_V", 90],
            ["CENTER_WINGS", 88],
          ]
        : [
            ["WIDE_V", 93],
            ["CENTER_WINGS", 90],
            ["PYRAMID", 86],
          ];
    annotations.push(annotation(spec, "annotator-a", orderA));
    annotations.push(annotation(spec, "annotator-b", orderB, spec.cueAt + (spec.id === "real-003" ? 0.15 : 0)));
  }
  return {
    dataset: { annotationVersion: ANNOTATION_VERSION, items },
    annotations,
  };
}

export function clonePilotSongs(n: number): { dataset: RealWorldDataset; annotations: RealSongAnnotations[] } {
  const base = realWorldPilotDataset();
  const items = Array.from({ length: n }, (_, i) => {
    const src = base.dataset.items[i % base.dataset.items.length]!;
    const id = `real-${String(i).padStart(3, "0")}`;
    return {
      ...src,
      song: { ...src.song, id, audioHash: `hash-${id}`, title: `${src.song.title} ${id}` },
    };
  });
  const annotations = items.flatMap((item, i) => {
    const srcId = base.dataset.items[i % base.dataset.items.length]!.song.id;
    return base.annotations
      .filter((a) => a.songId === srcId)
      .map((a) => ({
        ...a,
        songId: item.song.id,
        cues: a.cues.map((c) => ({ ...c, songId: item.song.id })),
        sections: a.sections.map((s) => ({ ...s, songId: item.song.id })),
        phrases: a.phrases.map((p) => ({ ...p, songId: item.song.id })),
        formations: a.formations.map((f) => ({ ...f, songId: item.song.id })),
        formationTop3: (a.formationTop3 ?? []).map((t) => ({ ...t, songId: item.song.id })),
        sequence: a.sequence.map((s) => ({ ...s, songId: item.song.id })),
      }));
  });
  return { dataset: { annotationVersion: ANNOTATION_VERSION, items }, annotations };
}

export { SPECS };

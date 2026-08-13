import type { FormationCue } from "../types/CueTypes";
import type { MusicSection } from "../types/MusicTypes";
import {
  ANNOTATION_VERSION,
  EVALUATION_VERSION,
  type AiEvaluationOutput,
  type BenchmarkDataset,
  type BenchmarkDatasetItem,
  type HumanCueAnnotation,
  type HumanFormationRating,
  type HumanSectionAnnotation,
  type HumanSequenceRating,
  type MusicStructureCategory,
  type SongDifficulty,
} from "../types/EvaluationTypes";
import { makeCue } from "../formation/formationFixtures";
import { section as makeSection } from "../cue/cueFixtures";

function song(
  id: string,
  duration: number,
  bpm = 120
): BenchmarkDatasetItem["song"] {
  return {
    id,
    title: id,
    bpm,
    duration,
    audioHash: `hash-${id}`,
    metadata: { source: "synthetic", notes: id },
  };
}

function humanCue(
  songId: string,
  time: number,
  action: HumanCueAnnotation["action"],
  extra: Partial<HumanCueAnnotation> = {}
): HumanCueAnnotation {
  return {
    songId,
    annotatorId: extra.annotatorId ?? "annotator-a",
    time,
    action,
    magnitude: extra.magnitude ?? (action === "MAJOR_CHANGE" ? "MAX" : "LARGE"),
    importance: extra.importance ?? (action === "MAJOR_CHANGE" ? 90 : 60),
    confidence: extra.confidence ?? 0.9,
    notes: extra.notes,
  };
}

function aiCueFromHuman(h: HumanCueAnnotation, index: number): FormationCue {
  return makeCue(h.action, h.magnitude, {
    id: `ai-${h.songId}-${index}`,
    rawTime: h.time,
    isMajor: h.importance >= 80 || h.action === "MAJOR_CHANGE",
  });
}

function humanSection(
  songId: string,
  type: HumanSectionAnnotation["type"],
  start: number,
  end: number
): HumanSectionAnnotation {
  return {
    songId,
    annotatorId: "annotator-a",
    startTime: start,
    endTime: end,
    type,
    confidence: 0.9,
  };
}

function aiSection(type: MusicSection["type"], start: number, end: number): MusicSection {
  return makeSection(type, start, end, 0.9);
}

function ratings(
  songId: string,
  cueId: string,
  order: Array<[string, number]>
): HumanFormationRating[] {
  return order.map(([formationType, score], i) => ({
    songId,
    cueId,
    annotatorId: "annotator-a",
    formationType,
    score,
    musicFit: score,
    visualImpact: score - 2,
    transitionQuality: Math.max(40, score - 5),
    execution: Math.max(50, score - 8),
    originality: 70 - i,
  }));
}

function sequence(songId: string, types: string[], overall: number): HumanSequenceRating {
  return {
    songId,
    annotatorId: "annotator-a",
    formationIds: types,
    musicStory: overall,
    visualStory: overall - 2,
    execution: overall - 4,
    variety: 70,
    overall,
  };
}

function aiOutput(
  bpm: number,
  cues: FormationCue[],
  sections: MusicSection[],
  ranks: AiEvaluationOutput["formationRankings"],
  transitions: AiEvaluationOutput["transitions"],
  seq: AiEvaluationOutput["sequence"]
): AiEvaluationOutput {
  return {
    bpm,
    cues,
    sections,
    formationRankings: ranks,
    transitions,
    sequence: seq,
    analysisVersion: EVALUATION_VERSION,
  };
}

function item(
  id: string,
  duration: number,
  difficulty: SongDifficulty,
  category: MusicStructureCategory,
  humans: HumanCueAnnotation[],
  sectionsH: HumanSectionAnnotation[],
  aiTimeshift = 0
): BenchmarkDatasetItem {
  const cues = humans.map((h, i) => {
    const cue = aiCueFromHuman(h, i);
    return { ...cue, rawTime: cue.rawTime + aiTimeshift };
  });
  const types = ["WIDE_V", "CENTER_WINGS", "PYRAMID"] as const;
  const seqTypes = humans.map((h) =>
    h.action === "CONTRACT" ? "CLUSTER" : h.action === "MAJOR_CHANGE" ? "WIDE_V" : "DIAGONAL"
  );
  const formations = ratings(id, "cue-main", [
    [types[0], 95],
    [types[1], 88],
    [types[2], 80],
  ]);
  return {
    song: song(id, duration),
    difficulty,
    category,
    groundTruth: {
      songId: id,
      annotationVersion: ANNOTATION_VERSION,
      cues: humans,
      sections: sectionsH,
      formations,
      sequence: [sequence(id, seqTypes, 88)],
    },
    ai: aiOutput(
      120,
      cues,
      sectionsH.map((s) => aiSection(s.type, s.startTime, s.endTime)),
      [
        { formationType: "WIDE_V", score: 94 },
        { formationType: "CENTER_WINGS", score: 86 },
        { formationType: "PYRAMID", score: 81 },
      ],
      formations.map((f) => ({
        formationType: f.formationType,
        transitionScore: f.transitionQuality,
        feasible: true,
      })),
      { formationTypes: seqTypes, totalScore: 88 }
    ),
  };
}

export function syntheticBenchmarkDataset(): BenchmarkDataset {
  const items: BenchmarkDatasetItem[] = [
    item(
      "PATTERN_01_CLEAR_CHORUS",
      32,
      "EASY",
      "ENERGY_DRIVEN",
      [
        humanCue("PATTERN_01_CLEAR_CHORUS", 16, "MAJOR_CHANGE", { importance: 95 }),
      ],
      [
        humanSection("PATTERN_01_CLEAR_CHORUS", "INTRO", 0, 16),
        humanSection("PATTERN_01_CLEAR_CHORUS", "CHORUS", 16, 32),
      ]
    ),
    item(
      "PATTERN_02_SLOW_RISE",
      48,
      "MEDIUM",
      "ENERGY_DRIVEN",
      [
        humanCue("PATTERN_02_SLOW_RISE", 16, "EXPAND", { magnitude: "MEDIUM" }),
        humanCue("PATTERN_02_SLOW_RISE", 32, "EXPAND", { magnitude: "LARGE" }),
      ],
      [
        humanSection("PATTERN_02_SLOW_RISE", "VERSE", 0, 32),
        humanSection("PATTERN_02_SLOW_RISE", "PRE_CHORUS", 32, 48),
      ]
    ),
    item(
      "PATTERN_03_SUDDEN_DROP",
      32,
      "MEDIUM",
      "DYNAMIC_CONTRAST",
      [
        humanCue("PATTERN_03_SUDDEN_DROP", 16, "MAJOR_CHANGE", { importance: 90 }),
        humanCue("PATTERN_03_SUDDEN_DROP", 24, "CONTRACT", { importance: 85, magnitude: "LARGE" }),
      ],
      [
        humanSection("PATTERN_03_SUDDEN_DROP", "CHORUS", 0, 24),
        humanSection("PATTERN_03_SUDDEN_DROP", "BREAK", 24, 32),
      ]
    ),
    item(
      "PATTERN_04_HEAVY_HIT",
      16,
      "EASY",
      "BEAT_DRIVEN",
      [humanCue("PATTERN_04_HEAVY_HIT", 8, "MAJOR_CHANGE", { importance: 92 })],
      [
        humanSection("PATTERN_04_HEAVY_HIT", "VERSE", 0, 8),
        humanSection("PATTERN_04_HEAVY_HIT", "DROP", 8, 16),
      ]
    ),
    item(
      "PATTERN_05_STABLE_HIGH",
      24,
      "MEDIUM",
      "BEAT_DRIVEN",
      [humanCue("PATTERN_05_STABLE_HIGH", 8, "HOLD", { magnitude: "NONE", importance: 40 })],
      [humanSection("PATTERN_05_STABLE_HIGH", "CHORUS", 0, 24)]
    ),
    item(
      "PATTERN_06_FREQUENT_SMALL",
      24,
      "HARD",
      "COMPLEX_ARRANGEMENT",
      [2, 6, 10, 14, 18].map((t) =>
        humanCue("PATTERN_06_FREQUENT_SMALL", t, "MICRO_SHIFT", { magnitude: "SMALL", importance: 35 })
      ),
      [humanSection("PATTERN_06_FREQUENT_SMALL", "VERSE", 0, 24)]
    ),
    item(
      "PATTERN_07_COMPLEX_SECTIONS",
      64,
      "HARD",
      "COMPLEX_ARRANGEMENT",
      [
        humanCue("PATTERN_07_COMPLEX_SECTIONS", 16, "EXPAND"),
        humanCue("PATTERN_07_COMPLEX_SECTIONS", 32, "MAJOR_CHANGE", { importance: 90 }),
        humanCue("PATTERN_07_COMPLEX_SECTIONS", 48, "CONTRACT", { importance: 80 }),
      ],
      [
        humanSection("PATTERN_07_COMPLEX_SECTIONS", "INTRO", 0, 16),
        humanSection("PATTERN_07_COMPLEX_SECTIONS", "VERSE", 16, 32),
        humanSection("PATTERN_07_COMPLEX_SECTIONS", "CHORUS", 32, 48),
        humanSection("PATTERN_07_COMPLEX_SECTIONS", "BRIDGE", 48, 64),
      ]
    ),
    item(
      "PATTERN_08_LONG_BREAK",
      40,
      "MEDIUM",
      "BREAK_DROP_HEAVY",
      [
        humanCue("PATTERN_08_LONG_BREAK", 8, "MAJOR_CHANGE", { importance: 88 }),
        humanCue("PATTERN_08_LONG_BREAK", 16, "CONTRACT", { importance: 86 }),
      ],
      [
        humanSection("PATTERN_08_LONG_BREAK", "CHORUS", 0, 16),
        humanSection("PATTERN_08_LONG_BREAK", "BREAK", 16, 40),
      ]
    ),
    item(
      "PATTERN_09_MULTIPLE_PEAKS",
      64,
      "VERY_HARD",
      "DYNAMIC_CONTRAST",
      [
        humanCue("PATTERN_09_MULTIPLE_PEAKS", 16, "MAJOR_CHANGE", { importance: 90 }),
        humanCue("PATTERN_09_MULTIPLE_PEAKS", 32, "CONTRACT", { importance: 82 }),
        humanCue("PATTERN_09_MULTIPLE_PEAKS", 48, "MAJOR_CHANGE", { importance: 93 }),
      ],
      [
        humanSection("PATTERN_09_MULTIPLE_PEAKS", "CHORUS", 16, 32),
        humanSection("PATTERN_09_MULTIPLE_PEAKS", "BREAK", 32, 48),
        humanSection("PATTERN_09_MULTIPLE_PEAKS", "FINAL_CHORUS", 48, 64),
      ]
    ),
    item(
      "PATTERN_10_FINAL_CHORUS",
      48,
      "EASY",
      "ENERGY_DRIVEN",
      [
        humanCue("PATTERN_10_FINAL_CHORUS", 16, "EXPAND"),
        humanCue("PATTERN_10_FINAL_CHORUS", 32, "MAJOR_CHANGE", { importance: 96 }),
      ],
      [
        humanSection("PATTERN_10_FINAL_CHORUS", "PRE_CHORUS", 16, 32),
        humanSection("PATTERN_10_FINAL_CHORUS", "FINAL_CHORUS", 32, 48),
      ]
    ),
  ];
  return { annotationVersion: ANNOTATION_VERSION, items };
}

export function perfectAiItem(): BenchmarkDatasetItem {
  return syntheticBenchmarkDataset().items[0]!;
}

export function badAiItem(): BenchmarkDatasetItem {
  const base = syntheticBenchmarkDataset().items[0]!;
  return {
    ...base,
    song: { ...base.song, id: "BAD_AI", audioHash: "hash-bad" },
    groundTruth: { ...base.groundTruth, songId: "BAD_AI" },
    ai: {
      ...base.ai,
      cues: [
        makeCue("MICRO_SHIFT", "SMALL", { id: "wrong", rawTime: 2, isMajor: false }),
        makeCue("MICRO_SHIFT", "SMALL", { id: "wrong2", rawTime: 4, isMajor: false }),
        makeCue("HOLD", "NONE", { id: "wrong3", rawTime: 6, isMajor: false }),
      ],
      sections: [aiSection("UNKNOWN", 0, 32)],
      formationRankings: [
        { formationType: "GRID", score: 90 },
        { formationType: "CLUSTER", score: 40 },
      ],
      transitions: [{ transitionScore: 20, feasible: true, unsafe: true }],
      sequence: { formationTypes: ["GRID"], totalScore: 20 },
    },
  };
}

export { humanCue, ratings, sequence };

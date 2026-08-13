import { createAnnotationSession, completeAnnotationSession } from "./AnnotationSession";
import type { AnnotationSession } from "../types/AnnotationTypes";
import { humanCue, ratings, sequence } from "../evaluation/syntheticDataset";
import type { HumanFormationRating } from "../types/EvaluationTypes";

const NOW = new Date("2026-08-14T00:00:00.000Z");

function top3Ratings(songId: string, annotatorId: string, order: Array<[string, number]>): HumanFormationRating[] {
  return ratings(songId, "cue-main", order).map((r, i) => ({
    ...r,
    annotatorId,
    rank: (i + 1) as 1 | 2 | 3,
    formationId: r.formationType,
    overall: r.score,
  }));
}

export function makeSession(input: {
  songId: string;
  annotatorId: string;
  duration?: number;
  bpm?: number;
  cueTime?: number;
  action?: "HOLD" | "MICRO_SHIFT" | "EXPAND" | "CONTRACT" | "SPLIT" | "MERGE" | "CENTER" | "MAJOR_CHANGE";
  importance?: number;
  sectionType?: "INTRO" | "VERSE" | "CHORUS" | "DROP" | "BREAK";
  formations?: Array<[string, number]>;
  overall?: number;
  mode?: "BLIND" | "AI_ASSISTED";
  extraCue?: { time: number; action: "HOLD" | "MAJOR_CHANGE" | "MICRO_SHIFT" };
}): AnnotationSession {
  const duration = input.duration ?? 32;
  let session = createAnnotationSession({
    songId: input.songId,
    annotatorId: input.annotatorId,
    duration,
    bpm: input.bpm ?? 120,
    mode: input.mode ?? "BLIND",
    id: `ann-${input.songId}-${input.annotatorId}`,
    now: NOW,
  });
  const cueTime = input.cueTime ?? 16;
  const action = input.action ?? "MAJOR_CHANGE";
  session = {
    ...session,
    sections: [
      {
        songId: input.songId,
        annotatorId: input.annotatorId,
        startTime: 0,
        endTime: cueTime,
        type: "INTRO",
        confidence: 0.9,
      },
      {
        songId: input.songId,
        annotatorId: input.annotatorId,
        startTime: cueTime,
        endTime: duration,
        type: input.sectionType ?? "CHORUS",
        confidence: 0.9,
      },
    ],
    cues: [
      humanCue(input.songId, cueTime, action, {
        annotatorId: input.annotatorId,
        importance: input.importance ?? (action === "MAJOR_CHANGE" ? 92 : 60),
      }),
    ],
    formations: top3Ratings(
      input.songId,
      input.annotatorId,
      input.formations ?? [
        ["WIDE_V", 95],
        ["CENTER_WINGS", 91],
        ["PYRAMID", 88],
      ]
    ),
    sequence: [{ ...sequence(input.songId, ["WIDE_V"], input.overall ?? 88), annotatorId: input.annotatorId }],
  };
  if (input.extraCue) {
    session.cues = [
      ...session.cues,
      humanCue(input.songId, input.extraCue.time, input.extraCue.action, { annotatorId: input.annotatorId }),
    ];
  }
  return completeAnnotationSession(session, NOW);
}

export function threeAnnotators(songId = "song-gt"): AnnotationSession[] {
  return [
    makeSession({ songId, annotatorId: "annotator-a" }),
    makeSession({
      songId,
      annotatorId: "annotator-b",
      cueTime: 16.2,
      formations: [
        ["PYRAMID", 96],
        ["WIDE_V", 90],
        ["CENTER_WINGS", 88],
      ],
    }),
    makeSession({
      songId,
      annotatorId: "annotator-c",
      cueTime: 15.9,
      formations: [
        ["WIDE_V", 94],
        ["CENTER_WINGS", 90],
        ["PYRAMID", 87],
      ],
    }),
  ];
}

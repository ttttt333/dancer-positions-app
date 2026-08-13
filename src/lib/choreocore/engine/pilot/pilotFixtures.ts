import { makeSession, threeAnnotators } from "../annotation/annotationFixtures";
import type { AnnotationSession } from "../types/AnnotationTypes";
import type { RealWorldDataset } from "../types/RealWorldTypes";
import { realWorldPilotDataset } from "../realworld/pilotDataset";
import { sessionFromRealAnnotations } from "./sessionBridge";

export function calibrationSessions(pass = true): AnnotationSession[] {
  if (pass) {
    return [...threeAnnotators("cal-001"), ...threeAnnotators("cal-002")];
  }
  return [
    makeSession({ songId: "cal-001", annotatorId: "annotator-a", cueTime: 8, overall: 95 }),
    makeSession({ songId: "cal-001", annotatorId: "annotator-b", cueTime: 24, overall: 40 }),
    makeSession({ songId: "cal-002", annotatorId: "annotator-a", cueTime: 8, overall: 95 }),
    makeSession({ songId: "cal-002", annotatorId: "annotator-b", cueTime: 24, overall: 40 }),
  ];
}

export function mainSessionsFromPilot(annotators: 2 | 3 = 2, songIds?: string[]): AnnotationSession[] {
  const { dataset, annotations } = realWorldPilotDataset();
  const allowed = songIds ? new Set(songIds) : undefined;
  const items = dataset.items.filter((item) => !allowed || allowed.has(item.song.id));
  const sessions: AnnotationSession[] = [];
  for (const item of items) {
    const rows = annotations.filter((a) => a.songId === item.song.id);
    for (const row of rows) {
      sessions.push(sessionFromRealAnnotations(row, item.song));
    }
    if (annotators === 3) {
      const src = rows[0];
      if (src) {
        sessions.push(
          sessionFromRealAnnotations(
            {
              ...src,
              annotatorId: "annotator-c",
              cues: src.cues.map((c) => ({ ...c, annotatorId: "annotator-c", time: c.time + 0.08 })),
              sections: src.sections.map((s) => ({ ...s, annotatorId: "annotator-c" })),
              formations: src.formations.map((f) => ({ ...f, annotatorId: "annotator-c" })),
              formationTop3: (src.formationTop3 ?? []).map((t) => ({ ...t, annotatorId: "annotator-c" })),
              sequence: src.sequence.map((s) => ({ ...s, annotatorId: "annotator-c" })),
            },
            item.song
          )
        );
      }
    }
  }
  return sessions.sort((a, b) => a.songId.localeCompare(b.songId) || a.annotatorId.localeCompare(b.annotatorId));
}

export function realSongPilotFixture(options: {
  annotators?: 2 | 3;
  mainSongs?: number;
  calibrationPass?: boolean;
  dropRights?: boolean;
  unsafe?: boolean;
} = {}): {
  dataset: RealWorldDataset;
  calibrationSessions: AnnotationSession[];
  mainSessions: AnnotationSession[];
} {
  const { dataset } = realWorldPilotDataset();
  const annotators = options.annotators ?? 2;
  const mainSongs = options.mainSongs ?? 10;
  const songIds = dataset.items.slice(0, mainSongs).map((item) => item.song.id);
  let items = dataset.items.map((item) => ({
    ...item,
    song: { ...item.song, rightsConfirmed: options.dropRights ? false : item.song.rightsConfirmed },
    ai: options.unsafe
      ? {
          ...item.ai,
          transitions: item.ai.transitions.map((t) => ({ ...t, feasible: false, unsafe: true })),
        }
      : item.ai,
  }));
  return {
    dataset: { ...dataset, items },
    calibrationSessions: calibrationSessions(options.calibrationPass !== false),
    mainSessions: mainSessionsFromPilot(annotators, songIds),
  };
}

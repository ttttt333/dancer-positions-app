import {
  ANNOTATION_WORKFLOW_VERSION,
  type AnnotationMode,
  type AnnotationSession,
} from "../types/AnnotationTypes";

export function createAnnotationSession(input: {
  songId: string;
  annotatorId: string;
  duration: number;
  bpm?: number;
  mode?: AnnotationMode;
  id?: string;
  now?: Date;
  notes?: string;
}): AnnotationSession {
  const now = input.now ?? new Date();
  const mode = input.mode ?? "BLIND";
  const id =
    input.id ??
    `ann-${input.songId}-${input.annotatorId}-${now.toISOString()}`;
  return {
    id,
    songId: input.songId,
    annotatorId: input.annotatorId,
    mode,
    startedAt: now.toISOString(),
    version: ANNOTATION_WORKFLOW_VERSION,
    duration: input.duration,
    bpm: input.bpm && input.bpm > 0 ? input.bpm : 120,
    sections: [],
    cues: [],
    formations: [],
    formationTop3: [],
    sequence: [],
    notes: input.notes,
  };
}

export function completeAnnotationSession(
  session: AnnotationSession,
  now = new Date()
): AnnotationSession {
  return { ...session, completedAt: now.toISOString() };
}

export function sessionIsBlind(session: AnnotationSession): boolean {
  return session.mode === "BLIND";
}

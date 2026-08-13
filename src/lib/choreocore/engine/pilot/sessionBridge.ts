import { completeAnnotationSession, createAnnotationSession } from "../annotation/AnnotationSession";
import type { AnnotationSession } from "../types/AnnotationTypes";
import type { RealSongAnnotations, RealSongMetadata } from "../types/RealWorldTypes";

const NOW = new Date("2026-08-14T00:00:00.000Z");

export function sessionFromRealAnnotations(
  ann: RealSongAnnotations,
  song: Pick<RealSongMetadata, "id" | "duration" | "bpm">,
  mode: AnnotationSession["mode"] = "BLIND"
): AnnotationSession {
  const session = createAnnotationSession({
    songId: song.id,
    annotatorId: ann.annotatorId,
    duration: song.duration,
    bpm: song.bpm ?? 120,
    mode,
    id: `ann-${song.id}-${ann.annotatorId}`,
    now: NOW,
  });
  return completeAnnotationSession(
    {
      ...session,
      version: ann.annotationVersion || session.version,
      sections: ann.sections,
      cues: ann.cues,
      formations: ann.formations.map((f, i) => ({
        ...f,
        rank: f.rank ?? ((i + 1) as 1 | 2 | 3),
        formationId: f.formationId ?? f.formationType,
        overall: f.overall ?? f.score,
      })),
      formationTop3: ann.formationTop3 ?? [],
      sequence: ann.sequence,
    },
    NOW
  );
}

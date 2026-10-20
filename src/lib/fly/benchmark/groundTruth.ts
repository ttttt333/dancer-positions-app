import type { FlyGroundTruthSong } from "./types";
import { FLY_GROUND_TRUTH_VERSION } from "./versions";

export function assertGroundTruthSong(song: FlyGroundTruthSong): string[] {
  const errors: string[] = [];
  if (!song.songId) errors.push("songId required");
  if (!song.audioHash) errors.push("audioHash required");
  if (!(song.durationSeconds > 0)) errors.push("durationSeconds must be > 0");
  if (!song.datasetVersion) errors.push("datasetVersion required");
  if (!song.groundTruthVersion) errors.push("groundTruthVersion required");
  if (!song.conditions?.genre) errors.push("conditions.genre required");

  for (const s of song.sections ?? []) {
    if (!(s.endTime >= s.startTime)) {
      errors.push(`section ${s.label}: endTime < startTime`);
    }
    if (s.endTime - s.startTime === 0) {
      errors.push(`section ${s.label}: zero-duration`);
    }
    // overlapping check soft — warn via errors list as advisory
  }

  // overlapping sections
  const sorted = [...(song.sections ?? [])].sort(
    (a, b) => a.startTime - b.startTime
  );
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startTime < sorted[i - 1]!.endTime) {
      errors.push(
        `overlapping sections at ${sorted[i]!.startTime} (allowed but flagged)`
      );
    }
  }

  const beatTimes = song.beats.map((b) => b.beatTime);
  const dup = new Set<number>();
  for (const t of beatTimes) {
    if (dup.has(t)) errors.push(`duplicate beat at ${t}`);
    dup.add(t);
  }

  return errors;
}

export function parseGroundTruthSong(
  raw: unknown
): { ok: true; song: FlyGroundTruthSong } | { ok: false; errors: string[] } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["not an object"] };
  }
  const song = raw as FlyGroundTruthSong;
  if (!song.groundTruthVersion) {
    song.groundTruthVersion = FLY_GROUND_TRUTH_VERSION;
  }
  const errors = assertGroundTruthSong(song);
  // overlapping is flagged but parse still ok for scoring
  const hard = errors.filter((e) => !e.includes("overlapping"));
  if (hard.length) return { ok: false, errors: hard };
  return { ok: true, song };
}

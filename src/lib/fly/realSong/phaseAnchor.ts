/**
 * PHASE 4.6-E — Independent Phase Anchor annotation contract.
 * Isolated from production Fusion / Formation.
 */

export const FLY_PHASE_ANCHOR_ANNOTATION_VERSION = "4.6-e-phase-anchor-v1";

/** Soft vocabulary — OTHER + free string allowed for discovery */
export const PHASE_ANCHOR_TYPE_CANDIDATES = [
  "DOWNBEAT",
  "BEAT",
  "KICK",
  "SNARE",
  "VOCAL",
  "HIT",
  "GROOVE",
  "ANTICIPATION",
  "SECTION",
  "OTHER",
] as const;

export type PhaseAnchorTypeCandidate =
  (typeof PHASE_ANCHOR_TYPE_CANDIDATES)[number];

export type PhaseAnchorRole =
  | "ORIGIN"
  | "HIT"
  | "RELEASE"
  | "TRANSITION"
  | "OTHER";

export type RelationToMusicVsBeat =
  | "ON"
  | "EARLY"
  | "LATE"
  | "UNCLEAR"
  | "N/A";

export type PhaseAnchorMark = {
  anchorTimeSec: number;
  anchorType: PhaseAnchorTypeCandidate | (string & {});
  confidence: number;
  rationale: string;
  relationToMusic?: {
    vsBeat?: RelationToMusicVsBeat;
    approxOffsetSec?: number | null;
    note?: string;
  };
  role?: PhaseAnchorRole;
};

export type PhaseAnchorAnnotation = {
  songId: string;
  annotatorId: string;
  annotationVersion: typeof FLY_PHASE_ANCHOR_ANNOTATION_VERSION;
  audioSha256: string;
  primaryOrigin: PhaseAnchorMark;
  anchors: PhaseAnchorMark[];
  annotatedAt: string;
  notes?: string;
  /** Prefer false for independence */
  consultedMusicBeatUi: boolean;
};

export const PHASE_ANCHOR_PILOT_SONG_IDS = [
  "song-013",
  "song-020",
  "song-009",
  "song-005",
  "song-002",
] as const;

export type PhaseAnchorPilotSongId =
  (typeof PHASE_ANCHOR_PILOT_SONG_IDS)[number];

export function validatePhaseAnchorMark(
  m: PhaseAnchorMark
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Number.isFinite(m.anchorTimeSec) || m.anchorTimeSec < 0) {
    errors.push("anchorTimeSec must be finite >= 0");
  }
  if (!(m.confidence >= 0 && m.confidence <= 1)) {
    errors.push("confidence must be in [0,1]");
  }
  if (!m.rationale || !String(m.rationale).trim()) {
    errors.push("rationale required");
  }
  if (!m.anchorType || !String(m.anchorType).trim()) {
    errors.push("anchorType required");
  }
  return { ok: errors.length === 0, errors };
}

export function validatePhaseAnchorAnnotation(
  a: PhaseAnchorAnnotation
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!a.songId) errors.push("songId required");
  if (!a.annotatorId) errors.push("annotatorId required");
  if (a.annotationVersion !== FLY_PHASE_ANCHOR_ANNOTATION_VERSION) {
    errors.push(`annotationVersion must be ${FLY_PHASE_ANCHOR_ANNOTATION_VERSION}`);
  }
  if (!a.audioSha256) errors.push("audioSha256 required");
  if (typeof a.consultedMusicBeatUi !== "boolean") {
    errors.push("consultedMusicBeatUi required boolean");
  }
  const prim = validatePhaseAnchorMark(a.primaryOrigin);
  if (!prim.ok) errors.push(...prim.errors.map((e) => `primaryOrigin: ${e}`));
  if (!Array.isArray(a.anchors)) errors.push("anchors must be array");
  else {
    a.anchors.forEach((m, i) => {
      const r = validatePhaseAnchorMark(m);
      if (!r.ok) errors.push(...r.errors.map((e) => `anchors[${i}]: ${e}`));
    });
  }
  return { ok: errors.length === 0, errors };
}

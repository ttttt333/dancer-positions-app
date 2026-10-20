import type {
  MusicalChange,
  RealSongAnnotation,
  RealSongManifest,
} from "./types";
import {
  FLY_ANNOTATION_CONTRACT_VERSION,
  FLY_REAL_SONG_DATASET_VERSION,
  FLY_REAL_SONG_PROVENANCE_VERSION,
} from "./versions";

const SHA256_RE = /^[a-f0-9]{64}$/i;
const PENDING_RE = /^PENDING_[A-Z0-9_]+$/;

export function isValidAudioSha256(value: string): boolean {
  return SHA256_RE.test(value) || PENDING_RE.test(value);
}

export function validateManifest(m: RealSongManifest): string[] {
  const errors: string[] = [];
  if (!m.songId) errors.push("songId required");
  if (!isValidAudioSha256(m.audioSha256)) {
    errors.push("audioSha256 must be sha256 hex or PENDING_*");
  }
  if (!(m.durationSec > 0)) errors.push("durationSec must be > 0");
  if (!m.conditions?.genre?.length) errors.push("conditions.genre required");
  if (!m.annotators) errors.push("annotators required");
  if (m.annotationVersion !== FLY_ANNOTATION_CONTRACT_VERSION) {
    errors.push(
      `annotationVersion expected ${FLY_ANNOTATION_CONTRACT_VERSION}`
    );
  }
  if (m.realSongDatasetVersion !== FLY_REAL_SONG_DATASET_VERSION) {
    errors.push(
      `realSongDatasetVersion expected ${FLY_REAL_SONG_DATASET_VERSION}`
    );
  }
  if (m.provenanceVersion !== FLY_REAL_SONG_PROVENANCE_VERSION) {
    errors.push(
      `provenanceVersion expected ${FLY_REAL_SONG_PROVENANCE_VERSION}`
    );
  }
  if (m.doubleAnnotate && m.annotators.length < 2 && m.status !== "UNANNOTATED") {
    errors.push("doubleAnnotate songs need ≥2 annotators when annotated");
  }
  return errors;
}

export function validateAnnotation(a: RealSongAnnotation): string[] {
  const errors: string[] = [];
  if (!a.songId) errors.push("songId required");
  if (!a.annotatorId) errors.push("annotatorId required");
  if (!isValidAudioSha256(a.audioSha256)) errors.push("invalid audioSha256");
  if (a.bpm != null && (!(a.bpm > 0) || a.bpm > 400)) {
    errors.push("bpm out of range");
  }
  if (a.bpmConfidence < 0 || a.bpmConfidence > 1) {
    errors.push("bpmConfidence must be 0..1");
  }
  for (let i = 1; i < a.beats.length; i++) {
    if (a.beats[i]! < a.beats[i - 1]!) {
      errors.push("beats must be non-decreasing");
      break;
    }
  }
  // duplicates
  const seen = new Set<number>();
  for (const t of a.beats) {
    if (seen.has(t)) {
      errors.push(`duplicate beat ${t}`);
      break;
    }
    seen.add(t);
  }
  for (const s of a.sections) {
    if (!(s.endSec > s.startSec)) {
      errors.push(`section ${s.label}: endSec must be > startSec`);
    }
    if (s.confidence < 0 || s.confidence > 1) {
      errors.push(`section ${s.label}: bad confidence`);
    }
  }
  if (a.countGrid) {
    if (!(a.countGrid.bpm > 0)) errors.push("countGrid.bpm invalid");
    if (a.countGrid.barsPerPhrase !== 2) {
      errors.push("countGrid.barsPerPhrase must be 2 in v1");
    }
  }
  for (const mc of a.musicalChanges ?? []) {
    errors.push(...validateMusicalChange(mc));
  }
  // formation_change must not appear
  if ("formation_change" in (a as object) || "formationChange" in (a as object)) {
    errors.push("formation_change is forbidden in Phase 4.6");
  }
  return errors;
}

export function validateMusicalChange(mc: MusicalChange): string[] {
  const errors: string[] = [];
  if (!(mc.timeSec >= 0)) errors.push("musical_change.timeSec invalid");
  if (!mc.reasons?.length) errors.push("musical_change.reasons required");
  if (mc.confidence < 0 || mc.confidence > 1) {
    errors.push("musical_change.confidence invalid");
  }
  return errors;
}

/** Ensure no audio-like blobs are tracked as fixtures in git paths we own */
export function assertNoCopyrightedAudioPaths(paths: string[]): string[] {
  const bad: string[] = [];
  for (const p of paths) {
    if (/\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(p) && !/README/i.test(p)) {
      bad.push(p);
    }
  }
  return bad;
}

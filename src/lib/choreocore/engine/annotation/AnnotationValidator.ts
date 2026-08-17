import type { HumanCueAnnotation } from "../types/EvaluationTypes";
import type { AnnotationSession, AnnotationWarning, ConsensusConfig } from "../types/AnnotationTypes";
import { DEFAULT_CONSENSUS_CONFIG } from "../types/AnnotationTypes";
import { beatPeriodSec } from "../evaluation/EvaluationConfig";

const CONTRADICT = new Set<string>(["MAJOR_CHANGE|HOLD", "HOLD|MAJOR_CHANGE"]);

export function validateAnnotationSession(
  session: AnnotationSession,
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG
): { ok: boolean; warnings: AnnotationWarning[] } {
  const warnings: AnnotationWarning[] = [];
  if (!session.id) warnings.push({ field: "id", message: "missing session id", kind: "INVALID" });
  if (!session.songId) warnings.push({ field: "songId", message: "missing songId", kind: "INVALID" });
  if (!session.annotatorId) warnings.push({ field: "annotatorId", message: "missing annotatorId", kind: "INVALID" });
  if (!session.version) warnings.push({ field: "version", message: "missing version", kind: "INVALID" });
  if (session.mode !== "BLIND" && session.mode !== "AI_ASSISTED") {
    warnings.push({ field: "mode", message: "invalid mode", kind: "INVALID" });
  }
  if (!Number.isFinite(session.duration) || session.duration <= 0) {
    warnings.push({ field: "duration", message: "duration must be > 0", kind: "INVALID" });
  }
  const duration = session.duration > 0 ? session.duration : 0;
  const cues = [...session.cues].sort((a, b) => a.time - b.time || a.action.localeCompare(b.action));
  for (const cue of cues) {
    if (cue.time < -1e-6) {
      warnings.push({ field: "cues.time", message: "negative time", kind: "INVALID" });
    }
    if (duration > 0 && cue.time > duration + 1e-6) {
      warnings.push({ field: "cues.time", message: "cue after song end", kind: "WARNING" });
    }
    if (cue.importance < 0 || cue.importance > 100) {
      warnings.push({ field: "cues.importance", message: "importance 0-100", kind: "INVALID" });
    }
    if (cue.confidence < 0 || cue.confidence > 100) {
      warnings.push({ field: "cues.confidence", message: "confidence out of range", kind: "WARNING" });
    }
    if (cue.holdEnd != null && cue.holdEnd + 1e-6 < cue.time) {
      warnings.push({ field: "cues.holdEnd", message: "holdEnd before cue time", kind: "INVALID" });
    }
  }
  const seen = new Set<string>();
  for (const cue of cues) {
    const key = `${cue.time.toFixed(2)}|${cue.action}`;
    if (seen.has(key)) {
      warnings.push({ field: "cues", message: "duplicate cue", kind: "WARNING" });
    }
    seen.add(key);
  }
  const window = config.contradictionWindowSec;
  for (let i = 0; i < cues.length; i += 1) {
    for (let j = i + 1; j < cues.length; j += 1) {
      const a = cues[i]!;
      const b = cues[j]!;
      if (b.time - a.time > window) break;
      if (CONTRADICT.has(`${a.action}|${b.action}`)) {
        warnings.push({
          field: "cues",
          message: "contradictory cues in the same window",
          kind: "CONTRADICTION",
        });
      }
    }
  }
  for (const section of session.sections) {
    if (section.endTime < section.startTime) {
      warnings.push({ field: "sections", message: "end before start", kind: "INVALID" });
    }
    if (section.startTime < -1e-6 || (duration > 0 && section.endTime > duration + 1e-6)) {
      warnings.push({ field: "sections", message: "out of range", kind: "INVALID" });
    }
  }
  for (const f of session.formations) {
    const axes = [f.score, f.musicFit, f.visualImpact, f.transitionQuality, f.execution, f.originality];
    if (axes.some((v) => v < 0 || v > 100)) {
      warnings.push({ field: "formations", message: "scores must be 0-100", kind: "INVALID" });
    }
  }
  return { ok: warnings.every((w) => w.kind !== "INVALID"), warnings };
}

export function actionFamily(action: HumanCueAnnotation["action"]): string {
  if (action === "HOLD") return "HOLD";
  if (action === "MICRO_SHIFT") return "MICRO";
  if (action === "MAJOR_CHANGE") return "MAJOR";
  return "SHAPE";
}

export function beatWindowSec(bpm: number, beats: number): number {
  return beatPeriodSec(bpm) * Math.max(0.25, beats);
}

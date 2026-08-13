import type { AudioFeatureFrame, HitEvent, HitType, MusicAnalysisResultPhase1 } from "../types";
import { clamp01 } from "../audio/signalMath";
import { energyAtTime, nearestFrame } from "./structureMath";

/**
 * Relabel Phase 1 hits using local spectral context.
 * Labels are hypotheses with confidence — not drum transcription.
 */
export function classifyHits(
  hits: HitEvent[],
  phase1: MusicAnalysisResultPhase1
): HitEvent[] {
  return hits.map((hit) => classifyOneHit(hit, phase1));
}

function classifyOneHit(
  hit: HitEvent,
  phase1: MusicAnalysisResultPhase1
): HitEvent {
  const frame = nearestFrame(phase1.frames, hit.time);
  if (!frame) {
    return { ...hit, type: "MUSICAL_HIT", confidence: Math.min(hit.confidence, 0.55) };
  }

  const bass = frame.bassEnergy;
  const body = frame.lowMidEnergy + frame.midEnergy;
  const bright = frame.highMidEnergy + frame.highEnergy;
  const onset = Math.max(hit.strength, frame.onsetStrength);
  const energyBefore = energyAtTime(phase1.energyCurve, Math.max(0, hit.time - 0.6));
  const energyAfter = energyAtTime(phase1.energyCurve, hit.time + 0.4);
  const energyRise = energyAfter - energyBefore;
  const bassBefore = nearestFrame(phase1.frames, Math.max(0, hit.time - 0.6));
  const bassRise = bass - (bassBefore?.bassEnergy ?? bass);

  const kickScore =
    onset * 0.45 +
    (bass > body * 1.05 && bass > bright ? 0.4 : 0) +
    clamp01(bass / (bright + 1e-6) / 4) * 0.15;
  const snareScore =
    onset * 0.35 + (bright > bass * 1.15 ? 0.45 : 0) + (body > bass ? 0.1 : 0);
  const dropScore =
    (energyRise > 12 ? 0.4 : 0) + (bassRise > 0.05 ? 0.35 : 0) + (onset > 0.6 ? 0.2 : 0);
  const impactScore =
    (onset >= 0.8 ? 0.45 : 0) +
    (bass > 0.15 && body > 0.2 && bright > 0.2 ? 0.45 : 0);

  const ranked: Array<{ type: HitType; score: number }> = [
    { type: "IMPACT", score: impactScore },
    { type: "DROP", score: dropScore },
    { type: "KICK", score: kickScore },
    { type: "SNARE", score: snareScore },
  ];
  ranked.sort((a, b) => b.score - a.score);

  const best = ranked[0]!;
  const second = ranked[1]!.score;
  const margin = best.score - second;
  if (best.score < 0.5 || margin < 0.05) {
    return {
      ...hit,
      type: "MUSICAL_HIT",
      confidence: clamp01(0.45 + onset * 0.3),
    };
  }
  return {
    ...hit,
    type: best.type,
    confidence: clamp01(0.55 + margin + onset * 0.15),
  };
}

export function frameLooksLikeKick(frame: AudioFeatureFrame): boolean {
  return (
    frame.onsetStrength >= 0.45 &&
    frame.bassEnergy >= frame.midEnergy &&
    frame.bassEnergy >= frame.highMidEnergy
  );
}

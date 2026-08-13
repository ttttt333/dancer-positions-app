import type { HumanCueAnnotation, HumanFormationRating } from "../types/EvaluationTypes";
import { matchingWindowSec } from "./EvaluationConfig";
import { clamp, cohenKappa, pearson } from "./EvaluationMetrics";

export function humanCueAgreement(
  a: HumanCueAnnotation[],
  b: HumanCueAnnotation[],
  bpm: number,
  matchingBeats: number
): { matchRate: number; kappa: number } {
  if (a.length === 0 && b.length === 0) return { matchRate: 1, kappa: 1 };
  const window = matchingWindowSec(bpm, matchingBeats);
  const used = new Set<number>();
  let agree = 0;
  let paired = 0;
  const as = [...a].sort((x, y) => x.time - y.time);
  const bs = [...b].sort((x, y) => x.time - y.time);
  for (const left of as) {
    let best = -1;
    let bestErr = Infinity;
    for (let i = 0; i < bs.length; i += 1) {
      if (used.has(i)) continue;
      const err = Math.abs(bs[i]!.time - left.time);
      if (err <= window && err < bestErr) {
        bestErr = err;
        best = i;
      }
    }
    if (best >= 0) {
      used.add(best);
      paired += 1;
      if (bs[best]!.action === left.action) agree += 1;
    }
  }
  const n = Math.max(as.length, bs.length, 1);
  const matchRate = paired / n;
  const pe = 0.2;
  const kappa = cohenKappa(agree, Math.max(paired, 1), pe);
  return { matchRate: clamp(matchRate, 0, 1), kappa };
}

export function humanFormationAgreement(
  a: HumanFormationRating[],
  b: HumanFormationRating[]
): { correlation: number } {
  const n = Math.min(a.length, b.length);
  if (n === 0) return { correlation: 1 };
  const xa = a.slice(0, n).map((r) => r.score);
  const xb = b.slice(0, n).map((r) => r.score);
  return { correlation: n === 1 ? (xa[0] === xb[0] ? 1 : 0) : pearson(xa, xb) };
}

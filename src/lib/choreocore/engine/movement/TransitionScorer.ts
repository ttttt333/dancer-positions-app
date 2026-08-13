import type { FormationCueAction } from "../types/CueTypes";
import type { Formation } from "../types/FormationTypes";
import type { MovementPlan } from "../types/MovementTypes";

function radius(formation: Formation, cx: number, cy: number): number {
  const pts = Object.values(formation.positions);
  if (pts.length === 0) return 0;
  return (
    pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length
  );
}

export function actionFitScore(
  action: FormationCueAction,
  current: Formation,
  next: Formation,
  stageWidth: number,
  stageDepth: number
): number {
  const cx = stageWidth / 2;
  const cy = stageDepth / 2;
  const r0 = radius(current, cx, cy);
  const r1 = radius(next, cx, cy);
  const delta = r1 - r0;
  switch (action) {
    case "EXPAND":
    case "MAJOR_CHANGE":
      return delta > 0 ? 85 : 45;
    case "CONTRACT":
    case "CLUSTER":
      return delta < 0 ? 85 : 45;
    case "CENTER":
      return r1 < r0 * 0.85 || r1 < stageWidth * 0.18 ? 80 : 50;
    case "SPLIT":
      return groupSeparation(next) > groupSeparation(current) ? 82 : 48;
    case "MERGE":
      return groupSeparation(next) < groupSeparation(current) ? 82 : 48;
    default:
      return 70;
  }
}

function groupSeparation(formation: Formation): number {
  const xs = Object.values(formation.positions).map((p) => p.x).sort((a, b) => a - b);
  if (xs.length < 4) return 0;
  const mid = Math.floor(xs.length / 2);
  const left = xs.slice(0, mid);
  const right = xs.slice(mid);
  const lc = left.reduce((s, x) => s + x, 0) / left.length;
  const rc = right.reduce((s, x) => s + x, 0) / right.length;
  return rc - lc;
}

export function movementDifficulty(plan: MovementPlan, crossing: boolean): number {
  const norm = plan.averageDistance;
  let d = 10;
  if (norm > 40) d = 30;
  if (norm > 90) d = 50;
  if (norm > 160) d = 65;
  if (crossing) d = Math.max(d, 70);
  if (plan.collision.risk > 60 && plan.maxDistance > 80) d = 90;
  return d;
}

export function calculateTransitionScore(options: {
  feasible: boolean;
  hardViolation: boolean;
  risk: number;
  averageDistance: number;
  usableWidth: number;
  collisionRisk: number;
  difficulty: number;
}): number {
  if (options.hardViolation) return Math.min(35, 40 - options.risk * 0.2);
  const feas = options.feasible ? 100 : 35;
  const riskScore = Math.max(0, 100 - options.risk);
  const distScore = Math.max(
    0,
    100 - (options.averageDistance / Math.max(1, options.usableWidth)) * 140
  );
  const colScore = Math.max(0, 100 - options.collisionRisk);
  const diffScore = Math.max(0, 100 - options.difficulty);
  return (
    feas * 0.4 +
    riskScore * 0.2 +
    distScore * 0.15 +
    colScore * 0.15 +
    diffScore * 0.1
  );
}

import type { FormationCandidate, Point } from "../types/FormationTypes";
import type {
  DancerMovement,
  MovementEngineConfig,
  MovementPlan,
  TransitionAnalysis,
  TransitionContext,
} from "../types/MovementTypes";
import { usableStage } from "../formation/FormationScaler";
import { resolveAbility, resolveMovementEngineConfig } from "./movementConfig";
import { calculatePushingLimit } from "./PushingLimitAdapter";
import { calculateTravelDistance } from "./TravelDistance";
import {
  calculateMovementFeasibility,
  calculateRequiredTravelTime,
} from "./MovementSpeed";
import {
  convergenceRisk,
  detectFormationCollisions,
  detectMovementCollisions,
  pathLeavesStage,
} from "./CollisionDetector";
import {
  actionFitScore,
  calculateTransitionScore,
  movementDifficulty,
} from "./TransitionScorer";
import { secondsToBeats } from "./MovementTiming";

function finite(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value;
}

function pairedPositions(
  current: Record<string, Point>,
  next: Record<string, Point>
): { from: Record<string, Point>; to: Record<string, Point> } {
  const ids = Object.keys(next).sort((a, b) => a.localeCompare(b));
  const currentIds = Object.keys(current).sort((a, b) => a.localeCompare(b));
  const from: Record<string, Point> = {};
  const to: Record<string, Point> = {};
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!;
    to[id] = next[id]!;
    from[id] = current[id] ?? current[currentIds[i] ?? ""] ?? next[id]!;
  }
  return { from, to };
}

export function analyzeFormationTransition(
  context: TransitionContext,
  candidate?: FormationCandidate,
  config?: Partial<MovementEngineConfig>
): TransitionAnalysis {
  const cfg = resolveMovementEngineConfig(config);
  const next = candidate?.formation ?? context.nextFormation;
  const current = context.currentFormation;
  const { from, to } = pairedPositions(current.positions, next.positions);
  const ids = Object.keys(to).sort((a, b) => a.localeCompare(b));
  const pushingLimit = calculatePushingLimit(
    { ...context, nextFormation: next },
    context.timing
  );

  const warnings: string[] = [];
  const movements: DancerMovement[] = [];
  let hardPush = false;
  let softPush = false;
  let boundaryHard = false;
  let marginRisk = 0;

  for (const id of ids) {
    const a = from[id]!;
    const b = to[id]!;
    const distance = calculateTravelDistance(a, b);
    const ability = resolveAbility(context.dancerAbilities?.[id]);
    const requiredSeconds = calculateRequiredTravelTime(
      distance,
      context.stage,
      ability,
      context.cue.magnitude
    );
    const feas = calculateMovementFeasibility({
      distance,
      pushingLimit,
      requiredSeconds,
      timing: context.timing,
      softRatio: cfg.softViolationRatio,
    });
    if (feas.hardViolation) hardPush = true;
    if (feas.softViolation) {
      softPush = true;
      warnings.push(`SOFT_PUSHING:${id}`);
    }
    const path = pathLeavesStage(a, b, context.stage, cfg.sampleCount);
    if (path.outside) {
      boundaryHard = true;
      warnings.push(`STAGE_OUTSIDE:${id}`);
    } else if (path.marginBreach) {
      marginRisk += 8;
      warnings.push(`SAFE_MARGIN:${id}`);
    }
    const speedRisk = Math.max(0, (feas.speedRatio - 0.7) * 50);
    const distRisk = pushingLimit <= 0 ? 80 : Math.max(0, (distance / pushingLimit - 0.6) * 70);
    movements.push({
      dancerId: id,
      from: a,
      to: b,
      distance,
      requiredSeconds,
      availableSeconds: context.timing.availableSeconds,
      requiredBeats: secondsToBeats(requiredSeconds, context.timing.bpm),
      availableBeats: context.timing.availableBeats,
      directFeasible: feas.directFeasible && !path.outside,
      speedRatio: feas.speedRatio,
      pushingLimit,
      risk: finite(Math.min(100, speedRisk + distRisk + (path.outside ? 80 : 0))),
    });
  }

  const staticCol = detectFormationCollisions(to, context.stage.minDancerDistance);
  const moveCol = detectMovementCollisions(
    from,
    to,
    context.stage.minDancerDistance,
    cfg.pathCollisionSamples
  );
  const convRaw = convergenceRisk(from, to, context.stage);
  const intendedConvergence =
    context.cue.action === "CONTRACT" ||
    context.cue.action === "CLUSTER" ||
    context.cue.action === "CENTER" ||
    context.cue.action === "MERGE";
  const conv = intendedConvergence ? convRaw * 0.4 : convRaw;
  if (staticCol.hasCollision) warnings.push("STATIC_COLLISION");
  if (moveCol.sameTimeCrossing) warnings.push("SAME_TIME_CROSSING");
  else if (moveCol.pathCrossing) warnings.push("PATH_CROSSING");
  if (convRaw >= 50) warnings.push("CONVERGENCE");

  const distances = movements.map((m) => m.distance);
  const totalDistance = distances.reduce((s, d) => s + d, 0);
  const maxDistance = distances.length === 0 ? 0 : Math.max(...distances);
  const averageDistance = distances.length === 0 ? 0 : totalDistance / distances.length;

  const invalid = ids.some((id) => {
    const p = to[id]!;
    return !Number.isFinite(p.x) || !Number.isFinite(p.y);
  });
  const duplicates = staticCol.collisionPairs.some((p) => p.minDistance < 1e-4);

  let rejectionReason: string | undefined;
  if (invalid) rejectionReason = "INVALID_COORDINATE";
  else if (duplicates) rejectionReason = "DUPLICATE_FINAL_POSITION";
  else if (boundaryHard) rejectionReason = "STAGE_OUTSIDE";
  else if (staticCol.hasCollision) rejectionReason = "STATIC_COLLISION";
  else if (hardPush) rejectionReason = "HARD_PUSHING_LIMIT";
  else if (context.timing.availableSeconds <= 0.05 && maxDistance > 8) {
    rejectionReason = "IMPOSSIBLE_AVAILABLE_TIME";
  }

  const collisionRisk = Math.min(100, staticCol.risk * 0.6 + moveCol.risk * 0.4);
  const dancerRisk =
    movements.length === 0
      ? 0
      : movements.reduce((s, m) => s + m.risk, 0) / movements.length;
  const risk = finite(
    Math.min(
      100,
      dancerRisk * 0.45 +
        collisionRisk * 0.25 +
        conv * 0.15 +
        marginRisk * 0.05 +
        (softPush ? 8 : 0)
    )
  );

  const feasible = !rejectionReason;
  const difficulty = movementDifficulty(
    {
      movements,
      totalDistance,
      maxDistance,
      averageDistance,
      collision: moveCol,
      stageBoundaryViolation: boundaryHard,
      pushingLimitViolation: hardPush,
      feasible,
      risk,
      score: 0,
    },
    moveCol.pathCrossing
  );

  const actionFit = actionFitScore(
    context.cue.action,
    current,
    next,
    context.stage.width,
    context.stage.depth
  );
  let score = calculateTransitionScore({
    feasible,
    hardViolation: Boolean(rejectionReason),
    risk,
    averageDistance,
    usableWidth: usableStage(context.stage).width,
    collisionRisk,
    difficulty,
  });
  score = finite(score * 0.85 + actionFit * 0.15);

  const plan: MovementPlan = {
    movements,
    totalDistance: finite(totalDistance),
    maxDistance: finite(maxDistance),
    averageDistance: finite(averageDistance),
    collision: {
      hasCollision: staticCol.hasCollision || moveCol.sameTimeCrossing,
      collisionPairs: [...staticCol.collisionPairs, ...moveCol.collisionPairs],
      risk: finite(collisionRisk),
    },
    stageBoundaryViolation: boundaryHard,
    pushingLimitViolation: hardPush,
    feasible,
    risk,
    score,
  };

  const band: TransitionAnalysis["band"] = !feasible
    ? "D"
    : risk < 25
      ? "A"
      : risk < 50
        ? "B"
        : "C";

  return {
    candidateId: candidate?.id ?? next.id,
    movementPlan: plan,
    feasibility: feasible ? 100 : 0,
    risk,
    transitionScore: finite(score),
    rejectionReason,
    warnings: [...new Set(warnings)].sort(),
    band,
  };
}

export function analyzeFormationTransitions(
  context: Omit<TransitionContext, "nextFormation"> & { nextFormation?: TransitionContext["nextFormation"] },
  candidates: FormationCandidate[],
  config?: Partial<MovementEngineConfig>
): TransitionAnalysis[] {
  const analyses = candidates.map((candidate) =>
    analyzeFormationTransition(
      {
        ...context,
        nextFormation: candidate.formation,
      },
      candidate,
      config
    )
  );
  analyses.sort((a, b) => {
    if (a.movementPlan.feasible !== b.movementPlan.feasible) {
      return a.movementPlan.feasible ? -1 : 1;
    }
    return (
      b.transitionScore - a.transitionScore ||
      a.risk - b.risk ||
      a.movementPlan.averageDistance - b.movementPlan.averageDistance ||
      a.candidateId.localeCompare(b.candidateId)
    );
  });
  return analyses;
}

export function filterFeasibleTransitions(
  analyses: TransitionAnalysis[]
): TransitionAnalysis[] {
  return analyses.filter((a) => a.movementPlan.feasible);
}

/**
 * Stage 7: Formation A → 自然な Transition → Formation B。
 * 最短経路 ≠ 最良。Music / Formation Intelligence は書き換えない。
 */

import type { FormationCue, StageConfig } from "../types/CueTypes";
import type { Formation, Point } from "../types/FormationTypes";
import type { FormationIntelligenceReport } from "../formation/intentFormationTypes";
import { assignDancersToTargets } from "./AssignmentAdapter";
import { calculatePushingLimit } from "./PushingLimitAdapter";
import { effectiveSpeedPx } from "./MovementSpeed";
import { resolveMovementTiming } from "./MovementTiming";
import { detectFormationCollisions } from "./CollisionDetector";
import { calculateTravelDistance } from "./TravelDistance";
import { clamp, finite, mean } from "../scoring/scoreMath";
import {
  TRANSITION_ALTERNATIVE_COUNT,
  TRANSITION_COST_NORMALIZE,
  TRANSITION_COST_WEIGHTS,
  TRANSITION_DIVERSITY,
  TRANSITION_DURATION,
  TRANSITION_EFFICIENCY,
  TRANSITION_HARD,
  TRANSITION_INTELLIGENCE_VERSION,
  TRANSITION_MAX_CANDIDATES,
  TRANSITION_PATH_GEOMETRY,
  TRANSITION_PATH_KINDS,
  TRANSITION_PHASES,
  TRANSITION_SAMPLE,
  TRANSITION_SCORE_WEIGHTS,
} from "./transitionIntelligenceConfig";
import type {
  DancerTransitionPath,
  RankedTransitionCandidate,
  TransitionAssignmentKind,
  TransitionIntelligenceRequest,
  TransitionIntelligenceReport,
  TransitionPathKind,
  TransitionPhase,
  TransitionRecommendation,
} from "./transitionIntelligenceTypes";
import {
  defaultPathOptions,
  headingTurnMetrics,
  pathLeavesStageAlong,
  polylineLength,
  samplePathPolyline,
  type PathSampleOptions,
} from "./transitionPathModels";
import { detectTemporalPathCollisions } from "./transitionPathCollision";

export { TRANSITION_INTELLIGENCE_VERSION } from "./transitionIntelligenceConfig";
export type {
  TransitionEvaluation,
  TransitionHumanRating,
  TransitionIntelligenceReport,
  TransitionRecommendation,
  RankedTransitionCandidate,
} from "./transitionIntelligenceTypes";

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function resolveAvailableDuration(request: TransitionIntelligenceRequest): {
  startTime: number;
  endTime: number;
  availableSeconds: number;
  availableBeats: number;
  bpm: number;
} {
  const bpm = request.constraints?.bpm ?? request.timing?.bpm ?? 120;
  if (
    request.constraints?.availableSeconds !== undefined &&
    Number.isFinite(request.constraints.availableSeconds)
  ) {
    const availableSeconds = Math.max(
      TRANSITION_DURATION.minSeconds,
      request.constraints.availableSeconds
    );
    const endTime = request.cue.rawTime;
    return {
      startTime: Math.max(0, endTime - availableSeconds),
      endTime,
      availableSeconds,
      availableBeats: availableSeconds * (bpm / 60),
      bpm,
    };
  }
  if (request.timing) {
    return {
      startTime: request.timing.startTime,
      endTime: request.timing.endTime,
      availableSeconds: Math.max(
        TRANSITION_DURATION.minSeconds,
        finiteOr(request.timing.availableSeconds, TRANSITION_DURATION.minSeconds)
      ),
      availableBeats: request.timing.availableBeats,
      bpm: request.timing.bpm,
    };
  }
  return resolveMovementTiming({
    cue: request.cue,
    previousCue: request.previousCue,
    bpm,
  });
}

function identityTargets(from: Formation, to: Formation): Record<string, Point> | null {
  const ids = Object.keys(from.positions).sort((a, b) => a.localeCompare(b));
  const next: Record<string, Point> = {};
  for (const id of ids) {
    const p = to.positions[id];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    next[id] = { x: p.x, y: p.y };
  }
  return next;
}

function hungarianTargets(from: Formation, to: Formation): Record<string, Point> {
  const ids = Object.keys(from.positions).sort((a, b) => a.localeCompare(b));
  const targetIds = Object.keys(to.positions).sort((a, b) => a.localeCompare(b));
  const dancers = ids.map((id) => ({
    id,
    from: from.positions[id]!,
    visualWeight: from.visualHierarchy?.[id],
  }));
  const targets = targetIds.map((id) => ({
    id,
    to: to.positions[id]!,
    visualWeight: to.visualHierarchy?.[id],
  }));
  return assignDancersToTargets(dancers, targets);
}

function sameTargets(a: Record<string, Point>, b: Record<string, Point>): boolean {
  const ids = Object.keys(a);
  if (ids.length !== Object.keys(b).length) return false;
  return ids.every((id) => {
    const p = a[id];
    const q = b[id];
    return Boolean(p && q && Math.hypot(p.x - q.x, p.y - q.y) < 1e-4);
  });
}

function lockedViolation(
  from: Formation,
  targets: Record<string, Point>,
  lockedIds: string[] | undefined
): boolean {
  if (!lockedIds?.length) return false;
  for (const id of lockedIds) {
    const a = from.positions[id];
    const b = targets[id];
    if (!a || !b) return true;
    if (Math.hypot(a.x - b.x, a.y - b.y) > TRANSITION_HARD.lockedPositionEpsilon) {
      return true;
    }
  }
  return false;
}

function chooseArcSign(
  from: Formation,
  targets: Record<string, Point>,
  stage: StageConfig,
  kind: TransitionPathKind
): 1 | -1 {
  if (kind === "STRAIGHT") return 1;
  let best: 1 | -1 = 1;
  let bestScore = Infinity;
  for (const sign of [1, -1] as const) {
    const opts = defaultPathOptions(kind, sign);
    let outside = 0;
    let length = 0;
    for (const id of Object.keys(targets).sort((a, b) => a.localeCompare(b))) {
      const a = from.positions[id];
      const b = targets[id];
      if (!a || !b) continue;
      const samples = samplePathPolyline(a, b, stage, opts, TRANSITION_SAMPLE.coarse);
      if (pathLeavesStageAlong(samples, stage).outside) outside += 1;
      length += polylineLength(samples);
    }
    const score = outside * 10_000 + length;
    if (score < bestScore || (score === bestScore && sign === 1)) {
      bestScore = score;
      best = sign;
    }
  }
  return best;
}

function buildPaths(
  from: Formation,
  targets: Record<string, Point>,
  stage: StageConfig,
  kind: TransitionPathKind,
  sign: 1 | -1
): DancerTransitionPath[] {
  const opts: PathSampleOptions = defaultPathOptions(kind, sign);
  const ids = Object.keys(targets).sort((a, b) => a.localeCompare(b));
  return ids.map((id) => {
    const start = from.positions[id] ?? targets[id]!;
    const end = targets[id]!;
    const samples = samplePathPolyline(start, end, stage, opts);
    return {
      dancerId: id,
      from: start,
      to: end,
      pathKind: kind,
      pathLength: polylineLength(samples),
      samples,
    };
  });
}

function groupCoherence(paths: DancerTransitionPath[]): number {
  const headings: number[] = [];
  for (const p of paths) {
    const dx = p.to.x - p.from.x;
    const dy = p.to.y - p.from.y;
    if (Math.hypot(dx, dy) < TRANSITION_PATH_GEOMETRY.minChordForCurve) continue;
    headings.push(Math.atan2(dy, dx));
  }
  if (headings.length < 2) return 78;
  const cx = mean(headings.map((h) => Math.cos(h)));
  const sy = mean(headings.map((h) => Math.sin(h)));
  const r = Math.hypot(cx, sy);
  return clamp(r * 100, 0, 100);
}

function arrivalSyncScore(paths: DancerTransitionPath[]): number {
  const lengths = paths.map((p) => p.pathLength);
  const maxL = Math.max(...lengths, 0);
  if (maxL < 1e-6) return 100;
  const early = lengths.map((l) => 1 - l / maxL);
  const avg = mean(early);
  const variance = mean(early.map((e) => (e - avg) ** 2));
  return clamp(100 - Math.sqrt(variance) * 140, 0, 100);
}

function reasonCodesFor(options: {
  kind: TransitionPathKind;
  assignment: TransitionAssignmentKind;
  feasible: boolean;
  collisionRisk: number;
  crossingRisk: number;
  speedPressure: number;
  smoothness: number;
  arrivalSync: number;
  pathCost: number;
}): string[] {
  const codes = [
    `PATH_${options.kind}`,
    options.assignment === "identity" ? "IDENTITY_ASSIGNMENT" : "HUNGARIAN_ASSIGNMENT",
  ];
  if (options.feasible) codes.push("FEASIBLE");
  if (options.collisionRisk <= 22) codes.push("LOW_COLLISION_RISK");
  if (options.speedPressure <= 35) codes.push("LOW_SPEED_PRESSURE");
  if (options.smoothness >= 72) codes.push("SMOOTH_CURVE");
  if (options.pathCost <= 32) codes.push("SHORT_PATH");
  if (options.arrivalSync >= 78) codes.push("SYNCHRONIZED_ARRIVAL");
  if (options.crossingRisk <= 20) codes.push("LOW_CROSSING");
  return codes;
}

function compareCandidates(a: RankedTransitionCandidate, b: RankedTransitionCandidate): number {
  if (b.evaluation.score !== a.evaluation.score) return b.evaluation.score - a.evaluation.score;
  if (a.pathKind !== b.pathKind) return a.pathKind.localeCompare(b.pathKind);
  if (a.assignment !== b.assignment) return a.assignment.localeCompare(b.assignment);
  return a.id.localeCompare(b.id);
}

function pickPrimaryAndAlternatives(
  ranked: RankedTransitionCandidate[]
): { primary: RankedTransitionCandidate | null; alternatives: RankedTransitionCandidate[] } {
  if (ranked.length === 0) return { primary: null, alternatives: [] };
  const primary = ranked[0]!;
  const alts: RankedTransitionCandidate[] = [];
  const usedKinds = new Set<string>([`${primary.pathKind}:${primary.assignment}`]);
  for (const c of ranked.slice(1)) {
    if (alts.length >= TRANSITION_ALTERNATIVE_COUNT) break;
    if (primary.evaluation.score - c.evaluation.score > TRANSITION_DIVERSITY.maxScoreGapFromPrimary) {
      continue;
    }
    const key = `${c.pathKind}:${c.assignment}`;
    if (usedKinds.has(key)) continue;
    alts.push(c);
    usedKinds.add(key);
  }
  for (const c of ranked.slice(1)) {
    if (alts.length >= TRANSITION_ALTERNATIVE_COUNT) break;
    if (alts.includes(c)) continue;
    if (primary.evaluation.score - c.evaluation.score > TRANSITION_DIVERSITY.maxScoreGapFromPrimary) {
      continue;
    }
    alts.push(c);
  }
  return { primary, alternatives: alts };
}

function evaluateCandidate(options: {
  id: string;
  kind: TransitionPathKind;
  assignment: TransitionAssignmentKind;
  from: Formation;
  targets: Record<string, Point>;
  paths: DancerTransitionPath[];
  cue: FormationCue;
  stage: StageConfig;
  availableSeconds: number;
  bpm: number;
}): RankedTransitionCandidate | null {
  const { paths, stage, availableSeconds } = options;
  if (paths.length === 0) return null;
  let outside = false;
  for (const p of paths) {
    const leave = pathLeavesStageAlong(p.samples, stage);
    if (leave.outside) outside = true;
    for (const s of p.samples) {
      if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return null;
    }
  }
  const collision = detectTemporalPathCollisions(paths, stage.minDancerDistance);
  const staticCol = detectFormationCollisions(options.targets, stage.minDancerDistance);
  const lengths = paths.map((p) => p.pathLength);
  const totalLength = lengths.reduce((s, n) => s + n, 0);
  const maxLength = Math.max(...lengths, 0);
  const cruise = effectiveSpeedPx(stage, undefined, options.cue.magnitude);
  const requiredSeconds = maxLength / Math.max(1, cruise);
  const speedRatio = requiredSeconds / Math.max(TRANSITION_DURATION.minSeconds, availableSeconds);
  const timing = {
    startTime: 0,
    endTime: availableSeconds,
    availableSeconds,
    availableBeats: availableSeconds * (options.bpm / 60),
    bpm: options.bpm,
  };
  const pushing = calculatePushingLimit(
    {
      currentFormation: options.from,
      nextFormation: { ...options.from, id: "transition-target", positions: options.targets },
      cue: options.cue,
      stage,
    },
    timing
  );
  const impossibleTiming = speedRatio > TRANSITION_HARD.maxSpeedRatio;
  const feasible =
    !outside &&
    !collision.hardCollision &&
    !staticCol.hasCollision &&
    !impossibleTiming;

  const turns = paths.map((p) => headingTurnMetrics(p.samples));
  const meanTurn = mean(turns.map((t) => t.turnRadians));
  const meanTurnCount = mean(turns.map((t) => t.turnCount));
  const peakSpeed = maxLength / Math.max(TRANSITION_DURATION.minSeconds, availableSeconds);
  const accelDemand = peakSpeed / Math.max(TRANSITION_DURATION.minSeconds, availableSeconds * 0.28);
  const distanceCost = clamp((totalLength / TRANSITION_COST_NORMALIZE.distanceRef) * 100, 0, 100);
  const speedCost = clamp((speedRatio / TRANSITION_COST_NORMALIZE.speedRatioRef) * 100, 0, 100);
  const accelerationCost = clamp((accelDemand / TRANSITION_COST_NORMALIZE.accelRef) * 100, 0, 100);
  const turnCost = clamp(
    (meanTurn / TRANSITION_COST_NORMALIZE.turnRef) * 70 + meanTurnCount * 8,
    0,
    100
  );
  const crossingCost = clamp(collision.crossingRisk * 0.85, 0, 100);
  const collisionCost = clamp(
    Math.max(collision.collisionRisk, staticCol.risk) * 0.9,
    0,
    100
  );
  const crowding =
    pushing <= 0 ? 0 : clamp((maxLength / pushing - 1) * 28, 0, 36);
  const timingPressure = clamp(speedRatio * 55 + crowding, 0, 100);
  const w = TRANSITION_COST_WEIGHTS;
  const transitionCost = clamp(
    distanceCost * w.distance +
      speedCost * w.speed +
      accelerationCost * w.acceleration +
      turnCost * w.turn +
      crossingCost * w.crossing +
      collisionCost * w.collision +
      timingPressure * w.timingPressure,
    0,
    100
  );
  const smoothness = clamp(100 - turnCost * 0.7 - accelerationCost * 0.3, 0, 100);
  const arrivalSync = arrivalSyncScore(paths);
  const coherence = groupCoherence(paths);
  const spacing = clamp(100 - staticCol.risk, 0, 100);
  const collisionSafety = clamp(100 - collisionCost, 0, 100);
  const efficiency = clamp(
    ((100 - transitionCost) /
      Math.max(TRANSITION_EFFICIENCY.costFloor, transitionCost)) *
      TRANSITION_EFFICIENCY.scoreScale,
    0,
    100
  );
  const sw = TRANSITION_SCORE_WEIGHTS;
  const score = clamp(
    (feasible ? 100 : 28) * sw.feasibility +
      collisionSafety * sw.collisionSafety +
      smoothness * sw.smoothness +
      clamp(100 - timingPressure, 0, 100) * sw.timing +
      efficiency * sw.movementEfficiency +
      arrivalSync * sw.arrivalSync +
      coherence * sw.groupCoherence +
      spacing * sw.spacing,
    0,
    100
  );
  const pathCost = distanceCost;
  const speedPressure = timingPressure;
  const evaluation = {
    feasible,
    pathCost,
    collisionRisk: collision.collisionRisk,
    crossingRisk: collision.crossingRisk,
    speedPressure,
    smoothness,
    arrivalSync,
    score,
    reasonCodes: reasonCodesFor({
      kind: options.kind,
      assignment: options.assignment,
      feasible,
      collisionRisk: collision.collisionRisk,
      crossingRisk: collision.crossingRisk,
      speedPressure,
      smoothness,
      arrivalSync,
      pathCost,
    }),
  };
  return {
    id: `${options.assignment}-${options.kind}`,
    pathKind: options.kind,
    assignment: options.assignment,
    targetPositions: options.targets,
    paths,
    evaluation,
    transitionCost,
    transitionQuality: score,
    transitionEfficiency: efficiency,
    distanceCost,
    speedCost,
    accelerationCost,
    turnCost,
    crossingCost,
    collisionCost,
    timingPressure,
    groupCoherence: coherence,
    spacing,
    maxRequiredSpeed: finite(speedRatio),
    phases: [...TRANSITION_PHASES] as TransitionPhase[],
  };
}

export function generateTransitionPaths(
  request: TransitionIntelligenceRequest
): RankedTransitionCandidate[] {
  const identity = identityTargets(request.from, request.to);
  if (!identity) return [];
  const hungarian = hungarianTargets(request.from, request.to);
  const assignments: Array<{ kind: TransitionAssignmentKind; targets: Record<string, Point> }> =
    [{ kind: "identity", targets: identity }];
  if (!sameTargets(identity, hungarian)) {
    assignments.push({ kind: "hungarian", targets: hungarian });
  }

  const locked = request.constraints?.lockedDancerIds;
  const duration = resolveAvailableDuration(request);
  const out: RankedTransitionCandidate[] = [];

  for (const assignment of assignments) {
    if (lockedViolation(request.from, assignment.targets, locked)) continue;
    const trivial = Object.keys(assignment.targets).every((id) => {
      const a = request.from.positions[id]!;
      const b = assignment.targets[id]!;
      return calculateTravelDistance(a, b) < TRANSITION_PATH_GEOMETRY.minChordForCurve;
    });
    const kinds: TransitionPathKind[] = trivial
      ? ["STRAIGHT"]
      : [...TRANSITION_PATH_KINDS];
    for (const kind of kinds) {
      const sign = chooseArcSign(request.from, assignment.targets, request.stage, kind);
      const paths = buildPaths(request.from, assignment.targets, request.stage, kind, sign);
      if (paths.some((p) => pathLeavesStageAlong(p.samples, request.stage).outside)) {
        continue;
      }
      const ranked = evaluateCandidate({
        id: `${assignment.kind}-${kind}`,
        kind,
        assignment: assignment.kind,
        from: request.from,
        targets: assignment.targets,
        paths,
        cue: request.cue,
        stage: request.stage,
        availableSeconds: duration.availableSeconds,
        bpm: duration.bpm,
      });
      if (ranked) out.push(ranked);
    }
  }

  out.sort(compareCandidates);
  return out.slice(0, TRANSITION_MAX_CANDIDATES);
}

export function recommendTransition(
  request: TransitionIntelligenceRequest
): TransitionRecommendation {
  const duration = resolveAvailableDuration(request);
  const generated = generateTransitionPaths(request);
  const ranked = generated.filter((c) => c.evaluation.feasible);
  const discardedCount = generated.length - ranked.length;
  ranked.sort(compareCandidates);
  const { primary, alternatives } = pickPrimaryAndAlternatives(ranked);
  return {
    fromFormationId: request.from.id,
    toFormationId: request.to.id,
    cueId: request.cue.id,
    availableSeconds: duration.availableSeconds,
    availableBeats: duration.availableBeats,
    primary,
    alternatives,
    ranked,
    discardedCount,
  };
}

export function recommendTransitionsForFormationIntelligence(input: {
  report: FormationIntelligenceReport;
  currentFormation: Formation;
  cues: FormationCue[];
  stage: StageConfig;
  bpm: number;
}): TransitionIntelligenceReport {
  const cueById = new Map(input.cues.map((c) => [c.id, c]));
  const sorted = [...input.cues].sort((a, b) => a.rawTime - b.rawTime);
  const recommendations: TransitionRecommendation[] = [];
  for (const rec of input.report.recommendations) {
    const cue = cueById.get(rec.intent.cueId);
    if (!cue) continue;
    const cueIndex = sorted.findIndex((c) => c.id === cue.id);
    const previousCue = cueIndex > 0 ? sorted[cueIndex - 1] : undefined;
    const targets = [rec.primary, ...rec.alternatives].filter(Boolean);
    for (const target of targets) {
      if (!target) continue;
      recommendations.push(
        recommendTransition({
          from: input.currentFormation,
          to: target.formation,
          cue,
          previousCue,
          stage: input.stage,
          constraints: { bpm: input.bpm },
        })
      );
    }
  }
  return {
    analysisVersion: TRANSITION_INTELLIGENCE_VERSION,
    recommendations,
  };
}

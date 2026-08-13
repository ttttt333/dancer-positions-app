/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  analyzeFormationTransition,
  analyzeFormationTransitions,
  filterFeasibleTransitions,
} from "./TransitionAnalyzer";
import { calculateTravelDistance } from "./TravelDistance";
import { calculateRequiredTravelTime, calculateMovementFeasibility } from "./MovementSpeed";
import {
  calculatePushingLimit,
  getPushingLimitAdapterCallCount,
  resetPushingLimitAdapterCalls,
} from "./PushingLimitAdapter";
import { detectFormationCollisions, detectMovementCollisions } from "./CollisionDetector";
import { assignDancersToTargets } from "./AssignmentAdapter";
import { makeMovementTiming, resolveMovementTiming, secondsToBeats } from "./MovementTiming";
import { generateFormationCandidates } from "../formation/FormationCandidateGenerator";
import { generateFormationCues } from "../cue/CueEngine";
import { analyzeMusicStructure } from "../music/MusicStructureAnalyzer";
import { patternCueTimeline } from "../cue/cueFixtures";
import { patternA } from "../music/syntheticPhase1";
import { makeIntent, makeRequest } from "../formation/formationFixtures";
import {
  DEFAULT_STAGE,
  engineFormation,
  lineFormation,
  makeContext,
  makeCue,
  offsetPositions,
} from "./movementFixtures";
import type { FormationCandidate } from "../types/FormationTypes";

function candidateFrom(
  to: ReturnType<typeof engineFormation>,
  id = "c1"
): FormationCandidate {
  return {
    id,
    formation: to,
    templateId: to.type.toLowerCase(),
    intentMatch: 80,
    dancerCountFit: 100,
    stageFit: 80,
    spacingPreview: 80,
    symmetry: to.symmetry,
    complexity: to.complexity,
    stageCoverage: to.stageCoverage,
    visualImpact: to.visualImpact,
    rejected: false,
    rejectionReasons: [],
    metadata: { generatedFromCueId: "cue", generationStrategy: "test" },
  };
}

describe("TransitionAnalyzer", () => {
  it("TEST 01: short movement is feasible", () => {
    const from = lineFormation(6);
    const analysis = analyzeFormationTransition(
      makeContext({ from, to: offsetPositions(from, 12, 0), startTime: 46, endTime: 48 })
    );
    expect(analysis.movementPlan.feasible).toBe(true);
  });

  it("TEST 02: long movement has higher risk", () => {
    const from = lineFormation(4);
    const short = analyzeFormationTransition(
      makeContext({ from, to: offsetPositions(from, 20, 0) })
    );
    const far: Record<string, { x: number; y: number }> = {};
    Object.entries(from).forEach(([id, p], i) => {
      far[id] = { x: i < 2 ? 120 : 880, y: p.y };
    });
    const long = analyzeFormationTransition(
      makeContext({ from, to: far, startTime: 47.4, endTime: 48 })
    );
    expect(long.risk).toBeGreaterThan(short.risk);
  });

  it("TEST 03: impossible movement is infeasible", () => {
    const from = { d0: { x: 100, y: 300 } };
    const to = { d0: { x: 900, y: 300 } };
    const analysis = analyzeFormationTransition(
      makeContext({ from, to, startTime: 47.9, endTime: 48, action: "MICRO_SHIFT" })
    );
    expect(analysis.movementPlan.feasible).toBe(false);
    expect(analysis.rejectionReason).toBeTruthy();
  });

  it("TEST 04: distance within pushing limit passes", () => {
    const from = lineFormation(4);
    const ctx = makeContext({ from, to: offsetPositions(from, 18, 0) });
    const limit = calculatePushingLimit(ctx, ctx.timing, "d0");
    const d = calculateTravelDistance(from.d0!, ctx.nextFormation.positions.d0!);
    expect(d).toBeLessThanOrEqual(limit);
    expect(analyzeFormationTransition(ctx).movementPlan.feasible).toBe(true);
  });

  it("TEST 05: hard pushing violation is rejected", () => {
    const from = { d0: { x: 90, y: 300 } };
    const to = { d0: { x: 910, y: 300 } };
    const analysis = analyzeFormationTransition(
      makeContext({ from, to, startTime: 47.85, endTime: 48, action: "HOLD" })
    );
    expect(analysis.movementPlan.feasible).toBe(false);
    expect(analysis.movementPlan.pushingLimitViolation || analysis.rejectionReason).toBeTruthy();
  });

  it("TEST 06: 5% over limit is a soft warning", () => {
    const feas = calculateMovementFeasibility({
      distance: 105,
      pushingLimit: 100,
      requiredSeconds: 1,
      timing: makeMovementTiming(0, 2, 120),
      softRatio: 1.05,
    });
    expect(feas.softViolation).toBe(true);
    expect(feas.hardViolation).toBe(false);
  });

  it("TEST 07: path inside stage passes", () => {
    const from = lineFormation(4);
    const analysis = analyzeFormationTransition(
      makeContext({ from, to: offsetPositions(from, 10, 8) })
    );
    expect(analysis.movementPlan.stageBoundaryViolation).toBe(false);
    expect(analysis.movementPlan.feasible).toBe(true);
  });

  it("TEST 08: outside stage is rejected", () => {
    const from = { d0: { x: 200, y: 300 } };
    const to = { d0: { x: -40, y: 300 } };
    const analysis = analyzeFormationTransition(makeContext({ from, to }));
    expect(analysis.movementPlan.feasible).toBe(false);
    expect(analysis.rejectionReason).toBe("STAGE_OUTSIDE");
  });

  it("TEST 09: safe margin breach is warned", () => {
    const from = { d0: { x: 200, y: 300 } };
    const to = { d0: { x: 40, y: 300 } };
    const analysis = analyzeFormationTransition(makeContext({ from, to }));
    expect(analysis.warnings.some((w) => w.startsWith("SAFE_MARGIN"))).toBe(true);
  });

  it("TEST 10: static collision is rejected", () => {
    const from = { d0: { x: 300, y: 300 }, d1: { x: 500, y: 300 } };
    const to = { d0: { x: 400, y: 300 }, d1: { x: 405, y: 300 } };
    const analysis = analyzeFormationTransition(makeContext({ from, to }));
    expect(analysis.movementPlan.feasible).toBe(false);
    expect(analysis.rejectionReason).toBe("STATIC_COLLISION");
  });

  it("TEST 11: no static collision passes", () => {
    const from = lineFormation(4);
    expect(
      detectFormationCollisions(from, DEFAULT_STAGE.minDancerDistance).hasCollision
    ).toBe(false);
    expect(
      analyzeFormationTransition(makeContext({ from, to: offsetPositions(from, 8, 0) }))
        .movementPlan.feasible
    ).toBe(true);
  });

  it("TEST 12: intersecting paths add risk", () => {
    const cross = detectMovementCollisions(
      { a: { x: 100, y: 200 }, b: { x: 400, y: 100 } },
      { a: { x: 400, y: 200 }, b: { x: 100, y: 400 } },
      32,
      16
    );
    expect(cross.pathCrossing || cross.risk > 0).toBe(true);
  });

  it("TEST 13: paths that cross at different times are lower risk", () => {
    const staggered = detectMovementCollisions(
      { a: { x: 80, y: 300 }, b: { x: 200, y: 120 } },
      { a: { x: 800, y: 300 }, b: { x: 200, y: 480 } },
      32,
      24
    );
    const same = detectMovementCollisions(
      { a: { x: 80, y: 120 }, b: { x: 800, y: 120 } },
      { a: { x: 800, y: 480 }, b: { x: 80, y: 480 } },
      32,
      24
    );
    expect(staggered.risk).toBeLessThanOrEqual(same.risk);
    expect(staggered.sameTimeCrossing).toBe(false);
  });

  it("TEST 14: same-time crossing is high risk", () => {
    const same = detectMovementCollisions(
      { a: { x: 80, y: 120 }, b: { x: 800, y: 120 } },
      { a: { x: 800, y: 480 }, b: { x: 80, y: 480 } },
      32,
      24
    );
    expect(same.sameTimeCrossing).toBe(true);
    expect(same.risk).toBeGreaterThan(20);
  });

  it("TEST 15: parallel movement is low risk", () => {
    const par = detectMovementCollisions(
      { a: { x: 120, y: 220 }, b: { x: 120, y: 380 } },
      { a: { x: 700, y: 220 }, b: { x: 700, y: 380 } },
      32,
      16
    );
    expect(par.sameTimeCrossing).toBe(false);
    expect(par.risk).toBeLessThan(25);
  });

  it("TEST 16: convergence toward center raises risk", () => {
    const from = lineFormation(8);
    const to: Record<string, { x: number; y: number }> = {};
    for (const id of Object.keys(from)) {
      to[id] = { x: 500 + (from[id]!.x - 500) * 0.15, y: 300 };
    }
    const analysis = analyzeFormationTransition(
      makeContext({ from, to, action: "CENTER", toType: "CENTER" })
    );
    expect(analysis.warnings).toContain("CONVERGENCE");
    expect(analysis.risk).toBeGreaterThan(15);
  });

  it("TEST 17: good spacing scores high", () => {
    const from = lineFormation(6);
    const analysis = analyzeFormationTransition(
      makeContext({ from, to: offsetPositions(from, 10, 0) })
    );
    expect(analysis.transitionScore).toBeGreaterThan(70);
  });

  it("TEST 18: near spacing is penalized", () => {
    const from = { d0: { x: 300, y: 300 }, d1: { x: 500, y: 300 } };
    const tight = analyzeFormationTransition(
      makeContext({ from, to: { d0: { x: 400, y: 300 }, d1: { x: 436, y: 300 } } })
    );
    const wide = analyzeFormationTransition(
      makeContext({ from, to: { d0: { x: 300, y: 300 }, d1: { x: 620, y: 300 } } })
    );
    expect(tight.transitionScore).toBeLessThan(wide.transitionScore);
  });

  it("TEST 19: LARGE cue allows more movement than SMALL", () => {
    const from = { d0: { x: 200, y: 300 } };
    const to = { d0: { x: 520, y: 300 } };
    const large = analyzeFormationTransition(
      makeContext({
        from,
        to,
        cue: makeCue("EXPAND", "LARGE", { rawTime: 48 }),
      })
    );
    const small = analyzeFormationTransition(
      makeContext({
        from,
        to,
        cue: makeCue("EXPAND", "SMALL", { rawTime: 48 }),
        action: "EXPAND",
      })
    );
    expect(large.movementPlan.movements[0]!.pushingLimit).toBeGreaterThan(
      small.movementPlan.movements[0]!.pushingLimit
    );
  });

  it("TEST 20: SMALL cue tightens constraints", () => {
    const from = { d0: { x: 120, y: 300 } };
    const to = { d0: { x: 780, y: 300 } };
    const small = analyzeFormationTransition(
      makeContext({
        from,
        to,
        startTime: 47.5,
        endTime: 48,
        cue: makeCue("MICRO_SHIFT", "SMALL", { rawTime: 48 }),
        action: "MICRO_SHIFT",
      })
    );
    expect(small.movementPlan.feasible).toBe(false);
  });

  it("TEST 21: EXPAND prefers outward travel", () => {
    const from = lineFormation(6);
    const out: Record<string, { x: number; y: number }> = {};
    const inn: Record<string, { x: number; y: number }> = {};
    for (const [id, p] of Object.entries(from)) {
      out[id] = { x: 500 + (p.x - 500) * 1.15, y: p.y };
      inn[id] = { x: 500 + (p.x - 500) * 0.4, y: p.y };
    }
    const expand = analyzeFormationTransition(
      makeContext({ from, to: out, action: "EXPAND", toType: "WIDE_V" })
    );
    const contract = analyzeFormationTransition(
      makeContext({ from, to: inn, action: "EXPAND", toType: "CLUSTER" })
    );
    expect(expand.transitionScore).toBeGreaterThan(contract.transitionScore);
  });

  it("TEST 22: CONTRACT prefers inward travel", () => {
    const from = lineFormation(6);
    const out: Record<string, { x: number; y: number }> = {};
    const inn: Record<string, { x: number; y: number }> = {};
    for (const [id, p] of Object.entries(from)) {
      out[id] = { x: 500 + (p.x - 500) * 1.12, y: p.y };
      inn[id] = { x: 500 + (p.x - 500) * 0.88, y: p.y };
    }
    const expand = analyzeFormationTransition(
      makeContext({ from, to: out, action: "CONTRACT" })
    );
    const contract = analyzeFormationTransition(
      makeContext({ from, to: inn, action: "CONTRACT", toType: "CLUSTER" })
    );
    expect(contract.transitionScore).toBeGreaterThan(expand.transitionScore);
  });

  it("TEST 23: SPLIT prefers groups moving apart", () => {
    const from = lineFormation(8);
    const split: Record<string, { x: number; y: number }> = {};
    const merge: Record<string, { x: number; y: number }> = {};
    Object.entries(from).forEach(([id, p], i) => {
      split[id] = { x: i < 4 ? 200 : 800, y: p.y };
      merge[id] = { x: 480 + (i - 3.5) * 8, y: p.y };
    });
    const a = analyzeFormationTransition(
      makeContext({ from, to: split, action: "SPLIT", toType: "SPLIT" })
    );
    const b = analyzeFormationTransition(
      makeContext({ from, to: merge, action: "SPLIT", toType: "CLUSTER" })
    );
    expect(a.transitionScore).toBeGreaterThan(b.transitionScore);
  });

  it("TEST 24: MERGE prefers groups coming together", () => {
    const from: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < 8; i += 1) {
      from[`d${i}`] = { x: i < 4 ? 260 : 740, y: 220 + (i % 4) * 50 };
    }
    const together: Record<string, { x: number; y: number }> = {};
    const farther: Record<string, { x: number; y: number }> = {};
    Object.entries(from).forEach(([id, p], i) => {
      together[id] = { x: i < 4 ? 360 : 640, y: p.y };
      farther[id] = { x: i < 4 ? 160 : 840, y: p.y };
    });
    const a = analyzeFormationTransition(
      makeContext({ from, to: together, action: "MERGE", toType: "DIAMOND" })
    );
    const b = analyzeFormationTransition(
      makeContext({ from, to: farther, action: "MERGE", toType: "SPLIT" })
    );
    expect(a.transitionScore).toBeGreaterThan(b.transitionScore);
  });

  it("TEST 25: CENTER scores convergence", () => {
    const from = lineFormation(8);
    const to: Record<string, { x: number; y: number }> = {};
    Object.entries(from).forEach(([id], i) => {
      to[id] = { x: 500 + (i - 3.5) * 18, y: 300 };
    });
    const analysis = analyzeFormationTransition(
      makeContext({ from, to, action: "CENTER", toType: "CENTER" })
    );
    expect(analysis.warnings).toContain("CONVERGENCE");
  });

  it("TEST 26: MAIN dancer is preferred for the center target", () => {
    const assigned = assignDancersToTargets(
      [
        { id: "main", from: { x: 400, y: 300 }, role: "MAIN" },
        { id: "sup", from: { x: 500, y: 300 }, role: "DEFAULT" },
      ],
      [
        { to: { x: 500, y: 300 }, visualWeight: 1.7, role: "CENTER" },
        { to: { x: 220, y: 300 }, visualWeight: 1, role: "WING" },
      ]
    );
    expect(assigned.main).toEqual({ x: 500, y: 300 });
  });

  it("TEST 27: analysis is deterministic", () => {
    const from = lineFormation(8);
    const ctx = makeContext({ from, to: offsetPositions(from, 14, 6) });
    const a = analyzeFormationTransition(ctx);
    const b = analyzeFormationTransition(ctx);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("TEST 28: 20 dancers do not crash", () => {
    const from = lineFormation(20);
    const analysis = analyzeFormationTransition(
      makeContext({ from, to: offsetPositions(from, 10, 0) })
    );
    expect(analysis.movementPlan.movements).toHaveLength(20);
    expect(Number.isFinite(analysis.transitionScore)).toBe(true);
  });

  it("TEST 29: 30 dancers do not crash", () => {
    const from = lineFormation(30);
    const analysis = analyzeFormationTransition(
      makeContext({ from, to: offsetPositions(from, 8, 0) })
    );
    expect(analysis.movementPlan.movements).toHaveLength(30);
  });

  it("TEST 30: no NaN metrics", () => {
    const from = lineFormation(10);
    const analysis = analyzeFormationTransition(
      makeContext({ from, to: offsetPositions(from, 16, 4) })
    );
    expect(Number.isNaN(analysis.risk)).toBe(false);
    expect(Number.isNaN(analysis.transitionScore)).toBe(false);
  });

  it("TEST 31: no Infinity metrics", () => {
    const from = lineFormation(8);
    const analysis = analyzeFormationTransition(
      makeContext({ from, to: offsetPositions(from, 12, 0) })
    );
    expect(Number.isFinite(analysis.risk)).toBe(true);
    expect(Number.isFinite(analysis.transitionScore)).toBe(true);
  });

  it("TEST 32: impossible candidates are filtered", () => {
    const from = lineFormation(4);
    const ok = candidateFrom(engineFormation(offsetPositions(from, 10, 0), "LINE"), "ok");
    const bad = candidateFrom(
      engineFormation({
        d0: { x: -20, y: 300 },
        d1: { x: 200, y: 300 },
        d2: { x: 400, y: 300 },
        d3: { x: 600, y: 300 },
      }, "CUSTOM"),
      "bad"
    );
    const ctx = makeContext({ from, to: from });
    const analyses = analyzeFormationTransitions(ctx, [ok, bad]);
    expect(filterFeasibleTransitions(analyses).every((a) => a.candidateId !== "bad")).toBe(true);
    expect(analyses.find((a) => a.candidateId === "bad")?.movementPlan.feasible).toBe(false);
  });

  it("TEST 33: safe candidate ranks above risky", () => {
    const from = lineFormation(4);
    const safe = candidateFrom(engineFormation(offsetPositions(from, 8, 0), "LINE"), "safe");
    const swap = candidateFrom(
      engineFormation({
        d0: { x: from.d3!.x, y: from.d0!.y },
        d1: { x: from.d2!.x, y: from.d1!.y },
        d2: { x: from.d1!.x, y: from.d2!.y },
        d3: { x: from.d0!.x, y: from.d3!.y },
      }, "CUSTOM"),
      "risky"
    );
    const ranked = analyzeFormationTransitions(makeContext({ from, to: from }), [swap, safe]);
    expect(ranked[0]!.candidateId).toBe("safe");
  });

  it("TEST 34: anticipation time increases feasibility", () => {
    const from = { d0: { x: 200, y: 300 } };
    const to = { d0: { x: 640, y: 300 } };
    const short = analyzeFormationTransition(
      makeContext({ from, to, startTime: 47.6, endTime: 48 })
    );
    const prep = analyzeFormationTransition(
      makeContext({ from, to, startTime: 46, endTime: 48 })
    );
    expect(prep.transitionScore).toBeGreaterThan(short.transitionScore);
  });

  it("TEST 35: no anticipation short window is penalized", () => {
    const from = { d0: { x: 180, y: 300 } };
    const to = { d0: { x: 700, y: 300 } };
    const analysis = analyzeFormationTransition(
      makeContext({ from, to, startTime: 47.7, endTime: 48 })
    );
    expect(analysis.risk).toBeGreaterThan(20);
  });

  it("TEST 36: available beats match BPM conversion", () => {
    const timing = makeMovementTiming(46, 48, 120);
    expect(timing.availableSeconds).toBeCloseTo(2, 5);
    expect(timing.availableBeats).toBeCloseTo(4, 5);
    expect(secondsToBeats(2, 120)).toBeCloseTo(4, 5);
  });

  it("TEST 37: BPM change recalculates timing", () => {
    const a = resolveMovementTiming({
      cue: makeCue("EXPAND", "LARGE", { rawTime: 48 }),
      previousCue: makeCue("HOLD", "NONE", { rawTime: 46 }),
      bpm: 120,
    });
    const b = resolveMovementTiming({
      cue: makeCue("EXPAND", "LARGE", { rawTime: 48 }),
      previousCue: makeCue("HOLD", "NONE", { rawTime: 46 }),
      bpm: 60,
    });
    expect(a.availableBeats).toBeCloseTo(4, 5);
    expect(b.availableBeats).toBeCloseTo(2, 5);
  });

  it("TEST 38: scaled stages keep equivalent feasibility", () => {
    const a = analyzeFormationTransition(
      makeContext({
        from: { d0: { x: 200, y: 300 }, d1: { x: 400, y: 300 } },
        to: { d0: { x: 260, y: 300 }, d1: { x: 460, y: 300 } },
        stage: { width: 1000, depth: 600, safeMargin: 80, minDancerDistance: 32 },
      })
    );
    const b = analyzeFormationTransition(
      makeContext({
        from: { d0: { x: 400, y: 600 }, d1: { x: 800, y: 600 } },
        to: { d0: { x: 520, y: 600 }, d1: { x: 920, y: 600 } },
        stage: { width: 2000, depth: 1200, safeMargin: 160, minDancerDistance: 64 },
      })
    );
    expect(a.movementPlan.feasible).toBe(b.movementPlan.feasible);
  });

  it("TEST 39: pushing-limit adapter calls pickFormationPushingLimit", () => {
    resetPushingLimitAdapterCalls();
    const from = lineFormation(4);
    analyzeFormationTransition(makeContext({ from, to: offsetPositions(from, 12, 0) }));
    expect(getPushingLimitAdapterCallCount()).toBeGreaterThan(0);
  });

  it("TEST 40: currentFormation Record positions are consumed", () => {
    const from = lineFormation(5);
    const analysis = analyzeFormationTransition(
      makeContext({ from, to: offsetPositions(from, 9, 0) })
    );
    expect(analysis.movementPlan.movements.map((m) => m.dancerId).sort()).toEqual(
      Object.keys(from).sort()
    );
  });

  it("TEST 41: LINE to WIDE_V-like spread is realistic", () => {
    const from = lineFormation(8);
    const to: Record<string, { x: number; y: number }> = {};
    Object.entries(from).forEach(([id, p], i) => {
      to[id] = { x: p.x, y: 300 + (i - 3.5) * 12 };
    });
    const analysis = analyzeFormationTransition(
      makeContext({ from, to, action: "EXPAND", toType: "WIDE_V", startTime: 46, endTime: 48 })
    );
    expect(analysis.movementPlan.feasible).toBe(true);
  });

  it("TEST 42: modest pyramid-like reshape can be realistic", () => {
    const from = lineFormation(8);
    const to: Record<string, { x: number; y: number }> = {};
    Object.entries(from).forEach(([id, p], i) => {
      to[id] = { x: p.x, y: 260 + Math.abs(i - 3.5) * 10 };
    });
    const analysis = analyzeFormationTransition(
      makeContext({
        from,
        to,
        action: "MAJOR_CHANGE",
        toType: "PYRAMID",
        startTime: 46,
        endTime: 48,
      })
    );
    expect(analysis.movementPlan.feasible).toBe(true);
  });

  it("TEST 43: fast cluster collapse has high convergence risk", () => {
    const from = lineFormation(10);
    const to: Record<string, { x: number; y: number }> = {};
    Object.keys(from).forEach((id, i) => {
      to[id] = { x: 500 + (i - 4.5) * 6, y: 300 };
    });
    const analysis = analyzeFormationTransition(
      makeContext({
        from,
        to,
        action: "CLUSTER",
        toType: "CLUSTER",
        startTime: 47.5,
        endTime: 48,
      })
    );
    expect(analysis.risk).toBeGreaterThan(25);
  });

  it("TEST 44: full Phase1-5 pipeline yields TransitionAnalysis[]", () => {
    const { phase1, structure } = patternCueTimeline();
    const cues = generateFormationCues(structure, phase1);
    const major = cues.cues.find((c) => Math.abs(c.rawTime - 48) < 0.05)!;
    const current = { id: "line", positions: lineFormation(12) };
    const cands = generateFormationCandidates({
      dancerCount: 12,
      cue: major,
      intent: cues.intents[major.id] ?? makeIntent("MAJOR_CHANGE", ["EXPAND"]),
      stage: DEFAULT_STAGE,
      style: "SHOW",
      currentFormation: current,
    });
    const analyses = analyzeFormationTransitions(
      {
        currentFormation: engineFormation(current.positions, "LINE", "line"),
        nextFormation: cands[0]!.formation,
        cue: major,
        bpm: 120,
        timing: makeMovementTiming(46, 48, 120),
        stage: DEFAULT_STAGE,
      },
      cands
    );
    expect(analyses.length).toBe(cands.length);
    expect(analyses.every((a) => Number.isFinite(a.transitionScore))).toBe(true);
    const viaPatternA = analyzeMusicStructure(patternA());
    expect(viaPatternA.eventClusters.length).toBeGreaterThan(0);
  });

  it("TEST 45: impossible candidate is rejected with an explicit reason", () => {
    const from = lineFormation(4);
    const bad = candidateFrom(
      engineFormation({
        d0: { x: -50, y: 300 },
        d1: { x: 200, y: 300 },
        d2: { x: 400, y: 300 },
        d3: { x: 600, y: 300 },
      }),
      "impossible"
    );
    const [analysis] = analyzeFormationTransitions(makeContext({ from, to: from }), [bad]);
    expect(analysis!.movementPlan.feasible).toBe(false);
    expect(analysis!.rejectionReason).toBe("STAGE_OUTSIDE");
    expect(analysis!.band).toBe("D");
  });
});

describe("Movement helpers", () => {
  it("required travel time grows with distance", () => {
    const a = calculateRequiredTravelTime(40, DEFAULT_STAGE, undefined, "MEDIUM");
    const b = calculateRequiredTravelTime(200, DEFAULT_STAGE, undefined, "MEDIUM");
    expect(b).toBeGreaterThan(a);
  });

  it("anticipation cue wins over previous cue for timing", () => {
    const timing = resolveMovementTiming({
      cue: makeCue("MAJOR_CHANGE", "MAX", { rawTime: 48 }),
      previousCue: makeCue("HOLD", "NONE", { rawTime: 8 }),
      anticipationCue: makeCue("MICRO_SHIFT", "SMALL", {
        rawTime: 46,
        reasonCodes: ["ANTICIPATION"],
      }),
      bpm: 120,
    });
    expect(timing.startTime).toBe(46);
    expect(timing.availableBeats).toBeCloseTo(4, 5);
  });
});

describe("48s LINE → candidates", () => {
  it("does not treat the highest Phase 4 visual score as automatically best", () => {
    const current = lineFormation(12);
    const cands = generateFormationCandidates(
      makeRequest(12, "MAJOR_CHANGE", {
        cue: makeCue("MAJOR_CHANGE", "MAX", { rawTime: 48 }),
        intent: makeIntent("MAJOR_CHANGE", ["EXPAND", "V"]),
        currentFormation: { id: "line", positions: current },
      })
    );
    const analyses = analyzeFormationTransitions(
      {
        currentFormation: engineFormation(current, "LINE"),
        nextFormation: cands[0]!.formation,
        cue: makeCue("MAJOR_CHANGE", "MAX", { rawTime: 48 }),
        bpm: 120,
        timing: makeMovementTiming(47, 48, 120),
        stage: DEFAULT_STAGE,
      },
      cands
    );
    expect(analyses.some((a) => a.movementPlan.feasible)).toBe(true);
    const visualFirst = analyses.find((a) => a.candidateId === cands[0]!.id);
    const bestMove = analyses.find((a) => a.movementPlan.feasible)!;
    if (visualFirst && !visualFirst.movementPlan.feasible) {
      expect(bestMove.candidateId).not.toBe(cands[0]!.id);
    }
  });
});

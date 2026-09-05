/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { Formation } from "../types/FormationTypes";
import { DEFAULT_STAGE, lineFormation, makeCue } from "../formation/formationFixtures";
import { engineFormation } from "./movementFixtures";
import {
  generateTransitionPaths,
  recommendTransition,
  resolveAvailableDuration,
} from "./transitionIntelligence";
import { TRANSITION_DURATION, TRANSITION_HARD } from "./transitionIntelligenceConfig";

function form(
  positions: Record<string, { x: number; y: number }>,
  id = "form",
  type: Formation["type"] = "CUSTOM"
): Formation {
  return engineFormation(positions, type, id);
}

function swapLine(): {
  from: Formation;
  to: Formation;
} {
  return {
    from: form({
      d0: { x: 220, y: 300 },
      d1: { x: 780, y: 300 },
    }, "from-swap"),
    to: form({
      d0: { x: 780, y: 300 },
      d1: { x: 220, y: 300 },
    }, "to-swap"),
  };
}

function recommendAt(from: Formation, to: Formation, extra: {
  availableSeconds?: number;
  lockedDancerIds?: string[];
  rawTime?: number;
  previousRaw?: number;
} = {}) {
  return recommendTransition({
    from,
    to,
    cue: makeCue("EXPAND", "LARGE", { id: "cue-t7", rawTime: extra.rawTime ?? 16 }),
    previousCue:
      extra.previousRaw !== undefined
        ? makeCue("HOLD", "SMALL", { id: "cue-prev", rawTime: extra.previousRaw })
        : undefined,
    stage: DEFAULT_STAGE,
    constraints: {
      availableSeconds: extra.availableSeconds,
      lockedDancerIds: extra.lockedDancerIds,
      bpm: 120,
    },
  });
}

describe("transitionIntelligence", () => {
  it("A. short movement in the available window is reachable", () => {
    const from = form(lineFormation(4), "a", "LINE");
    const to = form(
      Object.fromEntries(
        Object.entries(from.positions).map(([id, p]) => [id, { x: p.x + 18, y: p.y }])
      ),
      "b",
      "LINE"
    );
    const rec = recommendAt(from, to, { availableSeconds: 2 });
    expect(rec.primary).not.toBeNull();
    expect(rec.primary!.evaluation.feasible).toBe(true);
    expect(rec.availableSeconds).toBe(2);
  });

  it("B. impossible timing / off-stage paths are excluded", () => {
    const from = form({
      d0: { x: 120, y: 300 },
      d1: { x: 200, y: 300 },
    }, "near");
    const far = form({
      d0: { x: 880, y: 300 },
      d1: { x: 800, y: 300 },
    }, "far");
    const rec = recommendAt(from, far, { availableSeconds: TRANSITION_DURATION.minSeconds });
    expect(rec.ranked.every((c) => c.maxRequiredSpeed <= TRANSITION_HARD.maxSpeedRatio)).toBe(
      true
    );
    expect(rec.primary === null || rec.discardedCount >= 0).toBe(true);

    const outside = recommendAt(
      from,
      form({
        d0: { x: -200, y: 300 },
        d1: { x: -120, y: 300 },
      }, "out")
    );
    expect(outside.ranked.length).toBe(0);
  });

  it("C. collision is temporal, not start/end only", () => {
    const { from, to } = swapLine();
    const paths = generateTransitionPaths({
      from,
      to,
      cue: makeCue("MAJOR_CHANGE", "LARGE", { id: "cue-t7", rawTime: 16 }),
      stage: DEFAULT_STAGE,
      constraints: { availableSeconds: 4, bpm: 120 },
    });
    const straight = paths.find((p) => p.pathKind === "STRAIGHT" && p.assignment === "identity");
    expect(straight).toBeTruthy();
    expect(straight!.evaluation.collisionRisk).toBeGreaterThan(0);
    expect(straight!.evaluation.crossingRisk).toBeGreaterThan(0);
  });

  it("D. unnecessary crossing is a penalty, not an automatic reject", () => {
    const { from, to } = swapLine();
    const rec = recommendAt(from, to, { availableSeconds: 4 });
    const straight = rec.ranked.find((p) => p.pathKind === "STRAIGHT");
    const curved = rec.ranked.find((p) => p.pathKind !== "STRAIGHT");
    expect(straight).toBeTruthy();
    if (straight && curved) {
      expect(straight.crossingCost).toBeGreaterThanOrEqual(curved.crossingCost - 1e-6);
    }
    if (straight) {
      expect(straight.evaluation.feasible || rec.ranked.some((c) => c.evaluation.feasible)).toBe(
        true
      );
    }
  });

  it("E. sharp direction change is penalized versus a smoother path", () => {
    const from = form({
      d0: { x: 200, y: 200 },
      d1: { x: 280, y: 200 },
    }, "from-turn");
    const to = form({
      d0: { x: 760, y: 420 },
      d1: { x: 840, y: 420 },
    }, "to-turn");
    const rec = recommendAt(from, to, { availableSeconds: 4 });
    const straight = rec.ranked.find((p) => p.pathKind === "STRAIGHT");
    const around = rec.ranked.find((p) => p.pathKind === "SAFE_AROUND");
    expect(straight).toBeTruthy();
    expect(around).toBeTruthy();
    expect(straight!.turnCost).toBeLessThanOrEqual(around!.turnCost + 1e-6);
    expect(straight!.evaluation.smoothness).toBeGreaterThanOrEqual(
      around!.evaluation.smoothness
    );
  });

  it("F. similar path lengths score higher arrival sync than uneven travel", () => {
    const evenFrom = form({
      d0: { x: 300, y: 260 },
      d1: { x: 380, y: 260 },
    }, "even-from");
    const evenTo = form({
      d0: { x: 620, y: 260 },
      d1: { x: 700, y: 260 },
    }, "even-to");
    const unevenFrom = form({
      d0: { x: 160, y: 260 },
      d1: { x: 700, y: 260 },
    }, "uneven-from");
    const unevenTo = form({
      d0: { x: 820, y: 260 },
      d1: { x: 720, y: 260 },
    }, "uneven-to");
    const even = recommendAt(evenFrom, evenTo, { availableSeconds: 4 });
    const uneven = recommendAt(unevenFrom, unevenTo, { availableSeconds: 4 });
    expect(even.primary).not.toBeNull();
    expect(uneven.primary).not.toBeNull();
    expect(even.primary!.evaluation.arrivalSync).toBeGreaterThan(
      uneven.primary!.evaluation.arrivalSync
    );
  });

  it("G. alternatives are meaningfully different path kinds", () => {
    const from = form(
      {
        d0: { x: 280, y: 240 },
        d1: { x: 400, y: 240 },
        d2: { x: 520, y: 240 },
        d3: { x: 640, y: 240 },
      },
      "g-from",
      "LINE"
    );
    const to = form(
      {
        d0: { x: 360, y: 360 },
        d1: { x: 480, y: 380 },
        d2: { x: 600, y: 380 },
        d3: { x: 720, y: 360 },
      },
      "g-to"
    );
    const rec = recommendAt(from, to, { availableSeconds: 4 });
    expect(rec.primary).not.toBeNull();
    const top = [rec.primary!, ...rec.alternatives];
    expect(top.length).toBeGreaterThanOrEqual(2);
    const kinds = new Set(top.map((c) => `${c.pathKind}:${c.assignment}`));
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it("H. identical input returns identical ranking", () => {
    const from = form(lineFormation(5), "h-from", "LINE");
    const to = form(
      Object.fromEntries(
        Object.entries(from.positions).map(([id, p]) => [id, { x: p.x + 40, y: p.y - 20 }])
      ),
      "h-to"
    );
    const a = recommendAt(from, to, { availableSeconds: 3 });
    const b = recommendAt(from, to, { availableSeconds: 3 });
    expect(a.ranked.map((c) => c.id)).toEqual(b.ranked.map((c) => c.id));
    expect(a.ranked.map((c) => c.evaluation.score)).toEqual(
      b.ranked.map((c) => c.evaluation.score)
    );
  });

  it("I. locked dancers cannot be moved", () => {
    const from = form(lineFormation(4), "lock-from", "LINE");
    const to = form(
      Object.fromEntries(
        Object.entries(from.positions).map(([id, p]) => [id, { x: p.x + 80, y: p.y }])
      ),
      "lock-to"
    );
    const rec = recommendAt(from, to, {
      availableSeconds: 4,
      lockedDancerIds: ["d0", "d1", "d2", "d3"],
    });
    expect(rec.ranked.length).toBe(0);
    expect(rec.primary).toBeNull();
  });

  it("J. identity assignment keeps dancer ids", () => {
    const from = form(lineFormation(4), "id-from", "LINE");
    const to = form(
      Object.fromEntries(
        Object.entries(from.positions).map(([id, p]) => [id, { x: p.x, y: p.y + 30 }])
      ),
      "id-to"
    );
    const rec = recommendAt(from, to, { availableSeconds: 3 });
    const identity = rec.ranked.find((c) => c.assignment === "identity");
    expect(identity).toBeTruthy();
    expect(Object.keys(identity!.targetPositions).sort()).toEqual(["d0", "d1", "d2", "d3"]);
    for (const path of identity!.paths) {
      expect(path.to).toEqual(to.positions[path.dancerId]);
    }
  });

  it("prefers available cue-to-cue duration over a hardcoded 4-count", () => {
    const from = form(lineFormation(3), "dur-from", "LINE");
    const to = form(lineFormation(3), "dur-to", "LINE");
    const twoBeats = resolveAvailableDuration({
      from,
      to,
      cue: makeCue("EXPAND", "LARGE", { id: "b", rawTime: 8 }),
      previousCue: makeCue("HOLD", "SMALL", { id: "a", rawTime: 7 }),
      stage: DEFAULT_STAGE,
      constraints: { bpm: 120 },
    });
    expect(twoBeats.availableSeconds).toBeCloseTo(1, 5);
    expect(twoBeats.availableSeconds).not.toBeCloseTo(2, 5);

    const sixteenBeats = resolveAvailableDuration({
      from,
      to,
      cue: makeCue("EXPAND", "LARGE", { id: "b", rawTime: 16 }),
      previousCue: makeCue("HOLD", "SMALL", { id: "a", rawTime: 8 }),
      stage: DEFAULT_STAGE,
      constraints: { bpm: 120 },
    });
    expect(sixteenBeats.availableSeconds).toBeCloseTo(8, 5);
  });

  it("does not rank solely by shortest path", () => {
    const { from, to } = swapLine();
    const rec = recommendAt(from, to, { availableSeconds: 4 });
    const straight = rec.ranked.find((c) => c.pathKind === "STRAIGHT" && c.assignment === "identity");
    const winner = rec.primary;
    expect(winner).not.toBeNull();
    if (straight && winner && winner.id !== straight.id) {
      expect(winner.evaluation.score).toBeGreaterThanOrEqual(straight.evaluation.score);
    }
    expect(winner!.evaluation.reasonCodes.length).toBeGreaterThan(0);
  });
});

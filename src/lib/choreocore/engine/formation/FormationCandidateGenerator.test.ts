/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { generateFormationCandidates } from "./FormationCandidateGenerator";
import { defaultFormationTemplateRegistry } from "./FormationTemplateRegistry";
import { FormationGenerationError } from "../types/FormationTypes";
import { validateFormation } from "./FormationValidator";
import { formationSignature, normalizedSignature } from "./FormationNormalizer";
import { stageToUnit } from "./FormationScaler";
import { generateFormationCues } from "../cue/CueEngine";
import { analyzeMusicStructure } from "../music/MusicStructureAnalyzer";
import { patternCueTimeline } from "../cue/cueFixtures";
import { patternA } from "../music/syntheticPhase1";
import {
  DEFAULT_STAGE,
  lineFormation,
  makeCue,
  makeIntent,
  makeRequest,
} from "./formationFixtures";

function typesOf(dancerCount: number, action: Parameters<typeof makeRequest>[1]) {
  return generateFormationCandidates(makeRequest(dancerCount, action)).map(
    (c) => c.formation.type
  );
}

describe("FormationCandidateGenerator", () => {
  it("TEST 01: 1 dancer includes CENTER", () => {
    const types = typesOf(1, "CENTER");
    expect(types).toContain("CENTER");
  });

  it("TEST 02: 2 dancers include SIDE_BY_SIDE", () => {
    const cands = generateFormationCandidates(makeRequest(2, "LINE"));
    expect(cands.some((c) => c.formation.tags.includes("side-by-side"))).toBe(true);
  });

  it("TEST 03: 3 dancers include TRIANGLE or V", () => {
    const types = typesOf(3, "V");
    expect(types.some((t) => t === "TRIANGLE" || t === "V")).toBe(true);
  });

  it("TEST 04: 4 dancers include DIAMOND", () => {
    expect(typesOf(4, "CONTRACT")).toContain("DIAMOND");
  });

  it("TEST 05: 5 dancers include V or CENTER_WINGS", () => {
    const types = typesOf(5, "V");
    expect(types.some((t) => t === "V" || t === "CENTER_WINGS")).toBe(true);
  });

  it("TEST 06: 8 dancers include WIDE_V", () => {
    expect(typesOf(8, "EXPAND")).toContain("WIDE_V");
  });

  it("TEST 07: 10 dancers include DOUBLE_LINE / V / GRID", () => {
    const types = new Set(typesOf(10, "LINE"));
    expect(
      types.has("DOUBLE_LINE") || types.has("V") || types.has("GRID")
    ).toBe(true);
  });

  it("TEST 08: 12 dancers include CENTER_WINGS", () => {
    expect(typesOf(12, "CENTER")).toContain("CENTER_WINGS");
  });

  it("TEST 09: 20 dancers include PYRAMID / GRID / GROUP", () => {
    const cands = generateFormationCandidates(makeRequest(20, "MAJOR_CHANGE"));
    expect(
      cands.some(
        (c) =>
          c.formation.type === "PYRAMID" ||
          c.formation.type === "GRID" ||
          c.formation.tags.includes("groups") ||
          c.formation.tags.includes("group-based")
      )
    ).toBe(true);
  });

  it("TEST 10: 24 dancers include GROUP_BASED", () => {
    const cands = generateFormationCandidates(makeRequest(24, "SPLIT"));
    expect(
      cands.some(
        (c) =>
          c.metadata.generationStrategy.includes("group-based") ||
          c.formation.tags.includes("group-based")
      )
    ).toBe(true);
  });

  it("TEST 11: EXPAND ranks WIDE_V high", () => {
    const cands = generateFormationCandidates(makeRequest(12, "EXPAND"));
    const idx = cands.findIndex((c) => c.formation.type === "WIDE_V");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(5);
  });

  it("TEST 12: CONTRACT ranks CLUSTER high", () => {
    const cands = generateFormationCandidates(makeRequest(12, "CONTRACT"));
    const idx = cands.findIndex((c) => c.formation.type === "CLUSTER");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(5);
  });

  it("TEST 13: V intent ranks V high", () => {
    const cands = generateFormationCandidates(makeRequest(8, "V"));
    const idx = cands.findIndex((c) => c.formation.type === "V" || c.formation.type === "WIDE_V");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(4);
  });

  it("TEST 14: DIAGONAL intent ranks DIAGONAL high", () => {
    const cands = generateFormationCandidates(makeRequest(10, "DIAGONAL"));
    const idx = cands.findIndex((c) => c.formation.type === "DIAGONAL");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(5);
  });

  it("TEST 15: SPLIT has at least 2 groups", () => {
    const cands = generateFormationCandidates(makeRequest(12, "SPLIT"));
    const split = cands.find((c) => c.formation.type === "SPLIT" || c.formation.type === "CENTER_WINGS");
    expect(split).toBeTruthy();
    expect(split!.metadata.groupCount ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("TEST 16: MERGE is a single coherent group", () => {
    const cands = generateFormationCandidates(makeRequest(10, "MERGE"));
    const top = cands[0];
    expect(top).toBeTruthy();
    expect(["V", "CENTER", "DIAMOND", "CLUSTER"]).toContain(top!.formation.type);
    const xs = Object.values(top!.formation.positions).map((p) => p.x);
    const span = Math.max(...xs) - Math.min(...xs);
    expect(span).toBeLessThan(DEFAULT_STAGE.width * 0.85);
  });

  it("TEST 17: CENTER has central visual weighting", () => {
    const cands = generateFormationCandidates(makeRequest(12, "CENTER"));
    const center = cands.find((c) => c.formation.type === "CENTER" || c.formation.type === "CENTER_WINGS");
    expect(center).toBeTruthy();
    const hier = center!.formation.visualHierarchy ?? {};
    const peakId = Object.entries(hier).sort((a, b) => b[1] - a[1])[0]![0];
    const peak = center!.formation.positions[peakId]!;
    expect(Math.abs(peak.x - DEFAULT_STAGE.width / 2)).toBeLessThan(220);
  });

  it("TEST 18: MAJOR_CHANGE prefers high novelty / coverage", () => {
    const cands = generateFormationCandidates(
      makeRequest(12, "MAJOR_CHANGE", { cue: makeCue("MAJOR_CHANGE", "MAX") })
    );
    expect(cands[0]!.formation.stageCoverage).toBeGreaterThan(35);
    expect(["WIDE_V", "PYRAMID", "SPLIT", "CENTER_WINGS", "DOUBLE_DIAGONAL", "ARC"]).toContain(
      cands[0]!.formation.type
    );
  });

  it("TEST 19: Magnitude SMALL keeps spatial variation modest", () => {
    const small = generateFormationCandidates(
      makeRequest(12, "EXPAND", { cue: makeCue("EXPAND", "SMALL") })
    );
    const large = generateFormationCandidates(
      makeRequest(12, "EXPAND", { cue: makeCue("EXPAND", "MAX") })
    );
    const span = (cands: typeof small) => {
      const wide = cands.find((c) => c.formation.type === "WIDE_V") ?? cands[0]!;
      const xs = Object.values(wide.formation.positions).map((p) => p.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(span(small)).toBeLessThan(span(large));
  });

  it("TEST 20: Magnitude MAX includes a high coverage candidate", () => {
    const cands = generateFormationCandidates(
      makeRequest(12, "EXPAND", { cue: makeCue("EXPAND", "MAX") })
    );
    expect(Math.max(...cands.map((c) => c.formation.stageCoverage))).toBeGreaterThan(55);
  });

  it("TEST 21: stage scaling preserves normalized geometry", () => {
    const a = generateFormationCandidates(makeRequest(8, "V"));
    const b = generateFormationCandidates(
      makeRequest(8, "V", {
        stage: { width: 2000, depth: 1200, safeMargin: 160, minDancerDistance: 64 },
      })
    );
    const va = a.find((c) => c.templateId === "v-back") ?? a[0]!;
    const vb = b.find((c) => c.templateId === va.templateId) ?? b[0]!;
    const unitsA = Object.values(va.formation.positions)
      .map((p) => stageToUnit(p, DEFAULT_STAGE))
      .sort((p, q) => p.x - q.x || p.y - q.y);
    const unitsB = Object.values(vb.formation.positions)
      .map((p) =>
        stageToUnit(p, { width: 2000, depth: 1200, safeMargin: 160, minDancerDistance: 64 })
      )
      .sort((p, q) => p.x - q.x || p.y - q.y);
    expect(unitsA.length).toBe(unitsB.length);
    for (let i = 0; i < unitsA.length; i += 1) {
      expect(unitsA[i]!.x).toBeCloseTo(unitsB[i]!.x, 2);
      expect(unitsA[i]!.y).toBeCloseTo(unitsB[i]!.y, 2);
    }
  });

  it("TEST 22: no point outside safe margin", () => {
    const cands = generateFormationCandidates(makeRequest(12, "EXPAND"));
    for (const c of cands) {
      for (const p of Object.values(c.formation.positions)) {
        expect(p.x).toBeGreaterThanOrEqual(DEFAULT_STAGE.safeMargin - 1e-6);
        expect(p.x).toBeLessThanOrEqual(DEFAULT_STAGE.width - DEFAULT_STAGE.safeMargin + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(DEFAULT_STAGE.safeMargin - 1e-6);
        expect(p.y).toBeLessThanOrEqual(DEFAULT_STAGE.depth - DEFAULT_STAGE.safeMargin + 1e-6);
      }
    }
  });

  it("TEST 23: no static collision among accepted candidates", () => {
    const cands = generateFormationCandidates(makeRequest(12, "EXPAND"));
    for (const c of cands) {
      expect(c.rejectionReasons).not.toContain("MIN_SPACING");
      const pts = Object.values(c.formation.positions);
      for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 1; j < pts.length; j += 1) {
          expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThanOrEqual(
            DEFAULT_STAGE.minDancerDistance - 1e-4
          );
        }
      }
    }
  });

  it("TEST 24: invalid stage throws", () => {
    expect(() =>
      generateFormationCandidates(
        makeRequest(8, "EXPAND", { stage: { ...DEFAULT_STAGE, width: 0 } })
      )
    ).toThrow(FormationGenerationError);
  });

  it("TEST 25: dancer count mismatch is rejected", () => {
    const [cand] = generateFormationCandidates(makeRequest(8, "V"));
    const bad = {
      ...cand!.formation,
      positions: { d0: { x: 500, y: 300 } },
    };
    expect(validateFormation(bad, 8, DEFAULT_STAGE)).toContain("DANCER_COUNT_MISMATCH");
  });

  it("TEST 26: duplicate candidates are removed", () => {
    const cands = generateFormationCandidates(makeRequest(12, "EXPAND"));
    const sigs = cands.map((c) => c.metadata.signature);
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it("TEST 27: current formation + HOLD ranks current high", () => {
    const current = { id: "cur", positions: lineFormation(8) };
    const cands = generateFormationCandidates(
      makeRequest(8, "HOLD", {
        cue: makeCue("HOLD", "NONE"),
        currentFormation: current,
      })
    );
    expect(cands[0]!.templateId === "current" || cands[0]!.formation.tags.includes("current")).toBe(
      true
    );
  });

  it("TEST 28: current formation + MAJOR penalizes the same shape", () => {
    const current = { id: "cur", positions: lineFormation(8) };
    const cands = generateFormationCandidates(
      makeRequest(8, "MAJOR_CHANGE", {
        cue: makeCue("MAJOR_CHANGE", "MAX"),
        currentFormation: current,
      })
    );
    const currentIdx = cands.findIndex((c) => c.templateId === "current");
    if (currentIdx >= 0) expect(currentIdx).toBeGreaterThan(1);
    expect(cands[0]!.templateId).not.toBe("current");
  });

  it("TEST 29: determinism", () => {
    const req = makeRequest(12, "EXPAND");
    const a = generateFormationCandidates(req);
    const b = generateFormationCandidates(req);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("TEST 30: candidate count stays in bounds", () => {
    const cands = generateFormationCandidates(makeRequest(12, "EXPAND"));
    expect(cands.length).toBeGreaterThanOrEqual(5);
    expect(cands.length).toBeLessThanOrEqual(15);
  });

  it("TEST 31: anticipation cue is a valid FormationRequest", () => {
    const cands = generateFormationCandidates(
      makeRequest(10, "MICRO_SHIFT", {
        cue: makeCue("MICRO_SHIFT", "SMALL", { reasonCodes: ["ANTICIPATION"] }),
      })
    );
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.every((c) => Object.keys(c.formation.positions).length === 10)).toBe(true);
  });

  it("TEST 32: prohibited formations are not generated", () => {
    const cands = generateFormationCandidates(
      makeRequest(12, "EXPAND", {
        intent: makeIntent("EXPAND", ["V", "DIAGONAL"], ["CLUSTER"]),
      })
    );
    expect(cands.every((c) => c.formation.type !== "CLUSTER")).toBe(true);
  });

  it("TEST 33: extreme aspect ratio still validates", () => {
    const cands = generateFormationCandidates(
      makeRequest(8, "LINE", {
        stage: { width: 1800, depth: 220, safeMargin: 20, minDancerDistance: 20 },
      })
    );
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.every((c) => !c.rejected)).toBe(true);
  });

  it("TEST 34: single-row stage keeps LINE feasible", () => {
    const cands = generateFormationCandidates(
      makeRequest(6, "LINE", {
        stage: { width: 1200, depth: 140, safeMargin: 20, minDancerDistance: 18 },
      })
    );
    expect(cands.some((c) => c.formation.type === "LINE" || c.formation.type === "DOUBLE_LINE")).toBe(
      true
    );
  });

  it("TEST 35: 30 dancers does not crash", () => {
    const cands = generateFormationCandidates(makeRequest(30, "MAJOR_CHANGE"));
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[0]!.formation).toBeTruthy();
  });

  it("TEST 36: no NaN coordinates", () => {
    const cands = generateFormationCandidates(makeRequest(16, "EXPAND"));
    for (const c of cands) {
      for (const p of Object.values(c.formation.positions)) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it("TEST 37: no Infinity scores", () => {
    const cands = generateFormationCandidates(makeRequest(16, "CONTRACT"));
    for (const c of cands) {
      expect(Number.isFinite(c.intentMatch)).toBe(true);
      expect(Number.isFinite(c.stageFit)).toBe(true);
      expect(Number.isFinite(c.metadata.preliminaryScore ?? 0)).toBe(true);
    }
  });

  it("TEST 38: same geometry produces the same signature", () => {
    const [a] = generateFormationCandidates(makeRequest(8, "V"));
    const sig = formationSignature(a!.formation.type, a!.formation.positions);
    expect(sig).toBe(formationSignature(a!.formation.type, { ...a!.formation.positions }));
    expect(
      normalizedSignature(a!.formation.type, a!.formation.positions, DEFAULT_STAGE)
    ).toBe(a!.metadata.signature);
  });

  it("TEST 39: SPLIT can use existing K-Means clustering", () => {
    const leftRight: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < 12; i += 1) {
      leftRight[`d${i}`] = {
        x: i < 6 ? 200 : 800,
        y: 150 + (i % 6) * 50,
      };
    }
    const cands = generateFormationCandidates(
      makeRequest(12, "SPLIT", { currentFormation: { id: "cur", positions: leftRight } })
    );
    expect(
      cands.some(
        (c) =>
          c.metadata.generationStrategy.includes("kmeans") ||
          (c.formation.type === "SPLIT" && (c.metadata.groupCount ?? 0) >= 2)
      )
    ).toBe(true);
  });

  it("TEST 40: full Phase1 → Phase4 pipeline", () => {
    const { phase1, structure } = patternCueTimeline();
    const cues = generateFormationCues(structure, phase1);
    const major = cues.cues.find((c) => c.rawTime === 48 && c.action === "MAJOR_CHANGE");
    expect(major).toBeTruthy();
    const intent = cues.intents[major!.id] ?? makeIntent("MAJOR_CHANGE", ["EXPAND", "V"]);
    const cands = generateFormationCandidates({
      dancerCount: 12,
      cue: major!,
      intent,
      stage: DEFAULT_STAGE,
      style: "SHOW",
    });
    expect(cands.length).toBeGreaterThanOrEqual(5);
    const types = cands.map((c) => c.formation.type);
    expect(types.some((t) => t === "WIDE_V" || t === "DIAGONAL" || t === "CENTER_WINGS" || t === "ARC" || t === "PYRAMID")).toBe(true);

    const phase1b = patternA();
    const structureB = analyzeMusicStructure(phase1b);
    const cuesB = generateFormationCues(structureB, phase1b);
    const req = {
      dancerCount: 8,
      cue: cuesB.cues[0]!,
      intent: cuesB.intents[cuesB.cues[0]!.id] ?? makeIntent(cuesB.cues[0]!.action),
      stage: DEFAULT_STAGE,
    };
    const fromPatternA = generateFormationCandidates(req);
    expect(fromPatternA.length).toBeGreaterThan(0);
  });
});

describe("FormationTemplateRegistry", () => {
  it("lists templates for dancer counts and intents", () => {
    const reg = defaultFormationTemplateRegistry;
    expect(reg.getTemplate("wide-v")).toBeTruthy();
    expect(reg.getTemplatesForDancerCount(12).length).toBeGreaterThan(5);
    expect(reg.getTemplatesForIntent("EXPAND").some((t) => t.type === "WIDE_V")).toBe(true);
    expect(reg.list().map((t) => t.id).sort()).toEqual(
      [...new Set(reg.list().map((t) => t.id))].sort()
    );
  });
});

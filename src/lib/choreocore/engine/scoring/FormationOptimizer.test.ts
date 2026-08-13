/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { scoreFormationCandidate } from "./CandidateScorer";
import { scoreFormationSequence, visualStoryScore, varietyScore } from "./SequenceScore";
import { optimizeFormationSequence } from "./FormationOptimizer";
import { musicFitScore } from "./MusicFitScore";
import { visualImpactScore } from "./VisualImpactScore";
import { feasibilityScore } from "./FeasibilityScore";
import { spacingScore } from "./SpacingScore";
import { symmetryScore } from "./SymmetryScore";
import { complexityScore } from "./ComplexityScore";
import { formationContrast, noveltyScore } from "./NoveltyScore";
import { resolveCandidateWeights } from "./ScoreWeights";
import { FORMATION_SEQUENCE_VERSION } from "../types/ScoringTypes";
import type { FormationType } from "../types/FormationTypes";
import {
  baseInput,
  buildPipelineInput,
  engineFormation,
  lineFormation,
  makeCandidate,
  makeCue,
  makeTransition,
  patternStory80,
  scoringContext,
} from "./scoringFixtures";
import { patternCueA, patternCueB, patternCueC, patternCueTimeline } from "../cue/cueFixtures";
import { makeIntent, DEFAULT_STAGE } from "../formation/formationFixtures";
import { generateFormationCues } from "../cue/CueEngine";

function vForm(type: FormationType, id: string) {
  return engineFormation(lineFormation(8), type, id);
}

describe("FormationOptimizer", () => {
  it("TEST 01: candidate score is finite", () => {
    const cand = makeCandidate("WIDE_V", { intentMatch: 90, stageCoverage: 75, visualImpact: 80 });
    const score = scoreFormationCandidate(scoringContext(), cand, makeTransition(cand.id));
    expect(Number.isFinite(score.totalScore)).toBe(true);
    expect(score.totalScore).toBeGreaterThan(0);
  });

  it("TEST 02: EXPAND + WIDE_V has high music fit", () => {
    const wide = makeCandidate("WIDE_V", { intentMatch: 100, stageCoverage: 78 });
    const cluster = makeCandidate("CLUSTER", { intentMatch: 0, stageCoverage: 18 });
    const ctx = scoringContext({ action: "EXPAND" });
    expect(musicFitScore({ candidate: wide, cue: ctx.cue, intent: ctx.intent })).toBeGreaterThan(
      musicFitScore({ candidate: cluster, cue: ctx.cue, intent: ctx.intent })
    );
    expect(musicFitScore({ candidate: wide, cue: ctx.cue, intent: ctx.intent })).toBeGreaterThan(70);
  });

  it("TEST 03: LOW energy + MAX WIDE_V is penalized", () => {
    const wide = makeCandidate("WIDE_V", { stageCoverage: 88, intentMatch: 100 });
    const compact = makeCandidate("CLUSTER", { stageCoverage: 20, intentMatch: 80 });
    const cue = makeCue("EXPAND", "MAX", { energyBefore: 10, energyAfter: 12, deltaEnergy: 2 });
    const low = musicFitScore({ candidate: wide, cue, intent: makeIntent("EXPAND") });
    const ok = musicFitScore({
      candidate: compact,
      cue: makeCue("CONTRACT", "LARGE", { energyBefore: 18, energyAfter: 12, deltaEnergy: -6 }),
      intent: makeIntent("CONTRACT"),
    });
    expect(low).toBeLessThan(ok);
  });

  it("TEST 04: wide formation on high energy has high visual impact", () => {
    const wide = makeCandidate("WIDE_V", { stageCoverage: 82, visualImpact: 90 });
    const cue = makeCue("MAJOR_CHANGE", "MAX", { energyAfter: 90, energyBefore: 40 });
    expect(visualImpactScore({ candidate: wide, cue })).toBeGreaterThan(70);
  });

  it("TEST 05: A-band transition scores high", () => {
    const cand = makeCandidate("LINE");
    const score = scoreFormationCandidate(
      scoringContext({ action: "HOLD" }),
      cand,
      makeTransition(cand.id, { band: "A", risk: 5, transitionScore: 92 })
    );
    expect(score.transitionQuality).toBeGreaterThan(75);
  });

  it("TEST 06: D candidates are rejected from the sequence", () => {
    const good = makeCandidate("DIAGONAL", { id: "good", positions: lineFormation(8) });
    const bad = makeCandidate("SPLIT", { id: "bad", positions: lineFormation(8) });
    const cue = makeCue("EXPAND", "LARGE", { rawTime: 16, id: "c1" });
    const result = optimizeFormationSequence(
      baseInput({
        cues: [cue],
        candidatesByCue: { [cue.id]: [bad, good] },
        transitionsByCue: {
          [cue.id]: [
            makeTransition("bad", { band: "D", rejectionReason: "HARD_PUSHING_LIMIT" }),
            makeTransition("good", { band: "A", risk: 8, transitionScore: 90 }),
          ],
        },
      })
    );
    expect(result.candidateScores.some((s) => s.candidateId === "bad")).toBe(false);
    expect(result.candidateScores[0]?.candidateId).toBe("good");
  });

  it("TEST 07: good spacing scores high", () => {
    const spaced = engineFormation(lineFormation(6), "LINE");
    expect(spacingScore(spaced, DEFAULT_STAGE)).toBeGreaterThan(70);
  });

  it("TEST 08: CLEAN style weights symmetry more", () => {
    const high = makeCandidate("V", { symmetry: 95, visualImpact: 60, stageCoverage: 50 });
    high.formation.symmetry = 95;
    const low = makeCandidate("V", { id: "asym", symmetry: 30, visualImpact: 60, stageCoverage: 50 });
    low.formation.symmetry = 30;
    const trans = makeTransition("x", { band: "A" });
    const cleanGap =
      scoreFormationCandidate(scoringContext({ style: "CLEAN" }), high, trans).totalScore -
      scoreFormationCandidate(scoringContext({ style: "CLEAN" }), low, trans).totalScore;
    const streetGap =
      scoreFormationCandidate(scoringContext({ style: "STREET" }), high, trans).totalScore -
      scoreFormationCandidate(scoringContext({ style: "STREET" }), low, trans).totalScore;
    expect(cleanGap).toBeGreaterThan(streetGap);
  });

  it("TEST 09: ARTISTIC accepts asymmetry", () => {
    const asym = makeCandidate("ARC", { symmetry: 28, visualImpact: 70, stageCoverage: 55 });
    asym.formation.symmetry = 28;
    const score = scoreFormationCandidate(
      scoringContext({ style: "ARTISTIC" }),
      asym,
      makeTransition(asym.id, { band: "A" })
    );
    expect(score.totalScore).toBeGreaterThan(55);
    expect(symmetryScore(asym.formation, "ARTISTIC")).toBeGreaterThan(50);
  });

  it("TEST 10: high energy / high complexity matches", () => {
    const form = engineFormation(lineFormation(8), "PYRAMID");
    form.complexity = 88;
    const high = complexityScore(form, makeCue("MAJOR_CHANGE", "MAX", { energyAfter: 90 }));
    form.complexity = 12;
    const low = complexityScore(form, makeCue("MAJOR_CHANGE", "MAX", { energyAfter: 90 }));
    expect(high).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(70);
  });

  it("TEST 11: different geometry gets a novelty bonus", () => {
    const from = vForm("LINE", "a");
    expect(noveltyScore(from, vForm("WIDE_V", "b"))).toBeGreaterThan(noveltyScore(from, vForm("LINE", "c")));
  });

  it("TEST 12: V → V is penalized", () => {
    const cand = makeCandidate("V");
    const ctx = scoringContext({
      previousFormations: [vForm("V", "prev")],
      action: "EXPAND",
    });
    const scored = scoreFormationCandidate(ctx, cand, makeTransition(cand.id, { band: "A" }));
    expect(scored.penalties.repetition).toBeGreaterThan(0);
  });

  it("TEST 13: V → V → V has a stronger penalty", () => {
    const cand = makeCandidate("V");
    const once = scoreFormationCandidate(
      scoringContext({ previousFormations: [vForm("V", "p")] }),
      cand,
      makeTransition(cand.id, { band: "A" })
    );
    const thrice = scoreFormationCandidate(
      scoringContext({
        previousFormations: [vForm("V", "a"), vForm("V", "b")],
      }),
      cand,
      makeTransition(cand.id, { band: "A" })
    );
    expect(thrice.penalties.repetition).toBeGreaterThan(once.penalties.repetition);
  });

  it("TEST 14: V → WIDE_V → V is monotonous", () => {
    const cand = makeCandidate("V");
    const scored = scoreFormationCandidate(
      scoringContext({
        previousFormations: [vForm("V", "a"), vForm("WIDE_V", "b")],
      }),
      cand,
      makeTransition(cand.id, { band: "A" })
    );
    expect(scored.penalties.visualMonotony).toBeGreaterThan(0);
  });

  it("TEST 15: V → Cluster is high contrast", () => {
    expect(formationContrast("V", "CLUSTER")).toBeGreaterThan(70);
  });

  it("TEST 16: MAJOR_CHANGE weights visual impact higher", () => {
    const major = resolveCandidateWeights("SHOW", makeCue("MAJOR_CHANGE", "MAX"));
    const hold = resolveCandidateWeights("SHOW", makeCue("HOLD", "NONE"));
    expect(major.visualImpact).toBeGreaterThan(hold.visualImpact);
  });

  it("TEST 17: HOLD keeps the same formation", () => {
    const current = engineFormation(lineFormation(8), "LINE", "current");
    const cue = makeCue("HOLD", "NONE", { rawTime: 8, id: "hold" });
    const result = optimizeFormationSequence(
      baseInput({
        currentFormation: current,
        cues: [cue],
        candidatesByCue: { [cue.id]: [makeCandidate("PYRAMID", { id: "pyr" })] },
        transitionsByCue: {
          [cue.id]: [makeTransition(`hold-${cue.id}-${current.id}`, { band: "A", risk: 0 })],
        },
      })
    );
    expect(result.formations[0]?.type).toBe("LINE");
  });

  it("TEST 18: prep formation improves future transition", () => {
    const prep = makeCandidate("DIAGONAL", { id: "prep", stageCoverage: 48 });
    const hold = makeCandidate("LINE", { id: "stay" });
    const withPrep = scoreFormationCandidate(
      scoringContext({
        cue: makeCue("MICRO_SHIFT", "SMALL", { reasonCodes: ["ANTICIPATION"] }),
        nextCueIsMajor: true,
        nextFeasibleScores: [92],
      }),
      prep,
      makeTransition("prep", { band: "A", transitionScore: 88 })
    );
    const without = scoreFormationCandidate(
      scoringContext({
        cue: makeCue("MICRO_SHIFT", "SMALL", { reasonCodes: ["ANTICIPATION"] }),
        nextCueIsMajor: true,
        nextFeasibleScores: [50],
      }),
      hold,
      makeTransition("stay", { band: "A", transitionScore: 90 })
    );
    expect(withPrep.reasons).toContain("PREPARATION");
    expect(withPrep.totalScore).toBeGreaterThan(without.totalScore);
  });

  it("TEST 19: dead-end candidates are pruned", () => {
    const current = engineFormation(lineFormation(8), "LINE", "current");
    const safe = makeCandidate("LINE", { id: "safe", positions: lineFormation(8) });
    const trapPos: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < 8; i += 1) trapPos[`d${i}`] = { x: 360 + i * 40, y: 300 };
    const trap = makeCandidate("CLUSTER", {
      id: "trap",
      positions: trapPos,
      visualImpact: 95,
      stageCoverage: 12,
    });
    const nextSafe = makeCandidate("LINE", {
      id: "next-line",
      positions: lineFormation(8),
    });
    const cue1 = makeCue("EXPAND", "MEDIUM", { rawTime: 8, id: "c1" });
    const cue2 = makeCue("EXPAND", "MEDIUM", { rawTime: 8.35, id: "c2" });
    const result = optimizeFormationSequence(
      baseInput({
        currentFormation: current,
        cues: [cue1, cue2],
        cueAnalysis: {
          cues: [cue1, cue2],
          intents: { [cue1.id]: makeIntent("EXPAND"), [cue2.id]: makeIntent("EXPAND") },
          suppressedEvents: [],
          confidence: 0.8,
          analysisVersion: "3.0.0-phase3",
        },
        candidatesByCue: {
          [cue1.id]: [trap, safe],
          [cue2.id]: [nextSafe],
        },
        config: { debug: true, beamWidth: 5, lookAhead: 3, minimumCandidateScore: 20 },
      })
    );
    expect(result.debugExclusions.some((e) => e.reason === "DEAD_END" && e.candidateId === "trap")).toBe(
      true
    );
    expect(result.candidateScores.some((s) => s.candidateId === "trap")).toBe(false);
  });

  it("TEST 20: high visual + poor future is a trap", () => {
    const trap = makeCandidate("PYRAMID", { visualImpact: 97, stageCoverage: 80, complexity: 80 });
    trap.formation.visualImpact = 97;
    const scored = scoreFormationCandidate(
      scoringContext({ nextFeasibleScores: [32] }),
      trap,
      makeTransition(trap.id, { band: "A", transitionScore: 85, risk: 12 })
    );
    expect(scored.reasons).toContain("FORMATION_TRAP");
  });

  it("TEST 21: beamWidth 5 keeps at most 5 states", () => {
    const cue = makeCue("EXPAND", "LARGE", { rawTime: 16, id: "c1" });
    const cands = Array.from({ length: 8 }, (_, i) =>
      makeCandidate(i % 2 === 0 ? "DIAGONAL" : "ARC", {
        id: `c${i}`,
        positions: lineFormation(8),
      })
    );
    const result = optimizeFormationSequence(
      baseInput({
        cues: [cue],
        candidatesByCue: { [cue.id]: cands },
        transitionsByCue: {
          [cue.id]: cands.map((c, i) =>
            makeTransition(c.id, { band: "A", risk: 10, transitionScore: 80 + i })
          ),
        },
        config: { beamWidth: 5 },
      })
    );
    expect(result.search.beamWidth).toBe(5);
    expect(result.search.maxBeamSize).toBeLessThanOrEqual(5);
  });

  it("TEST 22: lookAhead 3 is recorded and future cues are scanned", () => {
    const cues = [8, 16, 24, 32].map((t, i) =>
      makeCue("EXPAND", "MEDIUM", { rawTime: t, id: `c${i}` })
    );
    const cand = makeCandidate("DIAGONAL", { id: "d1", positions: lineFormation(8) });
    const result = optimizeFormationSequence(
      baseInput({
        cues,
        cueAnalysis: {
          cues,
          intents: Object.fromEntries(cues.map((c) => [c.id, makeIntent("EXPAND")])),
          suppressedEvents: [],
          confidence: 0.8,
          analysisVersion: "3.0.0-phase3",
        },
        candidatesByCue: Object.fromEntries(cues.map((c) => [c.id, [cand]])),
        config: { lookAhead: 3, beamWidth: 5, minimumCandidateScore: 10 },
      })
    );
    expect(result.search.lookAhead).toBe(3);
    expect(result.search.futureCuesScanned).toBeGreaterThanOrEqual(2);
  });

  it("TEST 23: optimization is deterministic", () => {
    const cue = makeCue("EXPAND", "LARGE", { rawTime: 16, id: "c1" });
    const cands = [
      makeCandidate("WIDE_V", { id: "w", positions: lineFormation(8), stageCoverage: 75 }),
      makeCandidate("DIAGONAL", { id: "d", positions: lineFormation(8), stageCoverage: 55 }),
    ];
    const input = baseInput({
      cues: [cue],
      candidatesByCue: { [cue.id]: cands },
      transitionsByCue: {
        [cue.id]: [
          makeTransition("w", { band: "A", transitionScore: 88 }),
          makeTransition("d", { band: "A", transitionScore: 90 }),
        ],
      },
    });
    const a = optimizeFormationSequence(input);
    const b = optimizeFormationSequence(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("TEST 24: known sequences rank relatively", () => {
    const forms = [vForm("LINE", "a"), vForm("WIDE_V", "b"), vForm("CLUSTER", "c")];
    forms[0]!.stageCoverage = 30;
    forms[1]!.stageCoverage = 75;
    forms[2]!.stageCoverage = 20;
    const scores = forms.map((f, i) =>
      scoreFormationCandidate(
        scoringContext({ previousFormations: forms.slice(0, i) }),
        makeCandidate(f.type, { id: f.id }),
        makeTransition(f.id, { band: "A" })
      )
    );
    const varied = scoreFormationSequence(
      forms,
      scores,
      scores.map((s) => makeTransition(s.candidateId, { band: "A" })),
      {
        cues: forms.map((_, i) => makeCue("EXPAND", "LARGE", { rawTime: i * 8 })),
        sections: [],
      }
    );
    const flatForms = [vForm("V", "1"), vForm("V", "2"), vForm("V", "3")];
    const flatScores = flatForms.map((f) =>
      scoreFormationCandidate(
        scoringContext({ previousFormations: [vForm("V", "p")] }),
        makeCandidate("V", { id: f.id }),
        makeTransition(f.id, { band: "A" })
      )
    );
    const flat = scoreFormationSequence(
      flatForms,
      flatScores,
      flatScores.map((s) => makeTransition(s.candidateId, { band: "A" })),
      { cues: flatForms.map((_, i) => makeCue("EXPAND", "LARGE", { rawTime: i * 8 })), sections: [] }
    );
    expect(varied.totalScore).toBeGreaterThan(flat.totalScore);
  });

  it("TEST 25: small → medium → large has higher visual story", () => {
    const rising = [30, 55, 85].map((c, i) => {
      const f = vForm(i === 2 ? "WIDE_V" : i === 1 ? "V" : "LINE", `r${i}`);
      f.stageCoverage = c;
      return f;
    });
    const flat = [55, 56, 54].map((c, i) => {
      const f = vForm("V", `f${i}`);
      f.stageCoverage = c;
      return f;
    });
    expect(visualStoryScore(rising)).toBeGreaterThan(visualStoryScore(flat));
  });

  it("TEST 26: repeated geometry lowers variety", () => {
    const same = [vForm("V", "1"), vForm("V", "2"), vForm("V", "3")];
    const mixed = [vForm("LINE", "1"), vForm("WIDE_V", "2"), vForm("CLUSTER", "3")];
    const cues = same.map((_, i) => makeCue("EXPAND", "LARGE", { rawTime: i * 8 }));
    expect(varietyScore(mixed, cues)).toBeGreaterThan(varietyScore(same, cues));
  });

  it("TEST 27: all A execution scores high", () => {
    const seq = scoreFormationSequence(
      [vForm("LINE", "a"), vForm("DIAGONAL", "b")],
      [
        scoreFormationCandidate(scoringContext(), makeCandidate("LINE"), makeTransition("a", { band: "A" })),
        scoreFormationCandidate(scoringContext(), makeCandidate("DIAGONAL"), makeTransition("b", { band: "A" })),
      ],
      [makeTransition("a", { band: "A" }), makeTransition("b", { band: "A" })],
      { cues: [makeCue("EXPAND"), makeCue("EXPAND")], sections: [] }
    );
    expect(seq.executionScore).toBeGreaterThan(95);
  });

  it("TEST 28: mixed A/B/C execution is medium", () => {
    const seq = scoreFormationSequence(
      [vForm("LINE", "a"), vForm("DIAGONAL", "b"), vForm("V", "c")],
      [
        scoreFormationCandidate(scoringContext(), makeCandidate("LINE"), makeTransition("a", { band: "A" })),
        scoreFormationCandidate(
          scoringContext(),
          makeCandidate("DIAGONAL"),
          makeTransition("b", { band: "B", risk: 40 })
        ),
        scoreFormationCandidate(scoringContext(), makeCandidate("V"), makeTransition("c", { band: "C", risk: 60 })),
      ],
      [
        makeTransition("a", { band: "A" }),
        makeTransition("b", { band: "B", risk: 40 }),
        makeTransition("c", { band: "C", risk: 60 }),
      ],
      { cues: [makeCue("EXPAND"), makeCue("EXPAND"), makeCue("EXPAND")], sections: [] }
    );
    expect(seq.executionScore).toBeGreaterThan(50);
    expect(seq.executionScore).toBeLessThan(90);
  });

  it("TEST 29: D candidate is excluded", () => {
    expect(feasibilityScore(makeTransition("x", { band: "D" }))).toBe(0);
  });

  it("TEST 30: better future transitions are preferred", () => {
    const cand = makeCandidate("DIAGONAL");
    const good = scoreFormationCandidate(
      scoringContext({ nextFeasibleScores: [93], nextNextFeasibleScores: [88] }),
      cand,
      makeTransition(cand.id, { band: "A" })
    );
    const poor = scoreFormationCandidate(
      scoringContext({ nextFeasibleScores: [40], nextNextFeasibleScores: [30] }),
      cand,
      makeTransition(cand.id, { band: "A" })
    );
    expect(good.futurePotential).toBeGreaterThan(poor.futurePotential);
    expect(good.totalScore).toBeGreaterThan(poor.totalScore);
  });

  it("TEST 31: HOLD leaves the current formation", () => {
    const current = engineFormation(lineFormation(8), "LINE", "current");
    const cue = makeCue("HOLD", "NONE", { rawTime: 4, id: "h" });
    const result = optimizeFormationSequence(
      baseInput({ currentFormation: current, cues: [cue], candidatesByCue: {} })
    );
    expect(result.formations[0]?.type).toBe("LINE");
  });

  it("TEST 32: repeating current on MAJOR_CHANGE is penalized", () => {
    const cand = makeCandidate("LINE");
    const scored = scoreFormationCandidate(
      scoringContext({
        cue: makeCue("MAJOR_CHANGE", "MAX", { energyAfter: 88, energyBefore: 40 }),
        previousFormations: [engineFormation(lineFormation(8), "LINE", "current")],
      }),
      cand,
      makeTransition(cand.id, { band: "A" })
    );
    expect(scored.penalties.repetition).toBeGreaterThan(0);
    expect(scored.novelty).toBeLessThan(40);
  });

  it("TEST 33: POWER emphasizes visual impact", () => {
    expect(resolveCandidateWeights("POWER").visualImpact).toBeGreaterThan(
      resolveCandidateWeights("CLEAN").visualImpact
    );
  });

  it("TEST 34: CLEAN emphasizes symmetry", () => {
    expect(resolveCandidateWeights("CLEAN").symmetry).toBeGreaterThan(
      resolveCandidateWeights("POWER").symmetry
    );
  });

  it("TEST 35: DYNAMIC emphasizes novelty", () => {
    expect(resolveCandidateWeights("DYNAMIC").novelty).toBeGreaterThan(
      resolveCandidateWeights("SHOW").novelty
    );
  });

  it("TEST 36: ARTISTIC downweights symmetry", () => {
    expect(resolveCandidateWeights("ARTISTIC").symmetry).toBeLessThan(
      resolveCandidateWeights("CLEAN").symmetry
    );
  });

  it("TEST 37: STREET emphasizes density/complexity", () => {
    expect(resolveCandidateWeights("STREET").complexity).toBeGreaterThan(
      resolveCandidateWeights("CLEAN").complexity
    );
  });

  it("TEST 38: SHOW emphasizes visual impact and music sync", () => {
    const show = resolveCandidateWeights("SHOW");
    const artistic = resolveCandidateWeights("ARTISTIC");
    expect(show.visualImpact + show.musicFit).toBeGreaterThan(artistic.visualImpact + artistic.musicFit);
  });

  it("TEST 39: A → B → C continuity is rewarded", () => {
    const cand = makeCandidate("DIAGONAL");
    const scored = scoreFormationCandidate(
      scoringContext({
        previousFormations: [vForm("LINE", "a")],
        nextFeasibleScores: [90],
      }),
      cand,
      makeTransition(cand.id, { band: "A", transitionScore: 91, risk: 6 })
    );
    expect(scored.reasons).toContain("CONTINUITY");
  });

  it("TEST 40: a bad middle formation is penalized", () => {
    const cand = makeCandidate("SPLIT", { stageCoverage: 80 });
    const scored = scoreFormationCandidate(
      scoringContext({
        previousFormations: [vForm("LINE", "a")],
        nextFeasibleScores: [40],
      }),
      cand,
      makeTransition(cand.id, { band: "C", risk: 58, transitionScore: 45 })
    );
    expect(scored.reasons).toContain("BAD_MIDDLE");
  });

  it("TEST 41: a large score gap has higher confidence", () => {
    const cue = makeCue("EXPAND", "LARGE", { rawTime: 16, id: "c1" });
    const strong = makeCandidate("WIDE_V", {
      id: "strong",
      stageCoverage: 80,
      visualImpact: 90,
      intentMatch: 100,
    });
    const weak = makeCandidate("CLUSTER", { id: "weak", stageCoverage: 15, visualImpact: 20, intentMatch: 0 });
    const result = optimizeFormationSequence(
      baseInput({
        cues: [cue],
        candidatesByCue: { [cue.id]: [strong, weak] },
        transitionsByCue: {
          [cue.id]: [
            makeTransition("strong", { band: "A", transitionScore: 94, risk: 4 }),
            makeTransition("weak", { band: "A", transitionScore: 70, risk: 20 }),
          ],
        },
        config: { beamWidth: 5 },
      })
    );
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("TEST 42: a close score gap has lower confidence", () => {
    const cue = makeCue("EXPAND", "LARGE", { rawTime: 16, id: "c1" });
    const a = makeCandidate("DIAGONAL", { id: "a", stageCoverage: 55, visualImpact: 70 });
    const b = makeCandidate("ARC", { id: "b", stageCoverage: 56, visualImpact: 71 });
    const close = optimizeFormationSequence(
      baseInput({
        cues: [cue],
        candidatesByCue: { [cue.id]: [a, b] },
        transitionsByCue: {
          [cue.id]: [
            makeTransition("a", { band: "A", transitionScore: 88, risk: 10 }),
            makeTransition("b", { band: "A", transitionScore: 88.2, risk: 10 }),
          ],
        },
      })
    );
    const cue2 = makeCue("EXPAND", "LARGE", { rawTime: 16, id: "c2" });
    const wide = optimizeFormationSequence(
      baseInput({
        cues: [cue2],
        candidatesByCue: {
          [cue2.id]: [
            makeCandidate("WIDE_V", { id: "best", stageCoverage: 82, visualImpact: 92, intentMatch: 100 }),
            makeCandidate("CLUSTER", { id: "worst", stageCoverage: 12, visualImpact: 20, intentMatch: 0 }),
          ],
        },
        transitionsByCue: {
          [cue2.id]: [
            makeTransition("best", { band: "A", transitionScore: 95, risk: 3 }),
            makeTransition("worst", { band: "A", transitionScore: 60, risk: 25 }),
          ],
        },
      })
    );
    expect(wide.confidence).toBeGreaterThan(close.confidence);
  });

  it("TEST 43: 30 dancers do not crash", () => {
    const cue = makeCue("EXPAND", "LARGE", { rawTime: 16, id: "c1" });
    const current = engineFormation(lineFormation(30), "LINE", "current");
    const cand = makeCandidate("LINE", { id: "l30", positions: lineFormation(30), count: 30 });
    const result = optimizeFormationSequence(
      baseInput({
        currentFormation: current,
        cues: [cue],
        candidatesByCue: { [cue.id]: [cand] },
        config: { beamWidth: 3, lookAhead: 2, minimumCandidateScore: 10 },
      })
    );
    expect(result.formations).toHaveLength(1);
    expect(Number.isFinite(result.totalScore)).toBe(true);
  });

  it("TEST 44: a long cue list does not explode memory", () => {
    const cues = Array.from({ length: 16 }, (_, i) =>
      makeCue(i % 5 === 0 ? "HOLD" : "MICRO_SHIFT", "SMALL", { rawTime: 2 + i * 2, id: `c${i}` })
    );
    const cand = makeCandidate("LINE", { id: "line", positions: lineFormation(8) });
    const result = optimizeFormationSequence(
      baseInput({
        cues,
        cueAnalysis: {
          cues,
          intents: Object.fromEntries(cues.map((c) => [c.id, makeIntent(c.action)])),
          suppressedEvents: [],
          confidence: 0.8,
          analysisVersion: "3.0.0-phase3",
        },
        candidatesByCue: Object.fromEntries(cues.map((c) => [c.id, [cand]])),
        config: { beamWidth: 5, lookAhead: 3, minimumCandidateScore: 10 },
      })
    );
    expect(result.search.statesEvaluated).toBeLessThan(5 * 4 * 16);
    expect(result.formations.length).toBeGreaterThan(0);
  });

  it("TEST 45: no NaN metrics", () => {
    const cand = makeCandidate("ARC");
    const score = scoreFormationCandidate(scoringContext(), cand, makeTransition(cand.id));
    expect(Number.isNaN(score.totalScore)).toBe(false);
    expect(Number.isNaN(score.musicFit)).toBe(false);
    expect(Number.isFinite(score.feasibility)).toBe(true);
  });

  it("TEST 46: no Infinity metrics", () => {
    const result = optimizeFormationSequence(
      baseInput({
        cues: [makeCue("HOLD", "NONE", { rawTime: 4, id: "h" })],
        candidatesByCue: {},
      })
    );
    expect(Number.isFinite(result.totalScore)).toBe(true);
    expect(Number.isFinite(result.confidence)).toBe(true);
  });

  it("TEST 47: full Phase 1-6 pipeline yields FormationSequenceResult", () => {
    const { phase1, structure } = patternStory80();
    const input = buildPipelineInput({ phase1, structure, dancerCount: 12, style: "SHOW" });
    const result = optimizeFormationSequence({
      ...input,
      config: { beamWidth: 5, lookAhead: 3, minimumCandidateScore: 40 },
    });
    expect(result.analysisVersion).toBe(FORMATION_SEQUENCE_VERSION);
    expect(result.formations.length).toBe(result.cues.length);
    expect(result.candidateScores.length).toBe(result.cues.length);
    expect(Number.isFinite(result.totalScore)).toBe(true);
    expect(result.search.beamWidth).toBe(5);
  });

  it("TEST 48: Pattern A produces a coherent sequence", () => {
    const { phase1, structure } = patternCueA();
    const input = buildPipelineInput({ phase1, structure, dancerCount: 12 });
    const result = optimizeFormationSequence({
      ...input,
      config: { beamWidth: 5, lookAhead: 3, minimumCandidateScore: 35 },
    });
    expect(result.formations.length).toBeGreaterThan(0);
    expect(result.formations.every((f) => f.positions)).toBe(true);
  });

  it("TEST 49: Pattern B rise → peak → drop prefers expand then contract", () => {
    const { phase1, structure } = patternCueB();
    const input = buildPipelineInput({ phase1, structure, dancerCount: 12 });
    const result = optimizeFormationSequence({
      ...input,
      config: { beamWidth: 5, lookAhead: 3, minimumCandidateScore: 30 },
    });
    expect(result.formations.length).toBeGreaterThan(0);
    const coverages = result.formations.map((f) => f.stageCoverage);
    const first = coverages[0] ?? 0;
    const last = coverages[coverages.length - 1] ?? 0;
    if (coverages.length >= 2) {
      expect(last).toBeLessThanOrEqual(first + 25);
    }
  });

  it("TEST 50: Pattern C does not change formation excessively", () => {
    const { phase1, structure } = patternCueC();
    const input = buildPipelineInput({ phase1, structure, dancerCount: 12 });
    const result = optimizeFormationSequence({
      ...input,
      config: { beamWidth: 5, lookAhead: 3, minimumCandidateScore: 30 },
    });
    const types = result.formations.map((f) => f.type);
    const unique = new Set(types);
    expect(unique.size).toBeLessThanOrEqual(Math.max(4, Math.ceil(types.length * 0.6)));
  });
});

describe("Phase 6 quality trace", () => {
  it("does not pick a cue-local visual winner when the sequence is worse", () => {
    const cue1 = makeCue("MAJOR_CHANGE", "MAX", {
      rawTime: 48,
      id: "major",
      energyAfter: 88,
      energyBefore: 40,
    });
    const cue2 = makeCue("CENTER", "LARGE", { rawTime: 56, id: "center", energyAfter: 70, energyBefore: 80 });
    const pyramid = makeCandidate("PYRAMID", {
      id: "pyr",
      visualImpact: 97,
      stageCoverage: 80,
      intentMatch: 94,
      positions: lineFormation(8),
    });
    pyramid.formation.visualImpact = 97;
    const wide = makeCandidate("WIDE_V", {
      id: "wide",
      visualImpact: 91,
      stageCoverage: 78,
      intentMatch: 100,
      positions: lineFormation(8),
    });
    wide.formation.visualImpact = 91;
    const center = makeCandidate("CENTER", { id: "ctr", positions: lineFormation(8), stageCoverage: 30 });
    const result = optimizeFormationSequence(
      baseInput({
        cues: [cue1, cue2],
        cueAnalysis: {
          cues: [cue1, cue2],
          intents: {
            [cue1.id]: makeIntent("MAJOR_CHANGE", ["EXPAND"]),
            [cue2.id]: makeIntent("CENTER"),
          },
          suppressedEvents: [],
          confidence: 0.9,
          analysisVersion: "3.0.0-phase3",
        },
        candidatesByCue: {
          [cue1.id]: [pyramid, wide],
          [cue2.id]: [center],
        },
        transitionsByCue: {
          [cue1.id]: [
            makeTransition("pyr", { band: "A", transitionScore: 50, risk: 40 }),
            makeTransition("wide", { band: "A", transitionScore: 90, risk: 12 }),
          ],
          [cue2.id]: [makeTransition("ctr", { band: "A", transitionScore: 88, risk: 10 })],
        },
        config: { beamWidth: 5, lookAhead: 3, minimumCandidateScore: 20 },
      })
    );
    expect(result.formations[0]?.type).toBe("WIDE_V");
    const chosen = result.candidateScores[0]!;
    expect(chosen.transitionQuality).toBeGreaterThan(70);
    expect(chosen.reasons.length).toBeGreaterThan(0);
  });

  it("patternCueTimeline still runs through Phase 6", () => {
    const { phase1, structure } = patternCueTimeline();
    const cues = generateFormationCues(structure, phase1);
    expect(cues.cues.length).toBeGreaterThan(0);
    const input = buildPipelineInput({ phase1, structure, dancerCount: 12 });
    const result = optimizeFormationSequence({
      ...input,
      config: { beamWidth: 4, lookAhead: 3, minimumCandidateScore: 35 },
    });
    expect(result.analysisVersion).toBe("3.0.0-phase6");
  });
});

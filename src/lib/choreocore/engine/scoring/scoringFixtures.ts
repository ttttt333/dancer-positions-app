import type { FormationCue, FormationStyle, StageConfig } from "../types/CueTypes";
import type { Formation, FormationCandidate, FormationType } from "../types/FormationTypes";
import type { TransitionAnalysis } from "../types/MovementTypes";
import type {
  CandidateScoringContext,
  FormationOptimizationInput,
} from "../types/ScoringTypes";
import { DEFAULT_STAGE, lineFormation, makeCue, makeIntent } from "../formation/formationFixtures";
import { engineFormation } from "../movement/movementFixtures";
import { makePhase1, makeStructure, makeCluster, section } from "../cue/cueFixtures";
import { generateFormationCues } from "../cue/CueEngine";
import { generateFormationCandidates } from "../formation/FormationCandidateGenerator";
import { createSyntheticPhase1Analysis } from "../music/syntheticPhase1";

export { DEFAULT_STAGE, lineFormation, makeCue, engineFormation };

export function makeCandidate(
  type: FormationType,
  extra: Partial<FormationCandidate> & { positions?: Formation["positions"]; count?: number } = {}
): FormationCandidate {
  const count = extra.count ?? 8;
  const positions = extra.positions ?? extra.formation?.positions ?? lineFormation(count);
  const formationBase =
    extra.formation ?? engineFormation(positions, type, extra.id ?? `form-${type}`);
  const formation: Formation = {
    ...formationBase,
    type,
    complexity: extra.complexity ?? formationBase.complexity,
    symmetry: extra.symmetry ?? formationBase.symmetry,
    stageCoverage: extra.stageCoverage ?? formationBase.stageCoverage,
    visualImpact: extra.visualImpact ?? formationBase.visualImpact,
  };
  return {
    id: extra.id ?? `cand-${type}`,
    formation: { ...formation, type, complexity: extra.complexity ?? formation.complexity },
    templateId: extra.templateId ?? type.toLowerCase(),
    intentMatch: extra.intentMatch ?? 80,
    dancerCountFit: extra.dancerCountFit ?? 100,
    stageFit: extra.stageFit ?? 80,
    spacingPreview: extra.spacingPreview ?? 80,
    symmetry: extra.symmetry ?? 80,
    complexity: extra.complexity ?? 40,
    stageCoverage: extra.stageCoverage ?? 50,
    visualImpact: extra.visualImpact ?? 60,
    rejected: extra.rejected ?? false,
    rejectionReasons: extra.rejectionReasons ?? [],
    metadata: extra.metadata ?? {
      generatedFromCueId: "cue",
      generationStrategy: "test",
    },
  };
}

export function makeTransition(
  candidateId: string,
  extra: Partial<TransitionAnalysis> = {}
): TransitionAnalysis {
  const feasible = extra.movementPlan?.feasible ?? extra.band !== "D";
  const band = extra.band ?? (feasible ? "A" : "D");
  const risk = extra.risk ?? (band === "A" ? 8 : band === "B" ? 35 : band === "C" ? 55 : 80);
  return {
    candidateId,
    movementPlan: extra.movementPlan ?? {
      movements: [],
      totalDistance: 40,
      maxDistance: 50,
      averageDistance: 40,
      collision: { hasCollision: false, collisionPairs: [], risk: 0 },
      stageBoundaryViolation: false,
      pushingLimitViolation: false,
      feasible,
      risk,
      score: extra.transitionScore ?? (feasible ? 88 : 20),
    },
    feasibility: extra.feasibility ?? (feasible ? 100 : 0),
    risk,
    transitionScore: extra.transitionScore ?? (feasible ? 88 : 20),
    rejectionReason: extra.rejectionReason,
    warnings: extra.warnings ?? [],
    band,
  };
}

export function scoringContext(
  extra: Partial<CandidateScoringContext> & { action?: FormationCue["action"] } = {}
): CandidateScoringContext {
  const cue =
    extra.cue ??
    makeCue(extra.action ?? "EXPAND", "LARGE", {
      energyBefore: 40,
      energyAfter: 70,
      deltaEnergy: 30,
    });
  const current = extra.currentFormation ?? engineFormation(lineFormation(8), "LINE", "current");
  return {
    cue,
    intent: extra.intent ?? makeIntent(cue.action),
    currentFormation: current,
    previousFormations: extra.previousFormations ?? [current],
    stage: extra.stage ?? DEFAULT_STAGE,
    style: extra.style ?? "SHOW",
    section: extra.section,
    phrase: extra.phrase,
    nextCue: extra.nextCue,
    nextCueIsMajor: extra.nextCueIsMajor,
    nextFeasibleScores: extra.nextFeasibleScores,
    nextNextFeasibleScores: extra.nextNextFeasibleScores,
    weights: extra.weights,
    config: extra.config,
  };
}

export function emptyCueAnalysis(cues: FormationCue[], styleIntents?: FormationOptimizationInput["cueAnalysis"]["intents"]) {
  return {
    cues,
    intents: styleIntents ?? Object.fromEntries(cues.map((c) => [c.id, makeIntent(c.action)])),
    suppressedEvents: [],
    confidence: 0.85,
    analysisVersion: "3.0.0-phase3",
  };
}

export function baseInput(
  extra: Partial<FormationOptimizationInput> & { cues?: FormationCue[] } = {}
): FormationOptimizationInput {
  const cues = extra.cues ?? [makeCue("EXPAND", "LARGE", { rawTime: 16, id: "c1" })];
  return {
    phase1: extra.phase1 ?? makePhase1(80),
    musicStructure: extra.musicStructure ?? makeStructure([]),
    cueAnalysis: extra.cueAnalysis ?? emptyCueAnalysis(cues),
    candidatesByCue: extra.candidatesByCue ?? {},
    transitionsByCue: extra.transitionsByCue ?? {},
    currentFormation:
      extra.currentFormation ?? engineFormation(lineFormation(8), "LINE", "current"),
    stage: extra.stage ?? DEFAULT_STAGE,
    style: extra.style ?? "SHOW",
    config: extra.config,
  };
}

/** 0:00 INTRO … 1:36 FINAL CHORUS story used by Phase 6 integration. */
export function patternStory80(): {
  phase1: ReturnType<typeof makePhase1>;
  structure: ReturnType<typeof makeStructure>;
} {
  const clusters = [
    makeCluster(32, ["ENERGY_RISE"], {
      strength: 72,
      energyBefore: 24,
      energyAfter: 58,
      confidence: 0.88,
    }),
    makeCluster(48, ["SECTION_CHANGE", "ENERGY_RISE", "BASS_ENTRY", "HIT"], {
      strength: 94,
      energyBefore: 40,
      energyAfter: 88,
      isMajor: true,
      confidence: 0.96,
    }),
    makeCluster(64, ["HIT"], {
      strength: 40,
      energyBefore: 84,
      energyAfter: 90,
      confidence: 0.84,
    }),
    makeCluster(80, ["ENERGY_DROP", "SECTION_CHANGE"], {
      strength: 86,
      energyBefore: 88,
      energyAfter: 28,
      isMajor: true,
      confidence: 0.92,
    }),
    makeCluster(96, ["SECTION_CHANGE", "HIT", "ENERGY_RISE"], {
      strength: 90,
      energyBefore: 30,
      energyAfter: 92,
      isMajor: true,
      confidence: 0.94,
    }),
  ];
  return {
    phase1: createSyntheticPhase1Analysis({
      bpm: 120,
      segments: [
        { duration: 32, energy: 24, bass: 0.08, onset: 0.15, high: 0.08 },
        { duration: 16, energy: 48, bass: 0.25, onset: 0.4, high: 0.12 },
        { duration: 32, energy: 86, bass: 0.55, onset: 0.7, high: 0.22 },
        { duration: 16, energy: 26, bass: 0.08, onset: 0.12, high: 0.06 },
        { duration: 16, energy: 90, bass: 0.6, onset: 0.75, high: 0.25 },
      ],
    }),
    structure: makeStructure(clusters, {
      sections: [
        section("INTRO", 0, 32, 0.9),
        section("VERSE", 32, 48, 0.85),
        section("CHORUS", 48, 80, 0.92),
        section("BREAK", 80, 96, 0.9),
        section("FINAL_CHORUS", 96, 112, 0.93),
      ],
    }),
  };
}

export function buildPipelineInput(options: {
  phase1: FormationOptimizationInput["phase1"];
  structure: FormationOptimizationInput["musicStructure"];
  dancerCount?: number;
  stage?: StageConfig;
  style?: FormationStyle;
  current?: Formation;
  config?: FormationOptimizationInput["config"];
}): FormationOptimizationInput {
  const stage = options.stage ?? DEFAULT_STAGE;
  const dancerCount = options.dancerCount ?? 12;
  const current =
    options.current ?? engineFormation(lineFormation(dancerCount, stage), "LINE", "current");
  const cueAnalysis = generateFormationCues(options.structure, options.phase1);
  const candidatesByCue: FormationOptimizationInput["candidatesByCue"] = {};
  for (const cue of cueAnalysis.cues) {
    if (cue.suppressed) continue;
    candidatesByCue[cue.id] = generateFormationCandidates({
      dancerCount,
      cue,
      intent: cueAnalysis.intents[cue.id] ?? makeIntent(cue.action),
      stage,
      style: options.style ?? "SHOW",
      currentFormation: { id: current.id, positions: current.positions },
    });
  }
  return {
    phase1: options.phase1,
    musicStructure: options.structure,
    cueAnalysis,
    candidatesByCue,
    transitionsByCue: {},
    currentFormation: current,
    stage,
    style: options.style ?? "SHOW",
    config: options.config,
  };
}

export function pipelineFromStructure(
  structure: FormationOptimizationInput["musicStructure"],
  phase1: FormationOptimizationInput["phase1"],
  extra: { dancerCount?: number; style?: FormationStyle } = {}
): FormationOptimizationInput {
  return buildPipelineInput({
    phase1,
    structure,
    dancerCount: extra.dancerCount,
    style: extra.style,
  });
}

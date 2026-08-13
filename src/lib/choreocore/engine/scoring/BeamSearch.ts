import type { FormationCue } from "../types/CueTypes";
import type { Formation, FormationCandidate } from "../types/FormationTypes";
import type { TransitionAnalysis } from "../types/MovementTypes";
import type {
  BeamSearchConfig,
  BeamState,
  FormationOptimizationInput,
  FormationSequenceResult,
} from "../types/ScoringTypes";
import { FORMATION_SEQUENCE_VERSION } from "../types/ScoringTypes";
import { analyzeFormationTransition } from "../movement/TransitionAnalyzer";
import { resolveMovementTiming } from "../movement/MovementTiming";
import { formationSignature } from "../formation/FormationNormalizer";
import {
  defaultSequenceUpperBound,
  resolveBeamSearchConfig,
  resolveCandidateWeights,
} from "./ScoreWeights";
import { scoreFormationCandidate } from "./CandidateScorer";
import { scoreFormationSequence } from "./SequenceScore";
import { feasibilityScore, isHardRejected } from "./FeasibilityScore";
import { transitionQualityScore } from "./TransitionQualityScore";
import { clamp, finite, mean } from "./scoreMath";

function sectionAt(
  input: FormationOptimizationInput,
  time: number
) {
  return input.musicStructure.sections.find(
    (s) => time >= s.startTime && time <= s.endTime
  );
}

function phraseAt(input: FormationOptimizationInput, time: number) {
  return input.musicStructure.phrases.find(
    (p) => time >= p.startTime && time <= p.endTime
  );
}

export function holdCandidate(formation: Formation, cue: FormationCue): FormationCandidate {
  return {
    id: `hold-${cue.id}-${formation.id}`,
    formation: {
      ...formation,
      id: `${formation.id}-hold-${cue.id}`,
    },
    templateId: "hold",
    intentMatch: 88,
    dancerCountFit: 100,
    stageFit: 80,
    spacingPreview: 80,
    symmetry: formation.symmetry,
    complexity: formation.complexity,
    stageCoverage: formation.stageCoverage,
    visualImpact: formation.visualImpact,
    rejected: false,
    rejectionReasons: [],
    metadata: {
      generatedFromCueId: cue.id,
      generationStrategy: "hold",
    },
  };
}

function activeCues(input: FormationOptimizationInput): FormationCue[] {
  return [...input.cueAnalysis.cues]
    .filter((c) => !c.suppressed)
    .sort((a, b) => a.rawTime - b.rawTime || a.id.localeCompare(b.id));
}

function candidatesFor(
  cue: FormationCue,
  from: Formation,
  input: FormationOptimizationInput
): FormationCandidate[] {
  if (cue.action === "HOLD") return [holdCandidate(from, cue)];
  const raw = input.candidatesByCue[cue.id] ?? [];
  const list = cue.action === "MICRO_SHIFT" ? [holdCandidate(from, cue), ...raw] : [...raw];
  const seen = new Set<string>();
  const unique: FormationCandidate[] = [];
  for (const cand of list) {
    const sig =
      cand.metadata.signature ??
      formationSignature(cand.formation.type, cand.formation.positions);
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push(cand);
  }
  unique.sort((a, b) => a.id.localeCompare(b.id));
  return unique;
}

function anticipationFor(cues: FormationCue[], index: number): FormationCue | undefined {
  if (index <= 0) return undefined;
  const cue = cues[index]!;
  const prev = cues[index - 1]!;
  if (prev.reasonCodes.includes("ANTICIPATION")) return prev;
  if (prev.action === "MICRO_SHIFT" && (cue.isMajor || cue.action === "MAJOR_CHANGE")) return prev;
  return undefined;
}

export function runBeamSearch(
  input: FormationOptimizationInput,
  config?: Partial<BeamSearchConfig>
): FormationSequenceResult {
  const cfg = resolveBeamSearchConfig(config ?? input.config);
  const cues = activeCues(input);
  const bpm = input.phase1.tempo.bpm > 0 ? input.phase1.tempo.bpm : 120;
  const style = input.style ?? "SHOW";
  const cache = new Map<string, TransitionAnalysis>();
  const exclusions: FormationSequenceResult["debugExclusions"] = [];
  let statesEvaluated = 0;
  let statesPruned = 0;
  let maxBeamSize = 1;
  let futureCuesScanned = 0;

  const getTransition = (
    from: Formation,
    candidate: FormationCandidate,
    cue: FormationCue,
    cueIndex: number
  ): TransitionAnalysis => {
    const k = `${from.id}|${from.type}|${candidate.id}|${cue.id}`;
    const hit = cache.get(k);
    if (hit) return hit;
    const provided = input.transitionsByCue[cue.id]?.find((t) => t.candidateId === candidate.id);
    if (provided && from.id === input.currentFormation.id) {
      cache.set(k, provided);
      return provided;
    }
    const prevCue = cueIndex > 0 ? cues[cueIndex - 1] : undefined;
    const analysis = analyzeFormationTransition(
      {
        currentFormation: from,
        nextFormation: candidate.formation,
        cue,
        bpm,
        timing: resolveMovementTiming({
          cue,
          previousCue: prevCue,
          bpm,
          anticipationCue: anticipationFor(cues, cueIndex),
        }),
        stage: input.stage,
        previousCue: prevCue,
      },
      candidate
    );
    cache.set(k, analysis);
    return analysis;
  };

  const futureScoresFrom = (from: Formation, cueIndex: number): { next: number[]; nextNext: number[] } => {
    const depth = Math.max(1, cfg.lookAhead);
    const collected: number[][] = [];
    let cursor = from;
    for (let d = 1; d < depth && cueIndex + d < cues.length; d += 1) {
      futureCuesScanned = Math.max(futureCuesScanned, d);
      const cue = cues[cueIndex + d]!;
      const cands = candidatesFor(cue, cursor, input);
      let best = 0;
      let bestForm = cursor;
      for (const cand of cands) {
        const t = getTransition(cursor, cand, cue, cueIndex + d);
        if (isHardRejected(t)) continue;
        const s = transitionQualityScore(t);
        if (s > best) {
          best = s;
          bestForm = cand.formation;
        }
      }
      collected.push([best]);
      cursor = bestForm;
      if (best <= 0) break;
    }
    return {
      next: collected[0] ?? [],
      nextNext: collected.slice(1).flat(),
    };
  };

  let beam: BeamState[] = [
    {
      formationHistory: [input.currentFormation],
      candidateIds: [],
      score: 0,
      history: [],
      transitions: [],
      lastCueIndex: -1,
      repetitionPenalty: 0,
      noveltyScore: 50,
    },
  ];

  if (cues.length === 0) {
    return finalize(
      beam[0]!,
      [],
      input,
      cfg,
      { statesEvaluated, statesPruned, maxBeamSize, futureCuesScanned },
      exclusions,
      1
    );
  }

  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i]!;
    const nextStates: BeamState[] = [];
    const seenSeq = new Set<string>();
    for (const state of beam) {
      const from = state.formationHistory[state.formationHistory.length - 1]!;
      const cands = candidatesFor(cue, from, input);
      const remaining = cues.length - i - 1;
      for (const cand of cands) {
        statesEvaluated += 1;
        const transition = getTransition(from, cand, cue, i);
        if (isHardRejected(transition)) {
          statesPruned += 1;
          exclusions.push({
            candidateId: cand.id,
            cueId: cue.id,
            reason: transition.rejectionReason ?? "INFEASIBLE",
          });
          continue;
        }
        if (feasibilityScore(transition) < cfg.minimumFeasibility) {
          statesPruned += 1;
          exclusions.push({ candidateId: cand.id, cueId: cue.id, reason: "MIN_FEASIBILITY" });
          continue;
        }

        if (i < cues.length - 1) {
          const nxt = cues[i + 1]!;
          const nextCands = candidatesFor(nxt, cand.formation, input);
          const anyFeasible = nextCands.some(
            (n) => !isHardRejected(getTransition(cand.formation, n, nxt, i + 1))
          );
          if (nextCands.length > 0 && !anyFeasible) {
            statesPruned += 1;
            exclusions.push({ candidateId: cand.id, cueId: cue.id, reason: "DEAD_END" });
            continue;
          }
        }

        const future = futureScoresFrom(cand.formation, i);
        const scored = scoreFormationCandidate(
          {
            cue,
            intent: input.cueAnalysis.intents[cue.id],
            currentFormation: from,
            previousFormations: state.formationHistory.slice(-5),
            stage: input.stage,
            style,
            section: sectionAt(input, cue.rawTime),
            phrase: phraseAt(input, cue.rawTime),
            nextCue: cues[i + 1],
            nextCueIsMajor: Boolean(cues[i + 1]?.isMajor || cues[i + 1]?.action === "MAJOR_CHANGE"),
            nextFeasibleScores: future.next,
            nextNextFeasibleScores: future.nextNext,
            weights: resolveCandidateWeights(style, cue),
            config: cfg,
          },
          cand,
          transition
        );
        if (scored.totalScore < cfg.minimumCandidateScore && cue.action !== "HOLD") {
          statesPruned += 1;
          exclusions.push({ candidateId: cand.id, cueId: cue.id, reason: "LOW_SCORE" });
          continue;
        }

        const history = [...state.history, scored];
        const transitions = [...state.transitions, transition];
        const formationHistory = [...state.formationHistory, cand.formation];
        const seq = scoreFormationSequence(formationHistory.slice(1), history, transitions, {
          cues: cues.slice(0, i + 1),
          sections: input.musicStructure.sections,
          style,
          config: cfg,
        });
        const futureBoost = (mean(future.next.concat(future.nextNext)) - 70) * (cfg.futurePotentialWeight / 100);
        const score = seq.totalScore + finite(futureBoost);
        const bound = defaultSequenceUpperBound.estimate({ ...state, score }, remaining);
        if (remaining > 0 && bound < (nextStates[0]?.score ?? 0) - 40 && nextStates.length >= cfg.beamWidth) {
          statesPruned += 1;
          continue;
        }

        const token = `${formationHistory.map((f) => f.type).join(">")}|${cand.id}`;
        if (seenSeq.has(token)) {
          statesPruned += 1;
          continue;
        }
        seenSeq.add(token);

        nextStates.push({
          formationHistory,
          candidateIds: [...state.candidateIds, cand.id],
          score,
          history,
          transitions,
          lastCueIndex: i,
          repetitionPenalty: scored.penalties.repetition,
          noveltyScore: scored.novelty,
        });
      }
    }

    nextStates.sort(
      (a, b) =>
        b.score - a.score ||
        a.candidateIds.join("|").localeCompare(b.candidateIds.join("|"))
    );
    beam = nextStates.slice(0, cfg.beamWidth);
    maxBeamSize = Math.max(maxBeamSize, beam.length);

    if (beam.length === 0) {
      const from = input.currentFormation;
      const hold = holdCandidate(from, cue);
      const t = getTransition(from, hold, cue, i);
      const scored = scoreFormationCandidate(
        {
          cue,
          currentFormation: from,
          previousFormations: [from],
          stage: input.stage,
          style,
          config: cfg,
        },
        hold,
        t
      );
      beam = [
        {
          formationHistory: [from, hold.formation],
          candidateIds: [hold.id],
          score: scored.totalScore,
          history: [scored],
          transitions: [t],
          lastCueIndex: i,
          repetitionPenalty: 0,
          noveltyScore: scored.novelty,
        },
      ];
    }
  }

  const winner = beam[0]!;
  const second = beam[1]?.score;
  return finalize(
    winner,
    cues,
    input,
    cfg,
    { statesEvaluated, statesPruned, maxBeamSize, futureCuesScanned },
    exclusions,
    second
  );
}

function finalize(
  winner: BeamState,
  cues: FormationCue[],
  input: FormationOptimizationInput,
  cfg: BeamSearchConfig,
  search: {
    statesEvaluated: number;
    statesPruned: number;
    maxBeamSize: number;
    futureCuesScanned: number;
  },
  exclusions: FormationSequenceResult["debugExclusions"],
  secondScore: number | undefined
): FormationSequenceResult {
  const formations = winner.formationHistory.slice(1);
  const seq = scoreFormationSequence(formations, winner.history, winner.transitions, {
    cues,
    sections: input.musicStructure.sections,
    style: input.style ?? "SHOW",
    config: cfg,
  });
  const gap = secondScore === undefined ? 20 : seq.totalScore - secondScore;
  const feas = mean(winner.history.map((h) => h.feasibility));
  const confidence = clamp(
    seq.totalScore * 0.0035 +
      clamp(gap / 15, 0, 1) * 0.3 +
      (feas / 100) * 0.2 +
      clamp(input.cueAnalysis.confidence, 0, 1) * 0.15,
    0,
    1
  );
  return {
    formations,
    cues,
    candidateScores: winner.history,
    transitions: winner.transitions,
    totalScore: seq.totalScore,
    breakdown: {
      musicFit: mean(winner.history.map((h) => h.musicFit)),
      visualImpact: mean(winner.history.map((h) => h.visualImpact)),
      transition: mean(winner.history.map((h) => h.transitionQuality)),
      feasibility: feas,
      variety: seq.varietyScore,
      story: (seq.musicStoryScore + seq.visualStoryScore) / 2,
    },
    search: {
      beamWidth: cfg.beamWidth,
      lookAhead: cfg.lookAhead,
      statesEvaluated: search.statesEvaluated,
      statesPruned: search.statesPruned,
      maxBeamSize: search.maxBeamSize,
      futureCuesScanned: search.futureCuesScanned,
    },
    confidence: finite(confidence),
    analysisVersion: FORMATION_SEQUENCE_VERSION,
    debugExclusions: cfg.debug ? exclusions : exclusions.filter((e) => e.reason === "DEAD_END"),
  };
}

export function sequenceConfidence(top: number, second: number): number {
  return clamp((top - second) / 15, 0, 1);
}

import type { FormationRequest } from "../types/CueTypes";
import type {
  FormationCandidate,
  FormationCandidateConfig,
  FormationTemplate,
} from "../types/FormationTypes";
import { FormationGenerationError } from "../types/FormationTypes";
import {
  DEFAULT_FORMATION_CANDIDATE_CONFIG,
  resolveFormationCandidateConfig,
} from "./formationConfig";
import { defaultFormationTemplateRegistry } from "./FormationTemplateRegistry";
import {
  intentMatchScore,
  prohibitedTypes,
  rankedTypesForIntent,
} from "./FormationIntentMapper";
import { spreadForCue, stageCoverage, validateStageConfig } from "./FormationScaler";
import {
  geometryDistance,
  normalizedSignature,
  spacingScore,
} from "./FormationNormalizer";
import { validateFormation } from "./FormationValidator";
import { buildFormation, generateSlots, groupCountOf } from "./FormationGenerator";
import { groupPartitions } from "./geometry";
import { splitSizesFromCurrent } from "./kmeansAdapter";
import { computeMaxFeasibleDistance } from "../../formation_generator";

function preliminaryScore(c: {
  intentMatch: number;
  dancerCountFit: number;
  stageFit: number;
  spacingPreview: number;
  visualImpact: number;
  symmetry: number;
  complexity: number;
}): number {
  return (
    c.intentMatch * 0.3 +
    c.dancerCountFit * 0.2 +
    c.stageFit * 0.2 +
    c.spacingPreview * 0.1 +
    c.visualImpact * 0.1 +
    c.symmetry * 0.05 +
    c.complexity * 0.05
  );
}

function dancerCountFit(template: FormationTemplate, count: number): number {
  if (count >= template.minCount && count <= template.maxCount) return 100;
  const dist = Math.min(
    Math.abs(count - template.minCount),
    Math.abs(count - template.maxCount)
  );
  return Math.max(0, 100 - dist * 8);
}

function stageFit(
  coverage: number,
  action: FormationRequest["cue"]["action"],
  magnitude: FormationRequest["cue"]["magnitude"]
): number {
  if (action === "EXPAND" || action === "MAJOR_CHANGE") {
    const target = magnitude === "MAX" ? 85 : magnitude === "LARGE" ? 70 : 55;
    return Math.max(0, 100 - Math.abs(coverage - target));
  }
  if (action === "CONTRACT" || action === "CLUSTER") {
    const target = magnitude === "MAX" ? 18 : 28;
    return Math.max(0, 100 - Math.abs(coverage - target) * 1.2);
  }
  return Math.max(0, 100 - Math.abs(coverage - 45));
}

function currentPenaltyOrBoost(
  request: FormationRequest,
  positions: FormationCandidate["formation"]["positions"]
): number {
  const current = request.currentFormation?.positions;
  if (!current) return 0;
  const dist = geometryDistance(positions, current);
  if (request.cue.action === "HOLD" || request.cue.magnitude === "NONE") {
    return (1 - Math.min(1, dist)) * 25;
  }
  if (request.cue.action === "MAJOR_CHANGE" || request.cue.magnitude === "MAX") {
    return -Math.max(0, 18 - dist * 40);
  }
  const maxDist = computeMaxFeasibleDistance(16);
  const avgTravel =
    Object.keys(positions).reduce((sum, id) => {
      const a = current[id];
      const b = positions[id];
      if (!a || !b) return sum;
      return sum + Math.hypot(a.x - b.x, a.y - b.y);
    }, 0) / Math.max(1, Object.keys(positions).length);
  if (avgTravel > maxDist * 80) return -8;
  return 0;
}

function makeCurrentCandidate(request: FormationRequest): FormationCandidate | null {
  const current = request.currentFormation;
  if (!current) return null;
  const positions = { ...current.positions };
  if (Object.keys(positions).length !== request.dancerCount) return null;
  const coverage = stageCoverage(positions, request.stage);
  const formation = {
    id: current.id || "current",
    type: "CUSTOM" as const,
    positions,
    symmetry: 70,
    complexity: 15,
    stageCoverage: coverage,
    visualImpact: coverage * 0.5,
    tags: ["current"],
  };
  const hold = request.cue.action === "HOLD" || request.cue.magnitude === "NONE";
  const intentMatch = hold ? 100 : request.cue.action === "MAJOR_CHANGE" ? 12 : 40;
  const scores = {
    intentMatch,
    dancerCountFit: 100,
    stageFit: stageFit(coverage, request.cue.action, request.cue.magnitude),
    spacingPreview: spacingScore(positions, request.stage.minDancerDistance),
    visualImpact: formation.visualImpact,
    symmetry: formation.symmetry,
    complexity: 20,
  };
  return {
    id: `cand-current-${request.cue.id}`,
    formation,
    templateId: "current",
    stageCoverage: coverage,
    ...scores,
    rejected: false,
    rejectionReasons: [],
    metadata: {
      generatedFromCueId: request.cue.id,
      generationStrategy: "current-formation",
      preliminaryScore: preliminaryScore(scores) + (hold ? 20 : -15),
      signature: normalizedSignatureSafe(formation.type, positions, request),
    },
  };
}

function normalizedSignatureSafe(
  type: FormationCandidate["formation"]["type"],
  positions: FormationCandidate["formation"]["positions"],
  request: FormationRequest
): string {
  return normalizedSignature(type, positions, request.stage);
}

export function generateFormationCandidates(
  request: FormationRequest,
  config?: Partial<FormationCandidateConfig>
): FormationCandidate[] {
  if (!Number.isFinite(request.dancerCount) || request.dancerCount < 1) {
    throw new FormationGenerationError(
      "INVALID_COUNT",
      "dancerCount must be a positive integer"
    );
  }
  validateStageConfig(request.stage);
  const cfg = resolveFormationCandidateConfig(config);
  const banned = prohibitedTypes(request.intent);
  const rankedTypes = rankedTypesForIntent(request.intent);
  const spread = spreadForCue(request.cue.action, request.cue.magnitude);
  const registry = defaultFormationTemplateRegistry;
  let templates = registry.getTemplatesForDancerCount(request.dancerCount);

  templates = templates.filter((t) => !banned.has(t.type));
  if (request.intent.primary !== "MAJOR_CHANGE" || request.intent.prohibited.length > 0) {
    const preferred = new Set(rankedTypes);
    const primary = templates.filter((t) => preferred.has(t.type));
    const rest = templates.filter((t) => !preferred.has(t.type));
    templates = [...primary, ...rest];
  }

  const candidates: FormationCandidate[] = [];
  const currentCand = makeCurrentCandidate(request);
  if (currentCand) candidates.push(currentCand);

  const kmeansSizes =
    request.intent.primary === "SPLIT" && request.currentFormation
      ? splitSizesFromCurrent(
          request.currentFormation.positions,
          request.stage,
          request.dancerCount
        )
      : null;

  for (const template of templates) {
    const variants = variantsFor(template, request, kmeansSizes);
    for (const variant of variants) {
      const slots = generateSlots(template, request.dancerCount, {
        variant: variant.id,
        spread:
          template.type === "CLUSTER"
            ? Math.max(variant.spread ?? spread, 0.5)
            : (variant.spread ?? spread),
        groupSizes: variant.groupSizes,
      });
      const formation = buildFormation(template, slots, request, variant.id);
      const reasons = validateFormation(formation, request.dancerCount, request.stage);
      const coverage = formation.stageCoverage;
      let intent = intentMatchScore(template.type, request.intent);
      if (request.cue.action === "MAJOR_CHANGE") {
        intent += Math.min(12, coverage / 10 + formation.visualImpact / 20);
      }
      if (
        request.dancerCount >= 21 &&
        (request.intent.primary === "SPLIT" || request.intent.primary === "MAJOR_CHANGE") &&
        (template.tags.includes("group-based") || variant.strategy.startsWith("group-based"))
      ) {
        intent += 18;
      }
      if (variant.strategy === "kmeans-split") {
        intent += 20;
      }
      const scores = {
        intentMatch: Math.max(0, Math.min(100, intent)),
        dancerCountFit: dancerCountFit(template, request.dancerCount),
        stageFit: Math.max(
          0,
          Math.min(
            100,
            stageFit(coverage, request.cue.action, request.cue.magnitude) +
              currentPenaltyOrBoost(request, formation.positions)
          )
        ),
        spacingPreview: spacingScore(formation.positions, request.stage.minDancerDistance),
        visualImpact: formation.visualImpact,
        symmetry: formation.symmetry,
        complexity: formation.complexity,
      };
      const score = preliminaryScore(scores);
      candidates.push({
        id: `cand-${template.id}-${variant.id}`,
        formation,
        templateId: template.id,
        stageCoverage: coverage,
        ...scores,
        rejected: reasons.length > 0,
        rejectionReasons: reasons,
        metadata: {
          generatedFromCueId: request.cue.id,
          generationStrategy: variant.strategy,
          groupCount: groupCountOf(slots),
          preliminaryScore: score,
          signature: normalizedSignatureSafe(formation.type, formation.positions, request),
        },
      });
    }
  }

  const unique: FormationCandidate[] = [];
  const seen = new Set<string>();
  for (const cand of candidates) {
    const sig = cand.metadata.signature ?? cand.id;
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push(cand);
  }

  unique.sort((a, b) => {
    const sa = a.metadata.preliminaryScore ?? 0;
    const sb = b.metadata.preliminaryScore ?? 0;
    if (a.rejected !== b.rejected) return a.rejected ? 1 : -1;
    return sb - sa || a.id.localeCompare(b.id);
  });

  const accepted = unique.filter((c) => !c.rejected);
  const rejected = unique.filter((c) => c.rejected);
  const max = cfg.maxCandidates;
  const pinned = accepted.filter(
    (c) =>
      c.formation.tags.includes("group-based") ||
      (c.metadata.generationStrategy ?? "").startsWith("group-based") ||
      c.metadata.generationStrategy === "kmeans-split" ||
      (request.intent.primary === "CONTRACT" && c.formation.type === "CLUSTER") ||
      (request.intent.primary === "SPLIT" && c.formation.type === "SPLIT")
  );
  const others = accepted.filter((c) => !pinned.includes(c));
  const picked = [...pinned, ...others].slice(0, max);
  if (picked.length === 0) return rejected.slice(0, max);
  picked.sort((a, b) => {
    const sa = a.metadata.preliminaryScore ?? 0;
    const sb = b.metadata.preliminaryScore ?? 0;
    return sb - sa || a.id.localeCompare(b.id);
  });
  return picked;
}

function variantsFor(
  template: FormationTemplate,
  request: FormationRequest,
  kmeansSizes: number[] | null
): Array<{ id: string; strategy: string; spread?: number; groupSizes?: number[] }> {
  if (template.id === "split" && request.dancerCount >= 21) {
    return groupPartitions(request.dancerCount).map((sizes, i) => ({
      id: `g${i}-${sizes.join("-")}`,
      strategy: `group-based:${sizes.join("+")}`,
      groupSizes: sizes,
    }));
  }
  if (template.id === "split" && kmeansSizes && kmeansSizes.length >= 2) {
    return [
      { id: "kmeans", strategy: "kmeans-split", groupSizes: kmeansSizes },
      { id: "default", strategy: "template-split" },
    ];
  }
  if (template.type === "V") {
    return [{ id: template.id, strategy: template.id }];
  }
  return [{ id: "default", strategy: template.id }];
}

export { DEFAULT_FORMATION_CANDIDATE_CONFIG };

import type { FormationRequest, StageConfig } from "../types/CueTypes";
import type {
  Formation,
  FormationGenerateOptions,
  FormationSlot,
  FormationTemplate,
} from "../types/FormationTypes";
import { COMPLEXITY_BY_TYPE } from "./formationConfig";
import { assignFromCurrent, assignSlots, defaultDancerIds } from "./FormationAssigner";
import {
  symmetryScore,
  visualImpactScore,
} from "./FormationNormalizer";
import { slotsToStage, stageCoverage } from "./FormationScaler";
import { enforceMinDistance } from "./FormationValidator";

const geometryCache = new Map<string, FormationSlot[]>();

export function generateSlots(
  template: FormationTemplate,
  dancerCount: number,
  options: FormationGenerateOptions
): FormationSlot[] {
  const key = `${template.id}:${dancerCount}:${options.variant ?? ""}:${options.spread.toFixed(3)}:${(options.groupSizes ?? []).join("-")}`;
  const cached = geometryCache.get(key);
  if (cached) return cached.map((s) => ({ ...s }));
  const slots = template.generator(dancerCount, options);
  geometryCache.set(key, slots);
  return slots.map((s) => ({ ...s }));
}

export function dancerIdsFor(request: FormationRequest): string[] {
  const currentIds = request.currentFormation
    ? Object.keys(request.currentFormation.positions).sort((a, b) =>
        a.localeCompare(b)
      )
    : [];
  if (currentIds.length === request.dancerCount) return currentIds;
  return defaultDancerIds(request.dancerCount);
}

export function buildFormation(
  template: FormationTemplate,
  slots: FormationSlot[],
  request: FormationRequest,
  variant: string
): Formation {
  const stage: StageConfig = request.stage;
  const points = slotsToStage(slots, stage);
  const ids = dancerIdsFor(request);
  const weights = slots.map((s) => s.visualWeight);
  const positions =
    request.currentFormation &&
    Object.keys(request.currentFormation.positions).length > 0
      ? assignFromCurrent(points, request.currentFormation.positions, ids, weights)
      : assignSlots(slots, points, ids);
  const spaced = enforceMinDistance(
    positions,
    stage.minDancerDistance,
    stage
  );

  const coverage = stageCoverage(spaced, stage);
  const hierarchy: Record<string, number> = {};
  for (const [id, point] of Object.entries(spaced)) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      const d = Math.hypot(points[i]!.x - point.x, points[i]!.y - point.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    hierarchy[id] = slots[best]?.visualWeight ?? 1;
  }
  const groups = new Set(slots.map((s) => s.groupId));
  const tags = [...template.tags];
  if (groups.size >= 2) tags.push(`group-count-${groups.size}`);

  const formation: Formation = {
    id: `form-${template.id}-${request.dancerCount}-${variant}`,
    type: template.type,
    positions: spaced,
    symmetry: symmetryScore(positions, stage),
    complexity: COMPLEXITY_BY_TYPE[template.type] ?? template.complexity,
    stageCoverage: coverage,
    visualImpact: visualImpactScore(coverage, hierarchy, template.type),
    tags,
    visualHierarchy: hierarchy,
  };
  return formation;
}

export function groupCountOf(slots: FormationSlot[]): number {
  return new Set(slots.map((s) => s.groupId)).size;
}

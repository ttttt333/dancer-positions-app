/**
 * 最小総移動割り当て（Hungarian + Lexical Sort + 行列パディング）
 */

import { minCostBipartiteAssignment } from "../../minCostAssignment";
import { detectPathCrossings } from "./crossing";
import { euclideanDistance } from "./geometry";
import type {
  AssignmentResult,
  Formation,
  Position,
  TemplateSlot,
} from "./types";

/** Hungarian に Infinity を渡さないための十分大きなコスト */
const FORBIDDEN = 1e9;

function createEmptyResult(): AssignmentResult {
  return {
    assignment: new Map(),
    totalDisplacement: 0,
    averageDisplacement: 0,
    displacementVariance: 0,
    maxIndividualDisplacement: 0,
    feasible: true,
    pinnedOverLimitPerformerIds: [],
    crossings: [],
  };
}

/**
 * prev → templateSlots の最小総移動割り当て。
 * - パフォーマー / スロットを ID lexical order でソート（決定性）
 * - 人数不一致時は行列パディング（v5 後方互換）
 * - ピン留めスロットを先に確定
 */
export function solveMinDisplacementAssignment(
  prev: Formation,
  templateSlots: TemplateSlot[],
  maxDist: number | null = null,
  performerOverrides: Map<string, number> | null = null
): AssignmentResult {
  const allPerformers = [...prev.performers].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const slots = [...templateSlots].sort((a, b) => a.id.localeCompare(b.id));

  if (allPerformers.length === 0 || slots.length === 0) {
    return createEmptyResult();
  }

  const performerById = new Map(allPerformers.map((p) => [p.id, p] as const));
  const assignment = new Map<string, Position>();
  const pinnedOverLimitPerformerIds: string[] = [];
  const usedPerformerIds = new Set<string>();
  const usedSlotIds = new Set<string>();

  // ピン留め処理
  for (const slot of slots) {
    const pinId = slot.pinnedPerformerId;
    if (!pinId) continue;
    const perf = performerById.get(pinId);
    if (!perf) continue;
    const dist = euclideanDistance(perf.position, slot.position);
    const effectiveMax = performerOverrides?.get(pinId) ?? maxDist;
    if (effectiveMax != null && dist > effectiveMax) {
      pinnedOverLimitPerformerIds.push(pinId);
      // ピンは維持しつつ警告（仕様: over-limit を記録）
    }
    assignment.set(pinId, { ...slot.position });
    usedPerformerIds.add(pinId);
    usedSlotIds.add(slot.id);
  }

  const freePerformers = allPerformers.filter((p) => !usedPerformerIds.has(p.id));
  const freeSlots = slots.filter((s) => !usedSlotIds.has(s.id));

  const numPerformers = freePerformers.length;
  const numSlots = freeSlots.length;
  const matrixSize = Math.max(numPerformers, numSlots, 1);
  const weights: number[][] = Array.from({ length: matrixSize }, () =>
    Array(matrixSize).fill(0)
  );

  for (let i = 0; i < matrixSize; i++) {
    for (let j = 0; j < matrixSize; j++) {
      if (i < numPerformers && j < numSlots) {
        const perf = freePerformers[i]!;
        const slot = freeSlots[j]!;
        const effectiveMaxDist =
          performerOverrides?.get(perf.id) ?? maxDist;
        const dist = euclideanDistance(perf.position, slot.position);
        weights[i]![j] =
          effectiveMaxDist != null && dist > effectiveMaxDist
            ? FORBIDDEN
            : dist;
      } else {
        weights[i]![j] = 0;
      }
    }
  }

  const colOfRow = minCostBipartiteAssignment(weights);
  let feasible = true;

  for (let i = 0; i < numPerformers; i++) {
    const j = colOfRow[i] ?? -1;
    if (j < 0 || j >= numSlots) {
      continue;
    }
    const cost = weights[i]![j]!;
    if (cost >= FORBIDDEN / 2) {
      feasible = false;
    }
    const perf = freePerformers[i]!;
    const slot = freeSlots[j]!;
    assignment.set(perf.id, { ...slot.position });
  }

  // 統計
  const distances: number[] = [];
  for (const [id, pos] of assignment) {
    const prevPos = performerById.get(id)?.position;
    if (!prevPos) continue;
    distances.push(euclideanDistance(prevPos, pos));
  }

  const totalDisplacement = distances.reduce((sum, d) => sum + d, 0);
  const averageDisplacement =
    distances.length > 0 ? totalDisplacement / distances.length : 0;
  const displacementVariance =
    distances.length > 0
      ? distances.reduce(
          (acc, d) => acc + (d - averageDisplacement) ** 2,
          0
        ) / distances.length
      : 0;
  const maxIndividualDisplacement =
    distances.length > 0 ? Math.max(...distances) : 0;

  const crossings = detectPathCrossings(
    { performers: allPerformers },
    assignment
  );

  return {
    assignment,
    totalDisplacement,
    averageDisplacement,
    displacementVariance,
    maxIndividualDisplacement,
    feasible,
    pinnedOverLimitPerformerIds: [...pinnedOverLimitPerformerIds].sort((a, b) =>
      a.localeCompare(b)
    ),
    crossings,
  };
}

/** Assignment Map → Formation */
export function assignmentToFormation(
  prev: Formation,
  assignment: Map<string, Position>,
  id = "assigned"
): Formation {
  const performers = [...prev.performers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => {
      const pos = assignment.get(p.id);
      return {
        id: p.id,
        position: pos ? { ...pos } : { ...p.position },
      };
    })
    .filter((p) => assignment.has(p.id));

  return { id, performers };
}

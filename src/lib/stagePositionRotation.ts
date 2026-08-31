import type { DancerSpot } from "../types/choreography";
import { applyShapePositionsToDancers } from "./stageShapeGenerator";
import { rotateDancerRingOneStep } from "./stageSelectionArrange";
import type { StagePosPct } from "./stageEffectivePosition";

export type PositionRotationDir = "cw" | "ccw";

export type PositionRotationDraft = {
  direction: PositionRotationDir;
  positions: Map<string, StagePosPct>;
};

export function positionRotationLabel(direction: PositionRotationDir): string {
  return direction === "cw" ? "右回り 1人" : "左回り 1人";
}

/**
 * 既存 rotateDancerRingOneStep の結果から id→座標だけ抜く。
 * dancers[] 順が変わっていたら null（接続しない）。
 * Project は変更しない。
 */
export function draftPositionRotation(
  dancers: DancerSpot[],
  targetIds: readonly string[],
  direction: PositionRotationDir
): PositionRotationDraft | null {
  if (targetIds.length < 2) return null;
  const next = rotateDancerRingOneStep(dancers, [...targetIds], direction);
  if (next.length !== dancers.length) return null;

  const positions = new Map<string, StagePosPct>();
  for (let i = 0; i < dancers.length; i++) {
    const before = dancers[i]!;
    const after = next[i]!;
    if (before.id !== after.id) return null;
    if (before.xPct === after.xPct && before.yPct === after.yPct) continue;
    positions.set(before.id, { xPct: after.xPct, yPct: after.yPct });
  }
  if (positions.size === 0) return null;
  return { direction, positions };
}

export function applyPositionRotationDraft(
  dancers: DancerSpot[],
  draft: PositionRotationDraft | null
): DancerSpot[] {
  if (!draft || draft.positions.size === 0) return dancers;
  return applyShapePositionsToDancers(dancers, draft.positions);
}

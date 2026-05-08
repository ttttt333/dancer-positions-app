import { useMemo } from "react";
import { clampStageGridAxisMm } from "../lib/projectDefaults";
import type { ChoreographyProjectJson } from "../types/choreography";

export type StageMmSnapGrid = {
  stepXPct: number;
  stepYPct: number;
  spacingWidthMm: number;
  spacingDepthMm: number;
};

export type UseStageBoardMmSnapGridParams = {
  effStageWidthMm: number | null | undefined;
  effStageDepthMm: number | null | undefined;
  stageWidthMm: number | null | undefined;
  stageDepthMm: number | null | undefined;
  project: Pick<
    ChoreographyProjectJson,
    | "stageGridLineSpacingMm"
    | "stageGridSpacingWidthMm"
    | "stageGridSpacingDepthMm"
  >;
  stageGridLinesVertical: boolean;
  stageGridLinesHorizontal: boolean;
};

export type StageBoardMmSnapGridBundle = {
  mmSnapGrid: StageMmSnapGrid | null;
  showStageMmGridOverlay: boolean;
};

/**
 * 場ミリグリッドのスナップ刻み（%）と、mm グリッドオーバーレイ表示可否。
 * 有効幅・奥行は `stageShell` の `effStage*` と同期させる。
 */
export function useStageBoardMmSnapGrid(
  p: UseStageBoardMmSnapGridParams
): StageBoardMmSnapGridBundle {
  const {
    effStageWidthMm,
    effStageDepthMm,
    stageWidthMm,
    stageDepthMm,
    project,
    stageGridLinesVertical,
    stageGridLinesHorizontal,
  } = p;

  const mmSnapGrid = useMemo(() => {
    const W = effStageWidthMm ?? null;
    const D = effStageDepthMm ?? null;
    if (W == null || D == null || W <= 0 || D <= 0) return null;
    const legacy =
      typeof project.stageGridLineSpacingMm === "number" &&
      Number.isFinite(project.stageGridLineSpacingMm)
        ? project.stageGridLineSpacingMm
        : 10;
    const spacingW = clampStageGridAxisMm(project.stageGridSpacingWidthMm, legacy);
    const spacingD = clampStageGridAxisMm(project.stageGridSpacingDepthMm, legacy);
    return {
      stepXPct: (spacingW / W) * 100,
      stepYPct: (spacingD / D) * 100,
      spacingWidthMm: spacingW,
      spacingDepthMm: spacingD,
    };
  }, [
    effStageWidthMm,
    effStageDepthMm,
    stageWidthMm,
    stageDepthMm,
    project.stageGridLineSpacingMm,
    project.stageGridSpacingWidthMm,
    project.stageGridSpacingDepthMm,
  ]);

  const showStageMmGridOverlay =
    mmSnapGrid != null && (stageGridLinesVertical || stageGridLinesHorizontal);

  return { mmSnapGrid, showStageMmGridOverlay };
}

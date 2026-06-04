import { clampStageGridAxisMm } from "./projectDefaults";
import { computeStageShellLayout } from "./stageShellLayout";
import type { ChoreographyProjectJson } from "../types/choreography";

export type StageExportAppearance = {
  rotDeg: number;
  Wmm: number;
  Dmm: number;
  Smm: number;
  Bmm: number;
  showShell: boolean;
  /** 名前を○の下に出す（○内は番号・距離など） */
  dancerLabelBelow: boolean;
  stageGridLinesVertical: boolean;
  stageGridLinesHorizontal: boolean;
  stepXPct: number | null;
  stepYPct: number | null;
  /** 客席前のセンターガイド間隔（mm）。null なら番号なし */
  centerFieldGuideIntervalMm: number | null;
};

export function buildStageExportAppearance(
  project: ChoreographyProjectJson
): StageExportAppearance {
  const shell = computeStageShellLayout({
    stageResizeDraft: null,
    stageWidthMm: project.stageWidthMm,
    stageDepthMm: project.stageDepthMm,
    sideStageMm: project.sideStageMm,
    backStageMm: project.backStageMm,
    audienceEdge: project.audienceEdge ?? "bottom",
  });

  const W = shell.Wmm > 0 ? shell.Wmm : 12_000;
  const D = shell.Dmm > 0 ? shell.Dmm : 8_000;
  const Smm = shell.Smm;
  const Bmm = shell.Bmm;
  const showShell = shell.showShell || Smm > 0 || Bmm > 0;
  let stepXPct: number | null = null;
  let stepYPct: number | null = null;

  if (W > 0 && D > 0) {
    const legacy =
      typeof project.stageGridLineSpacingMm === "number" &&
      Number.isFinite(project.stageGridLineSpacingMm)
        ? project.stageGridLineSpacingMm
        : 10;
    const spacingW = clampStageGridAxisMm(
      project.stageGridSpacingWidthMm,
      legacy
    );
    const spacingD = clampStageGridAxisMm(
      project.stageGridSpacingDepthMm,
      legacy
    );
    stepXPct = (spacingW / W) * 100;
    stepYPct = (spacingD / D) * 100;
  }

  const stageGridLinesVertical =
    project.stageGridLinesVerticalEnabled ??
    project.stageGridLinesEnabled ??
    false;
  const stageGridLinesHorizontal =
    project.stageGridLinesHorizontalEnabled ??
    project.stageGridLinesEnabled ??
    false;

  return {
    rotDeg: shell.rot,
    Wmm: W,
    Dmm: D,
    Smm,
    Bmm,
    showShell,
    dancerLabelBelow: project.dancerLabelPosition === "below",
    stageGridLinesVertical,
    stageGridLinesHorizontal,
    stepXPct,
    stepYPct,
    centerFieldGuideIntervalMm: project.centerFieldGuideIntervalMm ?? null,
  };
}

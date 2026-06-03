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
  stageGridLinesVertical: boolean;
  stageGridLinesHorizontal: boolean;
  stepXPct: number | null;
  stepYPct: number | null;
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

  const W = shell.Wmm;
  const D = shell.Dmm;
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
    Smm: shell.Smm,
    Bmm: shell.Bmm,
    showShell: shell.showShell,
    stageGridLinesVertical,
    stageGridLinesHorizontal,
    stepXPct,
    stepYPct,
  };
}

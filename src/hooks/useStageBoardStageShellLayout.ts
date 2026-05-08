import { useMemo } from "react";
import { computeStageShellLayout, type StageShellLayout } from "../lib/stageShellLayout";
import type { AudienceEdge } from "../types/choreography";

export type UseStageBoardStageShellLayoutParams = {
  stageResizeDraft: { stageWidthMm: number; stageDepthMm: number } | null;
  stageWidthMm: number | null | undefined;
  stageDepthMm: number | null | undefined;
  sideStageMm: number | null | undefined;
  backStageMm: number | null | undefined;
  audienceEdge: AudienceEdge;
};

/** `stageResizeDraft` 反映後に呼ぶ: 外寸・`rot`・aspect 比などをまとめて派生。 */
export function useStageBoardStageShellLayout(
  p: UseStageBoardStageShellLayoutParams
): StageShellLayout {
  return useMemo(
    () => computeStageShellLayout(p),
    [
      p.stageResizeDraft?.stageWidthMm,
      p.stageResizeDraft?.stageDepthMm,
      p.stageWidthMm,
      p.stageDepthMm,
      p.sideStageMm,
      p.backStageMm,
      p.audienceEdge,
    ]
  );
}

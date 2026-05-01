import { audienceRotationDeg } from "./projectDefaults";
import type { AudienceEdge } from "../types/choreography";

export type StageShellLayout = {
  /** 客席の辺に応じた向きに +180°（舞台フレームの CSS 回転に使う） */
  rot: number;
  effStageWidthMm: number | null | undefined;
  effStageDepthMm: number | null | undefined;
  Wmm: number;
  Dmm: number;
  Smm: number;
  Bmm: number;
  hasStageDims: boolean;
  outerWmm: number;
  outerDmm: number;
  stageAspectRatio: string;
  showShell: boolean;
  draftStageWidthMm: number | undefined;
  draftStageDepthMm: number | undefined;
};

/**
 * リサイズドラフトを反映した外寸 mm・aspect-ratio・シェル表示可否・回転角。
 * メイン床の ResizeObserver 再張り直し用の値も同じ計算から渡す。
 */
export function computeStageShellLayout(p: {
  stageResizeDraft: { stageWidthMm: number; stageDepthMm: number } | null;
  stageWidthMm: number | null | undefined;
  stageDepthMm: number | null | undefined;
  sideStageMm: number | null | undefined;
  backStageMm: number | null | undefined;
  audienceEdge: AudienceEdge;
}): StageShellLayout {
  const rot = (audienceRotationDeg(p.audienceEdge) + 180) % 360;
  const effStageWidthMm = p.stageResizeDraft?.stageWidthMm ?? p.stageWidthMm;
  const effStageDepthMm = p.stageResizeDraft?.stageDepthMm ?? p.stageDepthMm;
  const Wmm =
    effStageWidthMm != null && effStageWidthMm > 0 ? effStageWidthMm : 0;
  const Dmm =
    effStageDepthMm != null && effStageDepthMm > 0 ? effStageDepthMm : 0;
  const Smm = p.sideStageMm != null && p.sideStageMm > 0 ? p.sideStageMm : 0;
  const Bmm = p.backStageMm != null && p.backStageMm > 0 ? p.backStageMm : 0;
  const hasStageDims = Wmm > 0 && Dmm > 0;
  const outerWmm = Wmm + 2 * Smm;
  const outerDmm = Dmm + Bmm;
  const stageAspectRatio = hasStageDims ? `${outerWmm} / ${outerDmm}` : "4 / 3";
  const showShell = hasStageDims && (Smm > 0 || Bmm > 0);
  return {
    rot,
    effStageWidthMm,
    effStageDepthMm,
    Wmm,
    Dmm,
    Smm,
    Bmm,
    hasStageDims,
    outerWmm,
    outerDmm,
    stageAspectRatio,
    showShell,
    draftStageWidthMm: p.stageResizeDraft?.stageWidthMm,
    draftStageDepthMm: p.stageResizeDraft?.stageDepthMm,
  };
}

export type StageContextToolbarPlacement = {
  leftPx: number;
  topPx: number;
  placeAbove: boolean;
};

/**
 * 選択ダンサーの近くにツールバーを置き、ステージ内に収める。
 * 上に置けなければ下、左右は端で押し戻す。
 */
export function placeStageContextToolbar(input: {
  xPct: number;
  yPct: number;
  markerRadiusPx: number;
  toolbarW: number;
  toolbarH: number;
  stageW: number;
  stageH: number;
  gapPx?: number;
  padPx?: number;
}): StageContextToolbarPlacement {
  const gap = input.gapPx ?? 10;
  const pad = input.padPx ?? 6;
  const stageW = Math.max(1, input.stageW);
  const stageH = Math.max(1, input.stageH);
  const cx = (input.xPct / 100) * stageW;
  const cy = (input.yPct / 100) * stageH;
  const tw = Math.max(1, input.toolbarW);
  const th = Math.max(1, input.toolbarH);
  const r = Math.max(0, input.markerRadiusPx);

  let leftPx = cx - tw / 2;
  let placeAbove = true;
  let topPx = cy - r - gap - th;
  if (topPx < pad) {
    placeAbove = false;
    topPx = cy + r + gap;
  }
  if (topPx + th > stageH - pad) {
    topPx = Math.max(pad, stageH - pad - th);
  }
  leftPx = Math.min(Math.max(leftPx, pad), Math.max(pad, stageW - pad - tw));
  topPx = Math.min(Math.max(topPx, pad), Math.max(pad, stageH - pad - th));
  return { leftPx, topPx, placeAbove };
}

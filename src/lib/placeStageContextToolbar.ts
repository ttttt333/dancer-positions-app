export type StageContextToolbarBoxPct = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type StageContextToolbarPlacement = {
  leftPx: number;
  topPx: number;
  placeAbove: boolean;
};

export type PlaceStageContextToolbarInput = {
  xPct: number;
  yPct: number;
  markerRadiusPx: number;
  toolbarW: number;
  toolbarH: number;
  stageW: number;
  stageH: number;
  gapPx?: number;
  padPx?: number;
  /**
   * マーカー下端より下に必要な余白（名下ラベルなど）。
   * 下に反転したとき、名前の上に重ならないようにする。
   */
  southExtraPx?: number;
  /** 複数選択枠があるとき、枠の上下を基準にする */
  boxPct?: StageContextToolbarBoxPct;
  /** 選択枠の外側余白（破線枠・ハンドル分） */
  handleOutsetPx?: number;
};

/**
 * 選択ダンサー（または選択枠）の近くにツールバーを置き、ステージ内に収める。
 * 上に置けなければ下、左右は端で押し戻す。
 */
export function placeStageContextToolbar(
  input: PlaceStageContextToolbarInput
): StageContextToolbarPlacement {
  const gap = input.gapPx ?? 10;
  const pad = input.padPx ?? 6;
  const stageW = Math.max(1, input.stageW);
  const stageH = Math.max(1, input.stageH);
  const tw = Math.max(1, input.toolbarW);
  const th = Math.max(1, input.toolbarH);
  const r = Math.max(0, input.markerRadiusPx);
  const southExtra = Math.max(0, input.southExtraPx ?? 0);
  const outset = Math.max(0, input.handleOutsetPx ?? 0);

  let cx = (input.xPct / 100) * stageW;
  let north = (input.yPct / 100) * stageH - r;
  let south = (input.yPct / 100) * stageH + r + southExtra;

  if (input.boxPct) {
    const { x0, y0, x1, y1 } = input.boxPct;
    cx = ((x0 + x1) / 200) * stageW;
    north = (y0 / 100) * stageH - outset;
    south = (y1 / 100) * stageH + outset + southExtra;
  }

  let leftPx = cx - tw / 2;
  let placeAbove = true;
  let topPx = north - gap - th;
  if (topPx < pad) {
    placeAbove = false;
    topPx = south + gap;
  }
  if (topPx + th > stageH - pad) {
    topPx = Math.max(pad, stageH - pad - th);
  }
  leftPx = Math.min(Math.max(leftPx, pad), Math.max(pad, stageW - pad - tw));
  topPx = Math.min(Math.max(topPx, pad), Math.max(pad, stageH - pad - th));
  return { leftPx, topPx, placeAbove };
}

/** 名下ラベル分の下方向クリアランス（マーカー半径の外側） */
export function nameBelowToolbarSouthExtraPx(
  nameFontPx: number,
  extraClearancePx = 0
): number {
  return Math.max(0, Math.round(nameFontPx * 1.25 + extraClearancePx + 6));
}

export type StagePctPoint = { xPct: number; yPct: number };

/** ステージ表示が180°反転しているかを正規化して判定する。 */
export function isStageHalfTurn(rotationDeg: number): boolean {
  return ((rotationDeg % 360) + 360) % 360 === 180;
}

/** 画面上の割合座標を、保存用のステージ座標へ戻す。 */
export function screenPctToStagePct(
  point: StagePctPoint,
  rotationDeg: number,
): StagePctPoint {
  if (!isStageHalfTurn(rotationDeg)) return point;
  return { xPct: 100 - point.xPct, yPct: 100 - point.yPct };
}

/** 保存済みステージ座標を画面上の割合座標へ変換する。 */
export function stagePctToScreenPct(
  point: StagePctPoint,
  rotationDeg: number,
): StagePctPoint {
  return screenPctToStagePct(point, rotationDeg);
}

/** 画面上のドラッグ差分を、ステージ座標の差分へ変換する。 */
export function screenDeltaPctToStageDelta(
  point: StagePctPoint,
  rotationDeg: number,
): StagePctPoint {
  if (!isStageHalfTurn(rotationDeg)) return point;
  return { xPct: -point.xPct, yPct: -point.yPct };
}

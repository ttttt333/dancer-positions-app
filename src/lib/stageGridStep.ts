/**
 * 場ミリ連動のグリッド間隔（メイン床横幅に対する %）。
 * `gridSpacingMm` と `stageWidthMm` が揃っていれば mm から実効 % を計算し、
 * そうでなければ保存済みの % `fallbackGridStepPct` を返す。
 */
export function computeEffectiveGridStepPct(
  gridSpacingMm: number | null | undefined,
  stageWidthMm: number | null | undefined,
  fallbackGridStepPct: number
): number {
  if (
    typeof gridSpacingMm === "number" &&
    gridSpacingMm > 0 &&
    typeof stageWidthMm === "number" &&
    stageWidthMm > 0
  ) {
    const pct = (gridSpacingMm / stageWidthMm) * 100;
    return Math.max(0.05, Math.min(50, pct));
  }
  return fallbackGridStepPct;
}

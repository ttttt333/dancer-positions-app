/** センター前ガイド（客席側の 1,2,3… 番号）の x% 位置を算出 */
export function computeCenterFieldGuideLineMarks(
  stageWidthMm: number,
  centerFieldGuideIntervalMm: number | null | undefined
): { xp: number; k: number }[] {
  const interval = centerFieldGuideIntervalMm;
  if (interval == null || interval <= 0 || stageWidthMm <= 0) return [];
  const half = stageWidthMm / 2;
  const marks: { xp: number; k: number }[] = [];
  let k = 1;
  const maxPairs = 200;
  while (k * interval <= half + 1e-9 && k <= maxPairs) {
    const deltaPct = ((k * interval) / stageWidthMm) * 100;
    const left = Math.min(100, Math.max(0, 50 - deltaPct));
    const right = Math.min(100, Math.max(0, 50 + deltaPct));
    marks.push({ xp: left, k });
    marks.push({ xp: right, k });
    k++;
  }
  return marks;
}

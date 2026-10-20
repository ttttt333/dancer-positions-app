import { yPctFromFrontMm } from "./stageLighting";
import { normalizeDepthMmList } from "./stageLighting";

export type StageDepthGuideMark = {
  id: string;
  yPct: number;
  labelMm: number;
  kind: "frontGrid" | "sleeve";
};

/**
 * 前からのグリッド間隔で横線マークを生成（interval, 2×interval, …）。
 * 奥行グリッド `stageGridSpacingDepthMm` と統合して使う。
 */
export function buildFrontGridMarksFromInterval(
  intervalMm: number | null | undefined,
  stageDepthMm: number | null | undefined
): StageDepthGuideMark[] {
  if (
    !(typeof intervalMm === "number" && intervalMm > 0) ||
    !(stageDepthMm && stageDepthMm > 0)
  ) {
    return [];
  }
  const out: StageDepthGuideMark[] = [];
  const step = Math.max(10, Math.round(intervalMm));
  let k = 1;
  const max = 200;
  while (k <= max) {
    const mm = k * step;
    if (mm >= stageDepthMm - 1e-6) break;
    const yPct = yPctFromFrontMm(mm, stageDepthMm);
    if (yPct == null) break;
    out.push({
      id: `fg-${mm}`,
      yPct,
      labelMm: mm,
      kind: "frontGrid",
    });
    k++;
  }
  return out;
}

/** 旧リストの最大公約数（間隔推定）。求まらなければ最小値 */
export function inferFrontGridIntervalMm(
  depthsMm: readonly number[] | null | undefined
): number | null {
  const list = normalizeDepthMmList(depthsMm);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0]!;
  let g = list[0]!;
  const gcd = (a: number, b: number) => {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x;
  };
  for (let i = 1; i < list.length; i++) {
    g = gcd(g, list[i]!);
    if (g <= 10) return Math.min(...list);
  }
  return g >= 10 ? g : Math.min(...list);
}

/** @deprecated Prefer buildFrontGridMarksFromInterval */
export function buildFrontGridMarks(
  depthsMm: readonly number[] | null | undefined,
  stageDepthMm: number | null | undefined
): StageDepthGuideMark[] {
  if (!depthsMm?.length || !(stageDepthMm && stageDepthMm > 0)) return [];
  const out: StageDepthGuideMark[] = [];
  for (const mm of depthsMm) {
    const yPct = yPctFromFrontMm(mm, stageDepthMm);
    if (yPct == null) continue;
    out.push({
      id: `fg-${mm}`,
      yPct,
      labelMm: mm,
      kind: "frontGrid",
    });
  }
  return out;
}

/** @deprecated Prefer buildSleeveCurtainMarksFromCurtains */
export function buildSleeveCurtainMarks(
  depthsMm: readonly number[] | null | undefined,
  stageDepthMm: number | null | undefined
): StageDepthGuideMark[] {
  if (!depthsMm?.length || !(stageDepthMm && stageDepthMm > 0)) return [];
  const out: StageDepthGuideMark[] = [];
  for (const mm of depthsMm) {
    const yPct = yPctFromFrontMm(mm, stageDepthMm);
    if (yPct == null) continue;
    out.push({
      id: `sl-${mm}`,
      yPct,
      labelMm: mm,
      kind: "sleeve",
    });
  }
  return out;
}

import { yPctFromFrontMm } from "../lib/stageLighting";

export type StageDepthGuideMark = {
  id: string;
  yPct: number;
  labelMm: number;
  kind: "frontGrid" | "sleeve";
};

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

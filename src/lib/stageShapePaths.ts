import type { StageShape } from "../types/choreography";

/** 長方形プリセット以外の変形舞台（外周マスク・花道帯の抑制などで使う） */
export function isCustomStageShapeActive(
  stageShape: StageShape | null | undefined
): boolean {
  return stageShape != null && stageShape.presetId !== "rectangle";
}

/** メイン床 % 座標の多角形を `<polygon points="…">` 用の文字列にする */
export function stageShapePolygonToSvgPoints(
  polygonPct: StageShape["polygonPct"]
): string {
  return polygonPct.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ");
}

/**
 * 舞台外暗幕用: 外枠矩形と内側多角形を 1 パスに連結（`fill-rule="evenodd"` 前提）。
 */
export function stageShapePolygonToMaskPath(
  polygonPct: StageShape["polygonPct"]
): string {
  if (polygonPct.length < 3) return "";
  const outer = "M 0 0 L 100 0 L 100 100 L 0 100 Z";
  const inner = polygonPct
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(3)} ${y.toFixed(3)}`)
    .join(" ");
  return `${outer} ${inner} Z`;
}

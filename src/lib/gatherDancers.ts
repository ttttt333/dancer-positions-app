import type { DancerSpot } from "../types/choreography";

/** いまの立ち位置を舞台の一辺へ寄せる方向（保存座標系）。 */
export type GatherToward = "front" | "back" | "kamite" | "shimote";

const MARGIN = 5;
const EDGE_INSET = 4;
/** ダンサー印の中心同士の目安最小距離（%）。これ未満だと行／列を増やす。 */
const MIN_CENTER_SEP_PCT = 6.5;

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.min(100 - MARGIN, Math.max(MARGIN, v));
}

/**
 * 全員を指定の辺付近へ寄せ、行／列を増やして中心距離を確保する。
 *
 * 座標: (0,0)=奥・左、(100,100)=手前・右（客席は既定で下＝y が大きい方が手前）。
 * - 前 … 手前（y 大）
 * - 後ろ … 奥（y 小）
 * - 上手 … 右（x 大）
 * - 下手 … 左（x 小）
 */
export function gatherDancersToEdge(
  dancers: DancerSpot[],
  toward: GatherToward
): DancerSpot[] {
  const n = dancers.length;
  if (n === 0) return dancers;

  const lo = MARGIN;
  const hi = 100 - MARGIN;
  const span = Math.max(MIN_CENTER_SEP_PCT, hi - lo);
  const maxPerLine = Math.max(1, Math.floor(span / MIN_CENTER_SEP_PCT));
  const numLines = Math.ceil(n / maxPerLine);

  const sorted =
    toward === "front" || toward === "back"
      ? [...dancers].sort((a, b) => a.xPct - b.xPct || a.yPct - b.yPct)
      : [...dancers].sort((a, b) => a.yPct - b.yPct || a.xPct - b.xPct);

  const depthBudget = hi - lo - 2 * EDGE_INSET;
  const lineStep =
    numLines <= 1 ? 0 : Math.min(9, depthBudget / numLines);

  const posById = new Map<string, { xPct: number; yPct: number }>();

  let idx = 0;
  for (let line = 0; line < numLines; line++) {
    const remaining = n - idx;
    const inLine = Math.min(maxPerLine, remaining);
    const spreadCount = Math.max(1, inLine - 1);
    for (let k = 0; k < inLine; k++) {
      const d = sorted[idx]!;
      const along =
        inLine <= 1 ? (lo + hi) / 2 : lo + (k / spreadCount) * (hi - lo);

      if (toward === "front") {
        const yLine = hi - EDGE_INSET - line * lineStep;
        posById.set(d.id, { xPct: clampPct(along), yPct: clampPct(yLine) });
      } else if (toward === "back") {
        const yLine = lo + EDGE_INSET + line * lineStep;
        posById.set(d.id, { xPct: clampPct(along), yPct: clampPct(yLine) });
      } else if (toward === "kamite") {
        const xLine = hi - EDGE_INSET - line * lineStep;
        posById.set(d.id, { xPct: clampPct(xLine), yPct: clampPct(along) });
      } else {
        const xLine = lo + EDGE_INSET + line * lineStep;
        posById.set(d.id, { xPct: clampPct(xLine), yPct: clampPct(along) });
      }
      idx++;
    }
  }

  return dancers.map((d) => {
    const p = posById.get(d.id);
    if (!p) return d;
    return { ...d, xPct: p.xPct, yPct: p.yPct };
  });
}

export const GATHER_TOWARD_OPTIONS: {
  id: GatherToward;
  label: string;
  hint: string;
}[] = [
  { id: "front", label: "前（手前）", hint: "客席側（y が大きい方）へ" },
  { id: "back", label: "後ろ（奥）", hint: "奥（y が小さい方）へ" },
  { id: "kamite", label: "上手", hint: "画面右・x が大きい方へ" },
  { id: "shimote", label: "下手", hint: "画面左・x が小さい方へ" },
];

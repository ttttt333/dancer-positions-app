import type { StageFloorLineMarkup, StageFloorMarkup } from "../types/choreography";

/** 落書き線の表示範囲（テキストと同じ二択） */
export type FloorLineMarkupScope = "formation" | "global";

export const FLOOR_LINE_SCOPE_OPTIONS: {
  value: FloorLineMarkupScope;
  label: string;
  hint: string;
}[] = [
  {
    value: "formation",
    label: "このキューだけ",
    hint: "いまのキュー（フォーメーション）にだけ表示",
  },
  {
    value: "global",
    label: "すべてのキュー",
    hint: "全編で常に表示",
  },
];

const MAX_POINTS = 200;

/** 描画ストロークから保存用の線マークアップを作る。短すぎる線は null */
export function buildFloorLineMarkupFromPoints(
  points: [number, number][],
  opts?: { color?: string; widthPx?: number; id?: string }
): StageFloorLineMarkup | null {
  if (points.length < 2) return null;
  const clipped = points.slice(0, MAX_POINTS);
  let len = 0;
  for (let i = 1; i < clipped.length; i++) {
    const a = clipped[i - 1]!;
    const b = clipped[i]!;
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  if (len < 0.35) return null;
  return {
    kind: "line",
    id: opts?.id ?? crypto.randomUUID(),
    pointsPct: clipped,
    widthPx: opts?.widthPx ?? 3,
    color: opts?.color ?? "#fbbf24",
  };
}

/** 表示用: 全編線＋キュー固有線（重複 id はキュー側を優先しない・両方出す） */
export function mergeFloorLineMarkupsForDisplay(
  cueMarkup: readonly StageFloorMarkup[] | null | undefined,
  globalMarkup: readonly StageFloorMarkup[] | null | undefined
): StageFloorLineMarkup[] {
  const out: StageFloorLineMarkup[] = [];
  for (const m of globalMarkup ?? []) {
    if (m.kind === "line" && m.pointsPct.length >= 2) out.push(m);
  }
  for (const m of cueMarkup ?? []) {
    if (m.kind === "line" && m.pointsPct.length >= 2) out.push(m);
  }
  return out;
}

export function isFloorLineInGlobalMarkup(
  id: string,
  globalMarkup: readonly StageFloorMarkup[] | null | undefined
): boolean {
  return (globalMarkup ?? []).some((m) => m.id === id && m.kind === "line");
}

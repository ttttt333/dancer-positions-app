import { markerBelowLabelFontPx } from "./stageBoardModelHelpers";

export const NAME_BELOW_FONT_PX_MIN = 8;
export const NAME_BELOW_FONT_PX_MAX = 48;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampNameBelowFontPx(px: number): number {
  return clamp(Math.round(px), NAME_BELOW_FONT_PX_MIN, NAME_BELOW_FONT_PX_MAX);
}

/** ○直径から算出する既定の名下フォント（px） */
export function defaultNameBelowFontPx(markerPx: number): number {
  return markerBelowLabelFontPx(markerPx);
}

/** ドラフト > 個別 `nameBelowFontPx` > ○直径連動、の順で解決 */
export function effectiveNameBelowFontPx(
  dancer: { nameBelowFontPx?: number },
  markerPx: number,
  draftPx?: number | null
): number {
  if (typeof draftPx === "number" && Number.isFinite(draftPx)) {
    return clampNameBelowFontPx(draftPx);
  }
  if (
    typeof dancer.nameBelowFontPx === "number" &&
    Number.isFinite(dancer.nameBelowFontPx)
  ) {
    return clampNameBelowFontPx(dancer.nameBelowFontPx);
  }
  return defaultNameBelowFontPx(markerPx);
}

export type NameBelowFontResizeDraftInput = {
  startFonts: Map<string, number>;
  /** 上方向ドラッグで大きく（px 換算） */
  deltaY: number;
  bulk: boolean;
  anchorFontPx?: number;
};

/**
 * 名前フォントサイズのドラッグプレビュー。
 * 複数選択時は基準フォント＋差分の同一サイズを全員に適用。
 */
export function computeNameBelowFontResizeDraftSizes({
  startFonts,
  deltaY,
  bulk,
  anchorFontPx,
}: NameBelowFontResizeDraftInput): Map<string, number> {
  const draft = new Map<string, number>();
  const entries = [...startFonts.entries()];
  if (entries.length === 0) return draft;

  if (!bulk) {
    const [id, start] = entries[0]!;
    draft.set(id, clampNameBelowFontPx(start - deltaY * 0.35));
    return draft;
  }

  let anchor = anchorFontPx ?? 0;
  if (!(anchor > 0)) {
    for (const [, v] of entries) anchor = Math.max(anchor, v);
  }
  if (!(anchor > 0)) anchor = NAME_BELOW_FONT_PX_MIN;

  const target = clampNameBelowFontPx(anchor - deltaY * 0.35);
  for (const [id] of entries) {
    draft.set(id, target);
  }
  return draft;
}

/** ○中心から名下ラベル中心までの下方向オフセット（px） */
export function dancerNameBelowLabelOffsetPx(
  markerPx: number,
  extraClearancePx: number
): number {
  return Math.round(markerPx / 2) + 8 + extraClearancePx;
}

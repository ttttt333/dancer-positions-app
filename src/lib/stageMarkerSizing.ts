import {
  DEFAULT_DANCER_MARKER_DIAMETER_PX,
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "./projectDefaults";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type BaseMarkerPxInput = {
  dancerMarkerDiameterMm: number | null | undefined;
  stageWidthMm: number | null | undefined;
  mainFloorPxWidth: number;
  dancerMarkerDiameterPx: number | null | undefined;
};

/**
 * ステージ上のダンサー印の基準ピクセル径（`StageBoard` の useMemo と同じ優先順位）。
 */
export function computeBaseMarkerPx({
  dancerMarkerDiameterMm,
  stageWidthMm,
  mainFloorPxWidth,
  dancerMarkerDiameterPx,
}: BaseMarkerPxInput): number {
  if (
    typeof dancerMarkerDiameterMm === "number" &&
    dancerMarkerDiameterMm > 0 &&
    typeof stageWidthMm === "number" &&
    stageWidthMm > 0 &&
    mainFloorPxWidth > 0
  ) {
    const px = Math.round(
      (dancerMarkerDiameterMm * mainFloorPxWidth) / stageWidthMm
    );
    return Math.max(MARKER_DIAMETER_PX_MIN, Math.min(MARKER_DIAMETER_PX_MAX, px));
  }
  const pxRaw = Math.round(
    dancerMarkerDiameterPx ?? DEFAULT_DANCER_MARKER_DIAMETER_PX
  );
  const isDefaultPx = pxRaw === DEFAULT_DANCER_MARKER_DIAMETER_PX;
  if (
    isDefaultPx &&
    typeof stageWidthMm === "number" &&
    stageWidthMm > 0 &&
    mainFloorPxWidth > 0
  ) {
    const implicitMm = Math.max(320, Math.min(1300, stageWidthMm * 0.055));
    const px = Math.round((implicitMm * mainFloorPxWidth) / stageWidthMm);
    return Math.max(MARKER_DIAMETER_PX_MIN, Math.min(MARKER_DIAMETER_PX_MAX, px));
  }
  return Math.max(MARKER_DIAMETER_PX_MIN, Math.min(MARKER_DIAMETER_PX_MAX, pxRaw));
}

export type MarkerResizeDraftInput = {
  startSizes: ReadonlyMap<string, number>;
  delta: number;
  minPx: number;
  maxPx: number;
  /** 2 人以上の一括リサイズなら共通倍率、1 人なら差分 */
  bulk: boolean;
  /** 一括時の基準直径（未指定なら startSizes の最大） */
  anchorSizePx?: number;
};

/**
 * 右下の四角ハンドルドラッグ中の○直径プレビュー。
 * 複数選択時は基準サイズに対する倍率で全員を同時に拡縮する。
 */
export function computeMarkerResizeDraftSizes({
  startSizes,
  delta,
  minPx,
  maxPx,
  bulk,
  anchorSizePx,
}: MarkerResizeDraftInput): Map<string, number> {
  const entries = [...startSizes.entries()];
  const draft = new Map<string, number>();
  if (entries.length === 0) return draft;

  if (!bulk || entries.length === 1) {
    for (const [id, s0] of entries) {
      draft.set(id, Math.round(clamp(s0 + delta, minPx, maxPx)));
    }
    return draft;
  }

  let anchorSize = anchorSizePx ?? 0;
  if (!(anchorSize > 0)) {
    for (const [, s0] of entries) anchorSize = Math.max(anchorSize, s0);
  }
  if (!(anchorSize > 0)) anchorSize = entries[0]![1];

  let scaleLo = 0;
  let scaleHi = Number.POSITIVE_INFINITY;
  for (const [, s0] of entries) {
    if (s0 > 0) {
      scaleLo = Math.max(scaleLo, minPx / s0);
      scaleHi = Math.min(scaleHi, maxPx / s0);
    }
  }
  if (!Number.isFinite(scaleHi) || scaleHi < scaleLo) {
    scaleHi = scaleLo;
  }

  const rawScale = (anchorSize + delta) / anchorSize;
  const scale = clamp(rawScale, scaleLo, scaleHi);

  for (const [id, s0] of entries) {
    draft.set(id, Math.round(clamp(s0 * scale, minPx, maxPx)));
  }
  return draft;
}

import type { DancerSpot } from "../types/choreography";
import {
  DEFAULT_DANCER_MARKER_DIAMETER_PX,
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "./projectDefaults";

/** しゃがみ・座りをステージ印の大きさで区別する（id・座標は変えない） */
export const POSE_LEVEL_MARKER_SCALE = {
  stand: 1,
  crouch: 0.78,
  sit: 0.62,
} as const;

export const POSE_LEVEL_LABEL_JA = {
  stand: "立ち",
  crouch: "しゃがみ",
  sit: "座り",
} as const;

export function poseLevelMarkerScale(
  pose: DancerSpot["poseLevel"] | undefined
): number {
  if (pose === "sit") return POSE_LEVEL_MARKER_SCALE.sit;
  if (pose === "crouch") return POSE_LEVEL_MARKER_SCALE.crouch;
  return POSE_LEVEL_MARKER_SCALE.stand;
}

export function poseLevelLabelJa(
  pose: DancerSpot["poseLevel"] | undefined
): string {
  if (pose === "sit") return POSE_LEVEL_LABEL_JA.sit;
  if (pose === "crouch") return POSE_LEVEL_LABEL_JA.crouch;
  return POSE_LEVEL_LABEL_JA.stand;
}

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
  /** 2 人以上の一括リサイズなら全員同一直径、1 人なら差分 */
  bulk: boolean;
  /** 一括時の基準直径（未指定なら startSizes の最大） */
  anchorSizePx?: number;
};

/**
 * 右下の四角ハンドルドラッグ中の○直径プレビュー。
 * 複数選択時は基準直径＋差分の同一直径を全員に適用する。
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

  const targetPx = Math.round(clamp(anchorSize + delta, minPx, maxPx));
  for (const [id] of entries) {
    draft.set(id, targetPx);
  }
  return draft;
}

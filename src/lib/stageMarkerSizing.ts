import {
  DEFAULT_DANCER_MARKER_DIAMETER_PX,
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "./projectDefaults";

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

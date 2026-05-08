import type { Dispatch, RefObject, SetStateAction } from "react";
import { useMemo, useRef, useState } from "react";
import {
  dancerNameBelowClearanceExtraPx,
} from "../lib/stageBoardModelHelpers";
import { computeBaseMarkerPx } from "../lib/stageMarkerSizing";

export type StageBoardFloorMetricsBundle = {
  stageMainFloorRef: RefObject<HTMLDivElement | null>;
  mainFloorPxWidth: number;
  setMainFloorPxWidth: Dispatch<SetStateAction<number>>;
  baseMarkerPx: number;
  nameBelowClearanceExtraPx: number;
};

/**
 * メイン床 ref・実幅 px・ダンサー印の基準径／名前下余白（床幅連動）。
 * ResizeObserver は `useStageBoardMainFloorResizeObserver`（`stageResizeDraft` より後で呼ぶ）。
 */
export function useStageBoardFloorMetrics(options: {
  dancerMarkerDiameterMm: number | null | undefined;
  stageWidthMm: number | null | undefined;
  dancerMarkerDiameterPx: number | null | undefined;
}): StageBoardFloorMetricsBundle {
  const { dancerMarkerDiameterMm, stageWidthMm, dancerMarkerDiameterPx } =
    options;
  const stageMainFloorRef = useRef<HTMLDivElement>(null);
  const [mainFloorPxWidth, setMainFloorPxWidth] = useState(0);
  const baseMarkerPx = useMemo(
    () =>
      computeBaseMarkerPx({
        dancerMarkerDiameterMm,
        stageWidthMm,
        mainFloorPxWidth,
        dancerMarkerDiameterPx,
      }),
    [
      dancerMarkerDiameterMm,
      stageWidthMm,
      mainFloorPxWidth,
      dancerMarkerDiameterPx,
    ]
  );
  const nameBelowClearanceExtraPx = useMemo(
    () => dancerNameBelowClearanceExtraPx(stageWidthMm, mainFloorPxWidth),
    [stageWidthMm, mainFloorPxWidth]
  );

  return {
    stageMainFloorRef,
    mainFloorPxWidth,
    setMainFloorPxWidth,
    baseMarkerPx,
    nameBelowClearanceExtraPx,
  };
}

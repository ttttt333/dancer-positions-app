import type { Dispatch, RefObject, SetStateAction } from "react";
import { useLayoutEffect } from "react";

export type StageBoardMainFloorRemeasureDeps = {
  Wmm: number;
  Dmm: number;
  Smm: number;
  Bmm: number;
  rot: number;
  showShell: boolean;
  draftStageWidthMm: number | undefined;
  draftStageDepthMm: number | undefined;
};

export type UseStageBoardMainFloorResizeObserverParams = {
  floorRef: RefObject<HTMLDivElement | null>;
  setMainFloorPxWidth: Dispatch<SetStateAction<number>>;
  remeasureDeps: StageBoardMainFloorRemeasureDeps;
};

/**
 * メイン床の実 px 幅を追跡する。
 * `remeasureDeps` は `useStageBoardStageShellLayout` と同じ計算結果を渡す（単一ソース）。
 */
export function useStageBoardMainFloorResizeObserver({
  floorRef,
  setMainFloorPxWidth,
  remeasureDeps,
}: UseStageBoardMainFloorResizeObserverParams): void {
  const {
    Wmm,
    Dmm,
    Smm,
    Bmm,
    rot,
    showShell,
    draftStageWidthMm,
    draftStageDepthMm,
  } = remeasureDeps;

  useLayoutEffect(() => {
    const el = floorRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      const nw = Math.max(0, Math.round(r.width));
      setMainFloorPxWidth((w) => {
        if (nw === 0 && w > 0) return w;
        return w === nw ? w : nw;
      });
    };

    measure();
    let layoutRafCanceled = false;
    const layoutRaf1 = requestAnimationFrame(() => {
      if (layoutRafCanceled) return;
      measure();
      requestAnimationFrame(() => {
        if (layoutRafCanceled) return;
        measure();
      });
    });

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            measure();
          })
        : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      layoutRafCanceled = true;
      cancelAnimationFrame(layoutRaf1);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [
    Wmm,
    Dmm,
    Smm,
    Bmm,
    rot,
    showShell,
    draftStageWidthMm,
    draftStageDepthMm,
  ]);
}

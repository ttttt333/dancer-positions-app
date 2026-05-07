import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type {
  AudienceEdge,
  ChoreographyProjectJson,
  DancerSpot,
} from "../types/choreography";
import type { StageResizeHandleId } from "../components/StageResizeHandles";
import { audienceRotationDeg } from "../lib/projectDefaults";
import {
  STAGE_MAIN_FLOOR_MM_MAX,
  STAGE_MAIN_FLOOR_MM_MIN,
} from "../lib/stageDimensions";

type StageResizeSession = {
  handle: "nw" | "ne" | "se" | "sw" | "n" | "s" | "e" | "w";
  cx: number;
  cy: number;
  rotDeg: number;
  anchorCssX: number;
  anchorCssY: number;
  W0css: number;
  H0css: number;
  outerWmm0: number;
  outerDmm0: number;
  Smm: number;
  Bmm: number;
};

export type UseStageResizeParams = {
  viewMode: "edit" | "view";
  stageInteractionsEnabled: boolean;
  playbackDancers: DancerSpot[] | null;
  previewDancers: DancerSpot[] | null;
  audienceEdge: AudienceEdge;
  stageWidthMm: number | null | undefined;
  stageDepthMm: number | null | undefined;
  sideStageMm: number | null | undefined;
  backStageMm: number | null | undefined;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
};

/**
 * ステージ枠ハンドルでの寸法ドラッグ（`StageBoardBody` から抽出）。
 * `document.getElementById("stage-export-root")` の矩形と客席回転を基準にする。
 */
export function useStageResize({
  viewMode,
  stageInteractionsEnabled,
  playbackDancers,
  previewDancers,
  audienceEdge,
  stageWidthMm,
  stageDepthMm,
  sideStageMm,
  backStageMm,
  setProject,
}: UseStageResizeParams) {
  const stageResizeRef = useRef<StageResizeSession | null>(null);
  const stageResizeLastMmRef = useRef<{ w: number; d: number } | null>(null);
  const stageResizeDraftRafRef = useRef<number | null>(null);

  const [stageResizeDraft, setStageResizeDraft] = useState<{
    stageWidthMm: number;
    stageDepthMm: number;
  } | null>(null);

  const [hoveredStageHandle, setHoveredStageHandle] =
    useState<StageResizeHandleId | null>(null);

  const onStageCornerResizeDown = useCallback(
    (
      handle: "nw" | "ne" | "se" | "sw" | "n" | "s" | "e" | "w",
      e: ReactPointerEvent<HTMLDivElement>,
    ) => {
      if (
        viewMode === "view" ||
        !stageInteractionsEnabled ||
        Boolean(playbackDancers) ||
        Boolean(previewDancers)
      )
        return;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const el = document.getElementById("stage-export-root");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rotDeg = (audienceRotationDeg(audienceEdge) + 180) % 360;
      const is90 = rotDeg === 90 || rotDeg === 270;
      const W0css = is90 ? rect.height : rect.width;
      const H0css = is90 ? rect.width : rect.height;
      const anchorCssX =
        handle === "ne" || handle === "se" || handle === "e"
          ? -W0css / 2
          : handle === "nw" || handle === "sw" || handle === "w"
            ? W0css / 2
            : 0;
      const anchorCssY =
        handle === "sw" || handle === "se" || handle === "s"
          ? -H0css / 2
          : handle === "nw" || handle === "ne" || handle === "n"
            ? H0css / 2
            : 0;
      const curW =
        stageWidthMm != null && stageWidthMm > 0 ? stageWidthMm : 12000;
      const curD =
        stageDepthMm != null && stageDepthMm > 0 ? stageDepthMm : 8000;
      const SmmStart = sideStageMm != null && sideStageMm > 0 ? sideStageMm : 0;
      const BmmStart = backStageMm != null && backStageMm > 0 ? backStageMm : 0;
      stageResizeRef.current = {
        handle,
        cx,
        cy,
        rotDeg,
        anchorCssX,
        anchorCssY,
        W0css,
        H0css,
        outerWmm0: curW + 2 * SmmStart,
        outerDmm0: curD + BmmStart,
        Smm: SmmStart,
        Bmm: BmmStart,
      };
      stageResizeLastMmRef.current = { w: curW, d: curD };
      setStageResizeDraft({ stageWidthMm: curW, stageDepthMm: curD });
      const target = e.currentTarget as HTMLDivElement;
      try {
        target.setPointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
    },
    [
      viewMode,
      stageInteractionsEnabled,
      playbackDancers,
      previewDancers,
      audienceEdge,
      stageWidthMm,
      stageDepthMm,
      sideStageMm,
      backStageMm,
    ],
  );

  useEffect(() => {
    const resizeRatioGain = (raw: number, shift: boolean): number => {
      if (!Number.isFinite(raw) || raw <= 0) return raw;
      if (!shift) return raw;
      if (raw >= 1) return 1 + (raw - 1) * 2.35;
      return 1 - (1 - raw) * 0.55;
    };

    const onMove = (e: PointerEvent) => {
      const s = stageResizeRef.current;
      if (!s) return;
      const dx = e.clientX - s.cx;
      const dy = e.clientY - s.cy;
      const rad = (s.rotDeg * Math.PI) / 180;
      const lx = dx * Math.cos(rad) + dy * Math.sin(rad);
      const ly = -dx * Math.sin(rad) + dy * Math.cos(rad);
      const affectsW =
        s.handle === "e" ||
        s.handle === "w" ||
        s.handle === "nw" ||
        s.handle === "ne" ||
        s.handle === "se" ||
        s.handle === "sw";
      const affectsH =
        s.handle === "n" ||
        s.handle === "s" ||
        s.handle === "nw" ||
        s.handle === "ne" ||
        s.handle === "se" ||
        s.handle === "sw";
      const newCssW = affectsW
        ? Math.max(40, Math.abs(lx - s.anchorCssX))
        : s.W0css;
      const newCssH = affectsH
        ? Math.max(40, Math.abs(ly - s.anchorCssY))
        : s.H0css;
      const ratioW = affectsW
        ? resizeRatioGain(newCssW / Math.max(1, s.W0css), e.shiftKey)
        : 1;
      const ratioH = affectsH
        ? resizeRatioGain(newCssH / Math.max(1, s.H0css), e.shiftKey)
        : 1;
      const newOuterWmm = s.outerWmm0 * ratioW;
      const newOuterDmm = s.outerDmm0 * ratioH;
      let newW = Math.round(newOuterWmm - 2 * s.Smm);
      let newD = Math.round(newOuterDmm - s.Bmm);
      newW = Math.min(
        STAGE_MAIN_FLOOR_MM_MAX,
        Math.max(STAGE_MAIN_FLOOR_MM_MIN, newW),
      );
      newD = Math.min(
        STAGE_MAIN_FLOOR_MM_MAX,
        Math.max(STAGE_MAIN_FLOOR_MM_MIN, newD),
      );
      stageResizeLastMmRef.current = { w: newW, d: newD };
      if (stageResizeDraftRafRef.current !== null) return;
      stageResizeDraftRafRef.current = requestAnimationFrame(() => {
        stageResizeDraftRafRef.current = null;
        const p = stageResizeLastMmRef.current;
        if (!p) return;
        setStageResizeDraft((prev) =>
          prev && prev.stageWidthMm === p.w && prev.stageDepthMm === p.d
            ? prev
            : { stageWidthMm: p.w, stageDepthMm: p.d },
        );
      });
    };

    const onUp = () => {
      if (stageResizeDraftRafRef.current !== null) {
        cancelAnimationFrame(stageResizeDraftRafRef.current);
        stageResizeDraftRafRef.current = null;
      }
      const s = stageResizeRef.current;
      const last = stageResizeLastMmRef.current;
      stageResizeLastMmRef.current = null;
      stageResizeRef.current = null;
      setStageResizeDraft(null);
      if (!s || !last) return;
      setProject((p) => {
        if (p.stageWidthMm === last.w && p.stageDepthMm === last.d) return p;
        return { ...p, stageWidthMm: last.w, stageDepthMm: last.d };
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setProject]);

  return {
    stageResizeDraft,
    hoveredStageHandle,
    setHoveredStageHandle,
    onStageCornerResizeDown,
  };
}

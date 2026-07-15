import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { abortStageBoardPointerGestures } from "../lib/stageBoardGestureAbort";
import {
  STAGE_EDIT_ZOOM,
  useStageBoardPinchViewportStore,
} from "../store/stageBoardPinchViewportStore";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 28;

type ViewState = { zoom: number; panX: number; panY: number };

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function clampPan(
  panX: number,
  panY: number,
  zoom: number,
  clipW: number,
  clipH: number,
): { panX: number; panY: number } {
  if (zoom <= 1.001) return { panX: 0, panY: 0 };
  const maxX = (clipW * (zoom - 1)) / 2 + clipW * 0.2;
  const maxY = (clipH * (zoom - 1)) / 2 + clipH * 0.2;
  return {
    panX: clamp(panX, -maxX, maxX),
    panY: clamp(panY, -maxY, maxY),
  };
}

function isInteractiveStageTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "[data-dancer-id], [data-set-piece-id], [data-dancer-delete-handle], [data-stage-resize-handle], button, a, input, textarea, select",
    ),
  );
}

export type StageBoardPinchViewport = {
  clipRef: RefObject<HTMLDivElement | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  clipStyle: CSSProperties | undefined;
  wrapperStyle: CSSProperties | undefined;
  onPointerDownCapture?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMoveCapture?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUpCapture?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancelCapture?: (e: ReactPointerEvent<HTMLDivElement>) => void;
};

/**
 * スマホのステージ枠向け: 2 本指ピンチで拡大縮小、拡大時は余白を 1 本指パン。
 * ダブルタップで等倍に戻す。
 */
export function useStageBoardPinchViewport(
  enabled: boolean,
): StageBoardPinchViewport {
  const clipRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const pointersRef = useRef(
    new Map<number, { x: number; y: number; type: string }>(),
  );
  const pinchRef = useRef<{
    dist: number;
    zoom: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const panDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (enabled) return;
    pointersRef.current.clear();
    pinchRef.current = null;
    panDragRef.current = null;
    lastTapRef.current = null;
    setView({ zoom: 1, panX: 0, panY: 0 });
  }, [enabled]);

  const zoomToFit = useCallback(() => {
    setView({ zoom: 1, panX: 0, panY: 0 });
  }, []);

  const zoomToEdit = useCallback(() => {
    setView({ zoom: STAGE_EDIT_ZOOM, panX: 0, panY: 0 });
  }, []);

  useEffect(() => {
    const store = useStageBoardPinchViewportStore.getState();
    store.setEnabled(enabled);
    store.setZoom(view.zoom);
  }, [enabled, view.zoom]);

  useEffect(() => {
    if (!enabled) {
      useStageBoardPinchViewportStore.getState().unregister();
      return;
    }
    useStageBoardPinchViewportStore.getState().register({
      zoomToEdit,
      zoomToFit,
    });
    return () => {
      useStageBoardPinchViewportStore.getState().unregister();
    };
  }, [enabled, zoomToEdit, zoomToFit]);

  const clientToLocal = useCallback(
    (clientX: number, clientY: number, vs = viewRef.current) => {
      const clip = clipRef.current;
      if (!clip) return { x: 0, y: 0 };
      const r = clip.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return {
        x: (clientX - cx - vs.panX) / vs.zoom,
        y: (clientY - cy - vs.panY) / vs.zoom,
      };
    },
    [],
  );

  const applyZoom = useCallback(
    (nextZoom: number, anchorX: number, anchorY: number) => {
      const clip = clipRef.current;
      setView((prev) => {
        const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        if (zoom <= 1.001) return { zoom: 1, panX: 0, panY: 0 };
        const panX = prev.panX + anchorX * (prev.zoom - zoom);
        const panY = prev.panY + anchorY * (prev.zoom - zoom);
        if (!clip) return { zoom, panX, panY };
        const clamped = clampPan(
          panX,
          panY,
          zoom,
          clip.clientWidth,
          clip.clientHeight,
        );
        return { zoom, ...clamped };
      });
    },
    [],
  );

  const endPointer = useCallback((pointerId: number) => {
    pointersRef.current.delete(pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (panDragRef.current?.pointerId === pointerId) panDragRef.current = null;
  }, []);

  const onPointerDownCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || e.button !== 0) return;
      if (e.pointerType !== "touch") return;

      pointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        type: e.pointerType,
      });

      if (pointersRef.current.size === 2) {
        abortStageBoardPointerGestures();
        panDragRef.current = null;
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        const midX = (pts[0]!.x + pts[1]!.x) / 2;
        const midY = (pts[0]!.y + pts[1]!.y) / 2;
        const anchor = clientToLocal(midX, midY);
        pinchRef.current = {
          dist,
          zoom: viewRef.current.zoom,
          anchorX: anchor.x,
          anchorY: anchor.y,
        };
        e.preventDefault();
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }

      if (
        pointersRef.current.size === 1 &&
        viewRef.current.zoom > 1.001 &&
        !isInteractiveStageTarget(e.target)
      ) {
        panDragRef.current = {
          pointerId: e.pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startPanX: viewRef.current.panX,
          startPanY: viewRef.current.panY,
        };
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [clientToLocal, enabled],
  );

  const onPointerMoveCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || e.pointerType !== "touch") return;
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
          type: e.pointerType,
        });
      }

      if (pinchRef.current && pointersRef.current.size >= 2) {
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        if (pinchRef.current.dist > 0) {
          applyZoom(
            pinchRef.current.zoom * (dist / pinchRef.current.dist),
            pinchRef.current.anchorX,
            pinchRef.current.anchorY,
          );
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const pan = panDragRef.current;
      if (!pan || pan.pointerId !== e.pointerId) return;
      const clip = clipRef.current;
      if (!clip) return;
      const nextPanX = pan.startPanX + (e.clientX - pan.startClientX);
      const nextPanY = pan.startPanY + (e.clientY - pan.startClientY);
      const clamped = clampPan(
        nextPanX,
        nextPanY,
        viewRef.current.zoom,
        clip.clientWidth,
        clip.clientHeight,
      );
      setView((prev) => ({
        zoom: prev.zoom,
        panX: clamped.panX,
        panY: clamped.panY,
      }));
      e.preventDefault();
      e.stopPropagation();
    },
    [applyZoom, enabled],
  );

  const onPointerUpCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || e.pointerType !== "touch") return;
      const wasPinching = pinchRef.current != null;
      const wasPanning = panDragRef.current?.pointerId === e.pointerId;
      endPointer(e.pointerId);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }

      if (wasPinching || wasPanning) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (
        !isInteractiveStageTarget(e.target) &&
        pointersRef.current.size === 0
      ) {
        const now = performance.now();
        const prev = lastTapRef.current;
        if (
          prev &&
          now - prev.t <= DOUBLE_TAP_MS &&
          Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <= DOUBLE_TAP_PX
        ) {
          lastTapRef.current = null;
          setView({ zoom: 1, panX: 0, panY: 0 });
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        lastTapRef.current = { t: now, x: e.clientX, y: e.clientY };
      }
    },
    [enabled, endPointer],
  );

  const onPointerCancelCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      endPointer(e.pointerId);
    },
    [enabled, endPointer],
  );

  const clipStyle = useMemo<CSSProperties | undefined>(() => {
    if (!enabled) return undefined;
    return {
      overflow: "hidden",
      flex: "1 1 0%",
      alignSelf: "stretch",
      minWidth: 0,
      minHeight: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      touchAction: "none",
    };
  }, [enabled]);

  const wrapperStyle = useMemo<CSSProperties | undefined>(() => {
    if (!enabled) return undefined;
    return {
      transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
      transformOrigin: "center center",
      touchAction: "none",
      willChange: view.zoom > 1.001 ? "transform" : undefined,
    };
  }, [enabled, view.panX, view.panY, view.zoom]);

  if (!enabled) {
    return { clipRef, wrapperRef, clipStyle: undefined, wrapperStyle: undefined };
  }

  return {
    clipRef,
    wrapperRef,
    clipStyle,
    wrapperStyle,
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
  };
}

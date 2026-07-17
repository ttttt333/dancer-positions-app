import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import {
  buildInitialControlPoints,
  isStationaryPath,
  type PathControlPoint,
} from "../lib/dancerPathControlPoints";

export type DancerPathEditorProps = {
  cueId: string;
  prevFormation: DancerSpot[];
  nextFormation: DancerSpot[];
  existingPaths: Record<string, { cpX: number; cpY: number }> | undefined;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  onClose: () => void;
  stageWidthPx?: number;
  stageHeightPx?: number;
};

type LocalPaths = Record<string, PathControlPoint>;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

type MarkerSizes = {
  formationR: number;
  formationStroke: number;
  labelFont: number;
  controlR: number;
  controlHitR: number;
  controlStroke: number;
  pathStroke: number;
  guideStroke: number;
};

const DESKTOP_MARKERS: MarkerSizes = {
  formationR: 18,
  formationStroke: 2.5,
  labelFont: 11,
  controlR: 12,
  controlHitR: 28,
  controlStroke: 2.25,
  pathStroke: 2.5,
  guideStroke: 1.5,
};

const PORTRAIT_MARKERS: MarkerSizes = {
  formationR: 22,
  formationStroke: 3,
  labelFont: 13,
  controlR: 16,
  controlHitR: 36,
  controlStroke: 2.75,
  pathStroke: 3.25,
  guideStroke: 2,
};

const MIN_VIEW_ZOOM = 1;
const MAX_VIEW_ZOOM = 5;

type ViewState = { zoom: number; panX: number; panY: number };

function computeViewBox(
  stageW: number,
  stageH: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const w = stageW / zoom;
  const h = stageH / zoom;
  const maxX = Math.max(0, stageW - w);
  const maxY = Math.max(0, stageH - h);
  return {
    x: clamp(panX, 0, maxX),
    y: clamp(panY, 0, maxY),
    w,
    h,
    maxX,
    maxY,
  };
}

function usePortraitMobileShell(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const read = () =>
      setActive(
        typeof document !== "undefined" &&
          document.querySelector("[data-shell-portrait]") != null
      );
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);
  return active;
}

export function DancerPathEditor({
  cueId,
  prevFormation,
  nextFormation,
  existingPaths,
  setProject,
  onClose,
  stageWidthPx = 900,
  stageHeightPx = 580,
}: DancerPathEditorProps) {
  const portraitMobile = usePortraitMobileShell();
  const markers = portraitMobile ? PORTRAIT_MARKERS : DESKTOP_MARKERS;

  const nextById = useRef<Map<string, DancerSpot>>(new Map());
  nextById.current.clear();
  for (const d of nextFormation) nextById.current.set(d.id, d);

  const [paths, setPaths] = useState<LocalPaths>(() =>
    buildInitialControlPoints(prevFormation, nextFormation, existingPaths)
  );

  const dragging = useRef<string | null>(null);
  /** 黄色い制御点ドラッグ中のダンサー（ラベル強調用・再描画が必要） */
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewStateRef = useRef<ViewState>({ zoom: 1, panX: 0, panY: 0 });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    dist: number;
    zoom: number;
    anchorSvgX: number;
    anchorSvgY: number;
  } | null>(null);
  const panDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const [viewState, setViewState] = useState<ViewState>({
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  viewStateRef.current = viewState;

  const viewBox = computeViewBox(
    stageWidthPx,
    stageHeightPx,
    viewState.zoom,
    viewState.panX,
    viewState.panY
  );

  const clientToSvgPx = useCallback(
    (clientX: number, clientY: number, vs = viewStateRef.current) => {
      if (!svgRef.current) return { x: stageWidthPx / 2, y: stageHeightPx / 2 };
      const rect = svgRef.current.getBoundingClientRect();
      const vb = computeViewBox(stageWidthPx, stageHeightPx, vs.zoom, vs.panX, vs.panY);
      if (rect.width <= 0 || rect.height <= 0) {
        return { x: stageWidthPx / 2, y: stageHeightPx / 2 };
      }
      return {
        x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
        y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
      };
    },
    [stageWidthPx, stageHeightPx]
  );

  const applyViewZoom = useCallback(
    (nextZoom: number, anchorSvgX: number, anchorSvgY: number) => {
      setViewState((prev) => {
        const zoom = clamp(nextZoom, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM);
        const old = computeViewBox(stageWidthPx, stageHeightPx, prev.zoom, prev.panX, prev.panY);
        const relX = old.w > 0 ? (anchorSvgX - old.x) / old.w : 0.5;
        const relY = old.h > 0 ? (anchorSvgY - old.y) / old.h : 0.5;
        const w = stageWidthPx / zoom;
        const h = stageHeightPx / zoom;
        const panX = anchorSvgX - relX * w;
        const panY = anchorSvgY - relY * h;
        return {
          zoom,
          panX: clamp(panX, 0, Math.max(0, stageWidthPx - w)),
          panY: clamp(panY, 0, Math.max(0, stageHeightPx - h)),
        };
      });
    },
    [stageWidthPx, stageHeightPx]
  );

  const getSvgPoint = useCallback(
    (clientX: number, clientY: number) => {
      const pt = clientToSvgPx(clientX, clientY);
      return {
        x: (pt.x / stageWidthPx) * 100,
        y: (pt.y / stageHeightPx) * 100,
      };
    },
    [clientToSvgPx, stageWidthPx, stageHeightPx]
  );

  const endStageGesture = useCallback((pointerId: number) => {
    pointersRef.current.delete(pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (panDragRef.current?.pointerId === pointerId) panDragRef.current = null;
  }, []);

  const onStagePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2) {
        dragging.current = null;
        panDragRef.current = null;
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        const midX = (pts[0]!.x + pts[1]!.x) / 2;
        const midY = (pts[0]!.y + pts[1]!.y) / 2;
        const anchor = clientToSvgPx(midX, midY);
        pinchRef.current = {
          dist,
          zoom: viewStateRef.current.zoom,
          anchorSvgX: anchor.x,
          anchorSvgY: anchor.y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      if (pointersRef.current.size === 1 && viewStateRef.current.zoom > 1.001) {
        panDragRef.current = {
          pointerId: e.pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startPanX: viewStateRef.current.panX,
          startPanY: viewStateRef.current.panY,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    [clientToSvgPx]
  );

  const onStagePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (pinchRef.current && pointersRef.current.size >= 2) {
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        if (pinchRef.current.dist > 0) {
          const scale = dist / pinchRef.current.dist;
          applyViewZoom(
            pinchRef.current.zoom * scale,
            pinchRef.current.anchorSvgX,
            pinchRef.current.anchorSvgY
          );
        }
        return;
      }

      const pan = panDragRef.current;
      if (!pan || pan.pointerId !== e.pointerId || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const vb = computeViewBox(
        stageWidthPx,
        stageHeightPx,
        viewStateRef.current.zoom,
        viewStateRef.current.panX,
        viewStateRef.current.panY
      );
      const dx = ((e.clientX - pan.startClientX) / rect.width) * vb.w;
      const dy = ((e.clientY - pan.startClientY) / rect.height) * vb.h;
      setViewState((prev) => {
        const z = prev.zoom;
        const w = stageWidthPx / z;
        const h = stageHeightPx / z;
        return {
          zoom: z,
          panX: clamp(pan.startPanX - dx, 0, Math.max(0, stageWidthPx - w)),
          panY: clamp(pan.startPanY - dy, 0, Math.max(0, stageHeightPx - h)),
        };
      });
    },
    [applyViewZoom, stageWidthPx, stageHeightPx]
  );

  const onStagePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endStageGesture(e.pointerId);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [endStageGesture]
  );

  const onStageWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const anchor = clientToSvgPx(e.clientX, e.clientY);
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      applyViewZoom(viewStateRef.current.zoom * factor, anchor.x, anchor.y);
    },
    [applyViewZoom, clientToSvgPx]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const id = dragging.current;
      if (!id) return;
      const pt = getSvgPoint(e.clientX, e.clientY);
      setPaths((p) => ({
        ...p,
        [id]: { cpX: Math.min(100, Math.max(0, pt.x)), cpY: Math.min(100, Math.max(0, pt.y)) },
      }));
    },
    [getSvgPoint]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = null;
    setActiveDragId(null);
  }, []);

  const beginControlPointDrag = useCallback(
    (dancerId: string, e: React.PointerEvent<SVGCircleElement>) => {
      e.preventDefault();
      e.stopPropagation();
      pinchRef.current = null;
      panDragRef.current = null;
      dragging.current = dancerId;
      setActiveDragId(dancerId);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    []
  );

  const onSave = useCallback(() => {
    /** 自動配置のままならカスタム保存しない（直線補間のまま） */
    const autoDefaults = buildInitialControlPoints(
      prevFormation,
      nextFormation
    );
    const toSave: Record<string, PathControlPoint> = {};
    for (const d of prevFormation) {
      const cp = paths[d.id];
      const ref = autoDefaults[d.id];
      if (!cp || !ref) continue;
      const dist = Math.hypot(cp.cpX - ref.cpX, cp.cpY - ref.cpY);
      if (dist > 0.3) {
        toSave[d.id] = cp;
      }
    }
    setProject((proj) => ({
      ...proj,
      cues: proj.cues.map((c) =>
        c.id === cueId
          ? {
              ...c,
              dancerCustomPaths:
                Object.keys(toSave).length > 0 ? toSave : undefined,
            }
          : c
      ),
    }));
    onClose();
  }, [cueId, paths, prevFormation, nextFormation, setProject, onClose]);

  const onReset = useCallback(() => {
    setPaths(buildInitialControlPoints(prevFormation, nextFormation));
  }, [prevFormation, nextFormation]);

  const toSvgX = (pct: number) => (pct / 100) * stageWidthPx;
  const toSvgY = (pct: number) => (pct / 100) * stageHeightPx;

  function bezierD(
    ax: number,
    ay: number,
    cpX: number,
    cpY: number,
    bx: number,
    by: number
  ) {
    return `M${toSvgX(ax)},${toSvgY(ay)} Q${toSvgX(cpX)},${toSvgY(cpY)} ${toSvgX(bx)},${toSvgY(by)}`;
  }

  const zoomHint =
    viewState.zoom > 1.001 ? ` · ${viewState.zoom.toFixed(viewState.zoom >= 10 ? 0 : 1)}×` : "";

  const stageSvg = (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="dancer-path-editor-svg"
      style={{ display: "block", userSelect: "none", touchAction: "none" }}
    >
      <rect width={stageWidthPx} height={stageHeightPx} fill="#0f172a" />
      <line
        x1={stageWidthPx / 2}
        y1={0}
        x2={stageWidthPx / 2}
        y2={stageHeightPx}
        stroke="#1e293b"
        strokeWidth={portraitMobile ? 1.5 : 1}
      />
      <line
        x1={0}
        y1={stageHeightPx / 2}
        x2={stageWidthPx}
        y2={stageHeightPx / 2}
        stroke="#1e293b"
        strokeWidth={portraitMobile ? 1.5 : 1}
      />

      {[...prevFormation]
        .sort((p, q) => {
          if (activeDragId == null) return 0;
          if (p.id === activeDragId) return 1;
          if (q.id === activeDragId) return -1;
          return 0;
        })
        .map((a) => {
        const b = nextById.current.get(a.id);
        if (!b) return null;
        const cp = paths[a.id] ?? {
          cpX: (a.xPct + b.xPct) / 2,
          cpY: (a.yPct + b.yPct) / 2,
        };
        const ax = toSvgX(a.xPct);
        const ay = toSvgY(a.yPct);
        const bx = toSvgX(b.xPct);
        const by = toSvgY(b.yPct);
        const cpx = toSvgX(cp.cpX);
        const cpy = toSvgY(cp.cpY);
        const stationary = isStationaryPath(a.xPct, a.yPct, b.xPct, b.yPct);
        const isActive = activeDragId === a.id;
        const isDimmed = activeDragId != null && !isActive;
        const labelFont = isActive
          ? markers.labelFont * 1.35
          : markers.labelFont;
        const groupOpacity = isDimmed ? 0.28 : 1;
        const prevLabelFill = isActive ? "#ffffff" : "#93c5fd";
        const nextLabelFill = isActive ? "#ffffff" : "#86efac";
        const stationaryLabelFill = isActive ? "#ffffff" : "#e2e8f0";
        const pathStroke = isActive ? "#a5b4fc" : "#6366f1";
        const pathWidth = isActive
          ? markers.pathStroke * 1.35
          : markers.pathStroke;
        const guideStroke = isActive ? "#94a3b8" : "#475569";

        return (
          <g
            key={a.id}
            opacity={groupOpacity}
            style={isActive ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.45))" } : undefined}
          >
            <line
              x1={ax}
              y1={ay}
              x2={cpx}
              y2={cpy}
              stroke={guideStroke}
              strokeWidth={markers.guideStroke}
              strokeDasharray="4,3"
            />
            <line
              x1={bx}
              y1={by}
              x2={cpx}
              y2={cpy}
              stroke={guideStroke}
              strokeWidth={markers.guideStroke}
              strokeDasharray="4,3"
            />

            <path
              d={bezierD(a.xPct, a.yPct, cp.cpX, cp.cpY, b.xPct, b.yPct)}
              fill="none"
              stroke={pathStroke}
              strokeWidth={pathWidth}
              strokeDasharray="6,3"
            />

            {stationary ? (
              <>
                <circle
                  cx={ax}
                  cy={ay}
                  r={markers.formationR * (isActive ? 1.12 : 1)}
                  fill={isActive ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.28)"}
                  stroke={isActive ? "#93c5fd" : "#3b82f6"}
                  strokeWidth={markers.formationStroke * (isActive ? 1.25 : 1)}
                />
                <circle
                  cx={ax}
                  cy={ay}
                  r={markers.formationR * 0.58 * (isActive ? 1.12 : 1)}
                  fill={isActive ? "rgba(34,197,94,0.55)" : "rgba(34,197,94,0.32)"}
                  stroke={isActive ? "#86efac" : "#22c55e"}
                  strokeWidth={markers.formationStroke * 0.9 * (isActive ? 1.25 : 1)}
                />
                <text
                  x={ax}
                  y={ay + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={stationaryLabelFill}
                  fontSize={labelFont}
                  fontWeight={800}
                  stroke={isActive ? "rgba(15,23,42,0.85)" : "none"}
                  strokeWidth={isActive ? 3 : 0}
                  paintOrder="stroke fill"
                  pointerEvents="none"
                >
                  {a.label}
                </text>
              </>
            ) : (
              <>
                <circle
                  cx={ax}
                  cy={ay}
                  r={markers.formationR * (isActive ? 1.12 : 1)}
                  fill={isActive ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.28)"}
                  stroke={isActive ? "#93c5fd" : "#3b82f6"}
                  strokeWidth={markers.formationStroke * (isActive ? 1.25 : 1)}
                />
                <text
                  x={ax}
                  y={ay + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={prevLabelFill}
                  fontSize={labelFont}
                  fontWeight={800}
                  stroke={isActive ? "rgba(15,23,42,0.85)" : "none"}
                  strokeWidth={isActive ? 3 : 0}
                  paintOrder="stroke fill"
                  pointerEvents="none"
                >
                  {a.label}
                </text>

                <circle
                  cx={bx}
                  cy={by}
                  r={markers.formationR * (isActive ? 1.12 : 1)}
                  fill={isActive ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.24)"}
                  stroke={isActive ? "#86efac" : "#22c55e"}
                  strokeWidth={markers.formationStroke * (isActive ? 1.25 : 1)}
                />
                <text
                  x={bx}
                  y={by + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={nextLabelFill}
                  fontSize={labelFont}
                  fontWeight={800}
                  stroke={isActive ? "rgba(15,23,42,0.85)" : "none"}
                  strokeWidth={isActive ? 3 : 0}
                  paintOrder="stroke fill"
                  pointerEvents="none"
                >
                  {b.label}
                </text>
              </>
            )}

            <circle
              cx={cpx}
              cy={cpy}
              r={markers.controlR * (isActive ? 1.2 : 1)}
              fill={isActive ? "#fbbf24" : "#f59e0b"}
              stroke="#fde68a"
              strokeWidth={markers.controlStroke * (isActive ? 1.35 : 1)}
              pointerEvents="none"
            />
            <circle
              cx={cpx}
              cy={cpy}
              r={markers.controlHitR}
              fill="transparent"
              style={{ cursor: isActive ? "grabbing" : "grab", touchAction: "none" }}
              onPointerDown={(e) => beginControlPointDrag(a.id, e)}
            />
          </g>
        );
      })}
    </svg>
  );

  const actionButtons = (
    <>
      <button type="button" className="dancer-path-editor-btn dancer-path-editor-btn--muted" onClick={onReset}>
        リセット
      </button>
      <button type="button" className="dancer-path-editor-btn dancer-path-editor-btn--muted" onClick={onClose}>
        キャンセル
      </button>
      <button type="button" className="dancer-path-editor-btn dancer-path-editor-btn--primary" onClick={onSave}>
        保存
      </button>
    </>
  );

  if (portraitMobile) {
    return (
      <div
        className="dancer-path-editor dancer-path-editor--portrait"
        role="dialog"
        aria-modal="true"
        aria-label="個人別移動軌道の設定"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <header className="dancer-path-editor-header dancer-path-editor-header--portrait">
          <h2 className="dancer-path-editor-title">個人別移動軌道</h2>
          <p className="dancer-path-editor-hint">
            黄色い点をドラッグして曲線を調整 · 2本指で拡大{zoomHint}
          </p>
        </header>

        <div
          className="dancer-path-editor-stage dancer-path-editor-stage--portrait"
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerUp}
          onWheel={onStageWheel}
        >
          {stageSvg}
        </div>

        <div className="dancer-path-editor-legend dancer-path-editor-legend--portrait">
          <span>
            <span className="dancer-path-editor-legend-dot dancer-path-editor-legend-dot--prev" />
            前
          </span>
          <span>
            <span className="dancer-path-editor-legend-dot dancer-path-editor-legend-dot--next" />
            後
          </span>
          <span>
            <span className="dancer-path-editor-legend-dot dancer-path-editor-legend-dot--cp" />
            制御点
          </span>
        </div>

        <div className="dancer-path-editor-actions dancer-path-editor-actions--portrait">
          {actionButtons}
        </div>
      </div>
    );
  }

  return (
    <div
      className="dancer-path-editor"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div className="dancer-path-editor-header">
        <div className="dancer-path-editor-title-block">
          個人別移動軌道の設定
          <span className="dancer-path-editor-hint dancer-path-editor-hint--desktop">
            黄色い点をドラッグして曲線を調整 · ピンチ／ホイールで拡大{zoomHint}
          </span>
        </div>
      </div>

      <div
        className="dancer-path-editor-stage dancer-path-editor-stage--desktop"
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
        onWheel={onStageWheel}
      >
        {stageSvg}
      </div>

      <div className="dancer-path-editor-legend dancer-path-editor-legend--desktop">
        <span>
          <svg width={18} height={18} style={{ verticalAlign: "middle", marginRight: 4 }} aria-hidden>
            <circle cx={9} cy={9} r={7} fill="rgba(59,130,246,0.28)" stroke="#3b82f6" strokeWidth={2} />
          </svg>
          前フォーメーション
        </span>
        <span>
          <svg width={18} height={18} style={{ verticalAlign: "middle", marginRight: 4 }} aria-hidden>
            <circle cx={9} cy={9} r={7} fill="rgba(34,197,94,0.24)" stroke="#22c55e" strokeWidth={2} />
          </svg>
          後フォーメーション
        </span>
        <span>
          <svg width={18} height={18} style={{ verticalAlign: "middle", marginRight: 4 }} aria-hidden>
            <circle cx={9} cy={9} r={6} fill="#f59e0b" stroke="#fde68a" strokeWidth={2} />
          </svg>
          制御点（ドラッグ）
        </span>
      </div>

      <div className="dancer-path-editor-actions dancer-path-editor-actions--desktop">
        {actionButtons}
      </div>
    </div>
  );
}

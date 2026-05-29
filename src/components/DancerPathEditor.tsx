import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";

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

function defaultCp(
  ax: number,
  ay: number,
  bx: number,
  by: number
): { cpX: number; cpY: number } {
  return { cpX: (ax + bx) / 2, cpY: (ay + by) / 2 };
}

type LocalPaths = Record<string, { cpX: number; cpY: number }>;

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
  formationR: 14,
  formationStroke: 2.25,
  labelFont: 10,
  controlR: 12,
  controlHitR: 28,
  controlStroke: 2.25,
  pathStroke: 2.5,
  guideStroke: 1.5,
};

const PORTRAIT_MARKERS: MarkerSizes = {
  formationR: 18,
  formationStroke: 2.75,
  labelFont: 12,
  controlR: 16,
  controlHitR: 36,
  controlStroke: 2.75,
  pathStroke: 3.25,
  guideStroke: 2,
};

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

  const [paths, setPaths] = useState<LocalPaths>(() => {
    const init: LocalPaths = {};
    for (const d of prevFormation) {
      const b = nextById.current.get(d.id);
      if (!b) continue;
      const existing = existingPaths?.[d.id];
      init[d.id] = existing ?? defaultCp(d.xPct, d.yPct, b.xPct, b.yPct);
    }
    return init;
  });

  const dragging = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

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
  }, []);

  const beginControlPointDrag = useCallback(
    (dancerId: string, e: React.PointerEvent<SVGCircleElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = dancerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    []
  );

  const onSave = useCallback(() => {
    const toSave: Record<string, { cpX: number; cpY: number }> = {};
    for (const d of prevFormation) {
      const b = nextById.current.get(d.id);
      if (!b) continue;
      const cp = paths[d.id];
      if (!cp) continue;
      const mid = defaultCp(d.xPct, d.yPct, b.xPct, b.yPct);
      const dist = Math.hypot(cp.cpX - mid.cpX, cp.cpY - mid.cpY);
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
  }, [cueId, paths, prevFormation, setProject, onClose]);

  const onReset = useCallback(() => {
    const init: LocalPaths = {};
    for (const d of prevFormation) {
      const b = nextById.current.get(d.id);
      if (!b) continue;
      init[d.id] = defaultCp(d.xPct, d.yPct, b.xPct, b.yPct);
    }
    setPaths(init);
  }, [prevFormation]);

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

  const stageSvg = (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${stageWidthPx} ${stageHeightPx}`}
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

      {prevFormation.map((a) => {
        const b = nextById.current.get(a.id);
        if (!b) return null;
        const cp = paths[a.id] ?? defaultCp(a.xPct, a.yPct, b.xPct, b.yPct);
        const ax = toSvgX(a.xPct);
        const ay = toSvgY(a.yPct);
        const bx = toSvgX(b.xPct);
        const by = toSvgY(b.yPct);
        const cpx = toSvgX(cp.cpX);
        const cpy = toSvgY(cp.cpY);

        return (
          <g key={a.id}>
            <line
              x1={ax}
              y1={ay}
              x2={cpx}
              y2={cpy}
              stroke="#475569"
              strokeWidth={markers.guideStroke}
              strokeDasharray="4,3"
            />
            <line
              x1={bx}
              y1={by}
              x2={cpx}
              y2={cpy}
              stroke="#475569"
              strokeWidth={markers.guideStroke}
              strokeDasharray="4,3"
            />

            <path
              d={bezierD(a.xPct, a.yPct, cp.cpX, cp.cpY, b.xPct, b.yPct)}
              fill="none"
              stroke="#6366f1"
              strokeWidth={markers.pathStroke}
              strokeDasharray="6,3"
            />

            <circle
              cx={ax}
              cy={ay}
              r={markers.formationR}
              fill="rgba(59,130,246,0.28)"
              stroke="#3b82f6"
              strokeWidth={markers.formationStroke}
            />
            <text
              x={ax}
              y={ay + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#93c5fd"
              fontSize={markers.labelFont}
              fontWeight={700}
              pointerEvents="none"
            >
              {a.label}
            </text>

            <circle
              cx={bx}
              cy={by}
              r={markers.formationR}
              fill="rgba(34,197,94,0.24)"
              stroke="#22c55e"
              strokeWidth={markers.formationStroke}
            />
            <text
              x={bx}
              y={by + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#86efac"
              fontSize={markers.labelFont}
              fontWeight={700}
              pointerEvents="none"
            >
              {b.label}
            </text>

            <circle
              cx={cpx}
              cy={cpy}
              r={markers.controlR}
              fill="#f59e0b"
              stroke="#fde68a"
              strokeWidth={markers.controlStroke}
              pointerEvents="none"
            />
            <circle
              cx={cpx}
              cy={cpy}
              r={markers.controlHitR}
              fill="transparent"
              style={{ cursor: "grab", touchAction: "none" }}
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
          <p className="dancer-path-editor-hint">黄色い点をドラッグして曲線を調整</p>
        </header>

        <div className="dancer-path-editor-stage dancer-path-editor-stage--portrait">{stageSvg}</div>

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
            黄色い点をドラッグして曲線を調整
          </span>
        </div>
      </div>

      <div className="dancer-path-editor-stage dancer-path-editor-stage--desktop">{stageSvg}</div>

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

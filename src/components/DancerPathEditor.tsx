import { useCallback, useRef, useState } from "react";
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

/** 前後フォーメーションの印（スマホでも見やすいサイズ） */
const FORMATION_MARKER_R = 14;
const FORMATION_MARKER_STROKE = 2.25;
const MARKER_LABEL_FONT = 10;
/** 黄色い制御点（見た目 + タッチ当たり判定） */
const CONTROL_POINT_R = 12;
const CONTROL_POINT_HIT_R = 28;
const CONTROL_POINT_STROKE = 2.25;

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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        touchAction: "none",
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        style={{
          color: "#e2e8f0",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.03em",
          textAlign: "center",
          padding: "0 16px",
        }}
      >
        個人別移動軌道の設定
        <span
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 400,
            color: "#94a3b8",
            marginTop: 4,
          }}
        >
          黄色い点をドラッグして曲線を調整
        </span>
      </div>

      <div
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          width: `min(${stageWidthPx}px, calc(100vw - 32px))`,
          aspectRatio: `${stageWidthPx} / ${stageHeightPx}`,
          touchAction: "none",
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${stageWidthPx} ${stageHeightPx}`}
          style={{ display: "block", userSelect: "none", touchAction: "none" }}
        >
          <rect width={stageWidthPx} height={stageHeightPx} fill="#0f172a" />
          <line
            x1={stageWidthPx / 2}
            y1={0}
            x2={stageWidthPx / 2}
            y2={stageHeightPx}
            stroke="#1e293b"
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={stageHeightPx / 2}
            x2={stageWidthPx}
            y2={stageHeightPx / 2}
            stroke="#1e293b"
            strokeWidth={1}
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
                  strokeWidth={1.5}
                  strokeDasharray="4,3"
                />
                <line
                  x1={bx}
                  y1={by}
                  x2={cpx}
                  y2={cpy}
                  stroke="#475569"
                  strokeWidth={1.5}
                  strokeDasharray="4,3"
                />

                <path
                  d={bezierD(a.xPct, a.yPct, cp.cpX, cp.cpY, b.xPct, b.yPct)}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  strokeDasharray="6,3"
                />

                <circle
                  cx={ax}
                  cy={ay}
                  r={FORMATION_MARKER_R}
                  fill="rgba(59,130,246,0.28)"
                  stroke="#3b82f6"
                  strokeWidth={FORMATION_MARKER_STROKE}
                />
                <text
                  x={ax}
                  y={ay + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#93c5fd"
                  fontSize={MARKER_LABEL_FONT}
                  fontWeight={700}
                  pointerEvents="none"
                >
                  {a.label}
                </text>

                <circle
                  cx={bx}
                  cy={by}
                  r={FORMATION_MARKER_R}
                  fill="rgba(34,197,94,0.24)"
                  stroke="#22c55e"
                  strokeWidth={FORMATION_MARKER_STROKE}
                />
                <text
                  x={bx}
                  y={by + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#86efac"
                  fontSize={MARKER_LABEL_FONT}
                  fontWeight={700}
                  pointerEvents="none"
                >
                  {b.label}
                </text>

                <circle
                  cx={cpx}
                  cy={cpy}
                  r={CONTROL_POINT_R}
                  fill="#f59e0b"
                  stroke="#fde68a"
                  strokeWidth={CONTROL_POINT_STROKE}
                  pointerEvents="none"
                />
                <circle
                  cx={cpx}
                  cy={cpy}
                  r={CONTROL_POINT_HIT_R}
                  fill="transparent"
                  style={{ cursor: "grab", touchAction: "none" }}
                  onPointerDown={(e) => beginControlPointDrag(a.id, e)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 14,
          fontSize: 12,
          color: "#94a3b8",
          alignItems: "center",
          padding: "0 16px",
        }}
      >
        <span>
          <svg width={18} height={18} style={{ verticalAlign: "middle", marginRight: 4 }}>
            <circle
              cx={9}
              cy={9}
              r={7}
              fill="rgba(59,130,246,0.28)"
              stroke="#3b82f6"
              strokeWidth={2}
            />
          </svg>
          前フォーメーション
        </span>
        <span>
          <svg width={18} height={18} style={{ verticalAlign: "middle", marginRight: 4 }}>
            <circle
              cx={9}
              cy={9}
              r={7}
              fill="rgba(34,197,94,0.24)"
              stroke="#22c55e"
              strokeWidth={2}
            />
          </svg>
          後フォーメーション
        </span>
        <span>
          <svg width={18} height={18} style={{ verticalAlign: "middle", marginRight: 4 }}>
            <circle cx={9} cy={9} r={6} fill="#f59e0b" stroke="#fde68a" strokeWidth={2} />
          </svg>
          制御点（ドラッグ）
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, padding: "0 16px 12px" }}>
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: "10px 18px",
            borderRadius: 7,
            border: "1px solid #475569",
            background: "#1e293b",
            color: "#94a3b8",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          リセット
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "10px 18px",
            borderRadius: 7,
            border: "1px solid #475569",
            background: "#1e293b",
            color: "#cbd5e1",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onSave}
          style={{
            padding: "10px 22px",
            borderRadius: 7,
            border: "1px solid rgba(99,102,241,0.8)",
            background: "rgba(99,102,241,0.25)",
            color: "#c7d2fe",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
}

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

export function DancerPathEditor({
  cueId,
  prevFormation,
  nextFormation,
  existingPaths,
  setProject,
  onClose,
  stageWidthPx = 560,
  stageHeightPx = 360,
}: DancerPathEditorProps) {
  // Build map of nextFormation by id for quick lookup
  const nextById = useRef<Map<string, DancerSpot>>(new Map());
  nextById.current.clear();
  for (const d of nextFormation) nextById.current.set(d.id, d);

  // Local copy of paths — only dancers that appear in both formations
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

  // Which dancer handle is being dragged
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

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
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

  const onMouseUp = useCallback(() => {
    dragging.current = null;
  }, []);

  const onSave = useCallback(() => {
    // Only save paths that differ from the straight midpoint (to avoid bloat)
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

  // Build bezier path string (SVG quadratic)
  function bezierD(
    ax: number, ay: number,
    cpX: number, cpY: number,
    bx: number, by: number
  ) {
    const toSvgX = (pct: number) => (pct / 100) * stageWidthPx;
    const toSvgY = (pct: number) => (pct / 100) * stageHeightPx;
    return `M${toSvgX(ax)},${toSvgY(ay)} Q${toSvgX(cpX)},${toSvgY(cpY)} ${toSvgX(bx)},${toSvgY(by)}`;
  }

  const toSvgX = (pct: number) => (pct / 100) * stageWidthPx;
  const toSvgY = (pct: number) => (pct / 100) * stageHeightPx;
  const R = 8; // dancer circle radius in svg

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
      }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Header */}
      <div
        style={{
          color: "#e2e8f0",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.03em",
        }}
      >
        個人別移動軌道の設定
        <span
          style={{
            fontSize: 11,
            fontWeight: 400,
            color: "#94a3b8",
            marginLeft: 10,
          }}
        >
          ◆ をドラッグして曲線を調整
        </span>
      </div>

      {/* Stage SVG */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}
      >
        <svg
          ref={svgRef}
          width={stageWidthPx}
          height={stageHeightPx}
          viewBox={`0 0 ${stageWidthPx} ${stageHeightPx}`}
          style={{ display: "block", userSelect: "none" }}
        >
          {/* Stage background */}
          <rect width={stageWidthPx} height={stageHeightPx} fill="#0f172a" />
          {/* Center lines */}
          <line
            x1={stageWidthPx / 2} y1={0}
            x2={stageWidthPx / 2} y2={stageHeightPx}
            stroke="#1e293b" strokeWidth={1}
          />
          <line
            x1={0} y1={stageHeightPx / 2}
            x2={stageWidthPx} y2={stageHeightPx / 2}
            stroke="#1e293b" strokeWidth={1}
          />

          {/* For each dancer in prevFormation that also exists in next */}
          {prevFormation.map((a) => {
            const b = nextById.current.get(a.id);
            if (!b) return null;
            const cp = paths[a.id] ?? defaultCp(a.xPct, a.yPct, b.xPct, b.yPct);
            const ax = toSvgX(a.xPct), ay = toSvgY(a.yPct);
            const bx = toSvgX(b.xPct), by = toSvgY(b.yPct);
            const cpx = toSvgX(cp.cpX), cpy = toSvgY(cp.cpY);

            return (
              <g key={a.id}>
                {/* Control lines */}
                <line x1={ax} y1={ay} x2={cpx} y2={cpy} stroke="#475569" strokeWidth={1} strokeDasharray="4,3" />
                <line x1={bx} y1={by} x2={cpx} y2={cpy} stroke="#475569" strokeWidth={1} strokeDasharray="4,3" />

                {/* Bezier path */}
                <path
                  d={bezierD(a.xPct, a.yPct, cp.cpX, cp.cpY, b.xPct, b.yPct)}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  strokeDasharray="6,3"
                />

                {/* Prev position (blue) */}
                <circle cx={ax} cy={ay} r={R} fill="rgba(59,130,246,0.25)" stroke="#3b82f6" strokeWidth={1.5} />
                <text x={ax} y={ay + 1} textAnchor="middle" dominantBaseline="middle" fill="#93c5fd" fontSize={7} fontWeight={700}>
                  {a.label}
                </text>

                {/* Next position (green) */}
                <circle cx={bx} cy={by} r={R} fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth={1.5} />
                <text x={bx} y={by + 1} textAnchor="middle" dominantBaseline="middle" fill="#86efac" fontSize={7} fontWeight={700}>
                  {b.label}
                </text>

                {/* Control point handle (draggable ◆) */}
                <polygon
                  points={`${cpx},${cpy - 9} ${cpx + 9},${cpy} ${cpx},${cpy + 9} ${cpx - 9},${cpy}`}
                  fill="#f59e0b"
                  stroke="#fde68a"
                  strokeWidth={1}
                  style={{ cursor: "grab" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    dragging.current = a.id;
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 11,
          color: "#94a3b8",
          alignItems: "center",
        }}
      >
        <span>
          <svg width={12} height={12} style={{ verticalAlign: "middle", marginRight: 3 }}>
            <circle cx={6} cy={6} r={5} fill="rgba(59,130,246,0.25)" stroke="#3b82f6" strokeWidth={1.5} />
          </svg>
          前フォーメーション
        </span>
        <span>
          <svg width={12} height={12} style={{ verticalAlign: "middle", marginRight: 3 }}>
            <circle cx={6} cy={6} r={5} fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth={1.5} />
          </svg>
          後フォーメーション
        </span>
        <span>
          <svg width={12} height={12} style={{ verticalAlign: "middle", marginRight: 3 }}>
            <polygon points="6,0 12,6 6,12 0,6" fill="#f59e0b" />
          </svg>
          制御点（ドラッグ）
        </span>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: "7px 16px",
            borderRadius: 7,
            border: "1px solid #475569",
            background: "#1e293b",
            color: "#94a3b8",
            fontSize: 12,
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
            padding: "7px 16px",
            borderRadius: 7,
            border: "1px solid #475569",
            background: "#1e293b",
            color: "#cbd5e1",
            fontSize: 12,
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
            padding: "7px 20px",
            borderRadius: 7,
            border: "1px solid rgba(99,102,241,0.8)",
            background: "rgba(99,102,241,0.25)",
            color: "#c7d2fe",
            fontSize: 12,
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

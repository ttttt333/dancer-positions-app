import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ParsedPosition } from "../lib/parsePositionTypes";
import {
  alignPreviewRowY,
  distributePreviewRowX,
  flipPreviewPositions,
  movePreviewPerson,
  nudgePreviewPositions,
  renamePreviewPerson,
  scalePreviewPositions,
} from "../lib/formationImport/previewAdjust";
import { btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";

type Props = {
  positions: ParsedPosition[];
  onChange: (next: ParsedPosition[]) => void;
  rosterHints?: string[];
};

const toolBtn = {
  ...btnSecondary,
  padding: "5px 9px",
  fontSize: 11,
} as const;

function pctFromPointer(
  svg: SVGSVGElement,
  e: ReactPointerEvent<SVGSVGElement>
): { x: number; y: number } {
  const r = svg.getBoundingClientRect();
  const w = r.width || 1;
  const h = r.height || 1;
  return {
    x: ((e.clientX - r.left) / w) * 100,
    y: ((e.clientY - r.top) / h) * 100,
  };
}

export function ParsePositionPreviewEditor({
  positions,
  onChange,
  rosterHints = [],
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const liveRef = useRef(positions);
  liveRef.current = positions;
  const [selected, setSelected] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = index;
    setSelected(index);
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const idx = dragRef.current;
    const svg = svgRef.current;
    if (idx == null || !svg) return;
    const { x, y } = pctFromPointer(svg, e);
    onChange(movePreviewPerson(liveRef.current, idx, x, y));
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current == null) return;
    dragRef.current = null;
    svgRef.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: 11, color: shell.textMuted }}>
        丸をドラッグして位置を直し、下の表で名前を確認できます。
      </p>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        width="100%"
        height={260}
        role="img"
        aria-label="立ち位置プレビュー。丸をドラッグして動かせます"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          display: "block",
          background: "#0a0f1e",
          borderRadius: 8,
          border: "1px solid #334155",
          touchAction: "none",
          cursor: dragRef.current != null ? "grabbing" : "default",
        }}
      >
        <text x="50" y="7" textAnchor="middle" fill="#64748b" fontSize="4.2">
          舞台裏
        </text>
        <text x="50" y="97" textAnchor="middle" fill="#64748b" fontSize="4.2">
          客席
        </text>
        <line
          x1="50"
          y1="10"
          x2="50"
          y2="90"
          stroke="#c41e3a"
          strokeOpacity={0.35}
          strokeWidth={0.4}
        />
        {positions.map((p, i) => {
          const cx = Math.max(4, Math.min(96, p.x));
          const cy = Math.max(8, Math.min(92, p.y));
          const active = selected === i;
          return (
            <g key={`spot-${i}`}>
              <circle
                cx={cx}
                cy={cy}
                r={active ? 4.4 : 3.6}
                fill={active ? "#fde68a" : "#d4af37"}
                stroke={active ? "#fff" : "transparent"}
                strokeWidth={0.6}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => onPointerDown(e, i)}
              />
              <text
                x={cx}
                y={cy + 0.9}
                textAnchor="middle"
                fill="#14100a"
                fontSize="3.2"
                fontWeight={700}
                pointerEvents="none"
              >
                {i + 1}
              </text>
              <text
                x={cx}
                y={cy + 7.2}
                textAnchor="middle"
                fill="#e7e5e4"
                fontSize="3.4"
                pointerEvents="none"
              >
                {p.name || "—"}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 10,
        }}
      >
        <button type="button" style={toolBtn} onClick={() => onChange(scalePreviewPositions(positions, 1.12))}>
          全体を拡大
        </button>
        <button type="button" style={toolBtn} onClick={() => onChange(scalePreviewPositions(positions, 0.88))}>
          全体を縮小
        </button>
        <button type="button" style={toolBtn} onClick={() => onChange(nudgePreviewPositions(positions, -3, 0))}>
          ←
        </button>
        <button type="button" style={toolBtn} onClick={() => onChange(nudgePreviewPositions(positions, 3, 0))}>
          →
        </button>
        <button type="button" style={toolBtn} onClick={() => onChange(nudgePreviewPositions(positions, 0, -3))}>
          奥へ
        </button>
        <button type="button" style={toolBtn} onClick={() => onChange(nudgePreviewPositions(positions, 0, 3))}>
          手前へ
        </button>
        <button type="button" style={toolBtn} onClick={() => onChange(flipPreviewPositions(positions, "x"))}>
          左右反転
        </button>
        <button type="button" style={toolBtn} onClick={() => onChange(flipPreviewPositions(positions, "y"))}>
          前後反転
        </button>
        <button type="button" style={toolBtn} onClick={() => onChange(alignPreviewRowY(positions))}>
          行の前後を揃える
        </button>
        <button type="button" style={toolBtn} onClick={() => onChange(distributePreviewRowX(positions))}>
          行内を横に均等
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          maxHeight: 240,
          overflow: "auto",
          border: "1px solid #334155",
          borderRadius: 8,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ background: "#0f172a", color: "#94a3b8" }}>
              <th style={{ textAlign: "left", padding: "8px 10px" }}>#</th>
              <th style={{ textAlign: "left", padding: "8px 10px" }}>名前</th>
              <th style={{ textAlign: "center", padding: "8px 6px" }}>確度</th>
              <th style={{ textAlign: "right", padding: "8px 10px" }}>X%</th>
              <th style={{ textAlign: "right", padding: "8px 10px" }}>Y%</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <tr
                key={`row-${i}`}
                onClick={() => setSelected(i)}
                style={{
                  borderTop: "1px solid #1e293b",
                  background: selected === i ? "rgba(212,175,55,0.08)" : undefined,
                  cursor: "pointer",
                }}
              >
                <td style={{ padding: "6px 10px", color: "#64748b" }}>{i + 1}</td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    list="parse-position-name-hints"
                    value={p.name}
                    aria-label={`${i + 1}人目の名前`}
                    onChange={(e) =>
                      onChange(renamePreviewPerson(positions, i, e.target.value))
                    }
                    onFocus={() => setSelected(i)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "5px 8px",
                      borderRadius: 6,
                      border: `1px solid ${selected === i ? "#d4af37" : "#334155"}`,
                      background: "#0a0f1e",
                      color: shell.text,
                      fontSize: 12,
                    }}
                  />
                </td>
                <td
                  style={{
                    padding: "6px 6px",
                    textAlign: "center",
                    color: p.confidence === "low" ? "#fbbf24" : "#64748b",
                    fontSize: 11,
                  }}
                >
                  {p.confidence === "low"
                    ? p.rosterMatched
                      ? "名寄せ"
                      : rosterHints.length > 0
                        ? "未確定"
                        : "推測"
                    : "—"}
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>
                  {p.x.toFixed(1)}
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>
                  {p.y.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rosterHints.length > 0 ? (
          <datalist id="parse-position-name-hints">
            {rosterHints.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        ) : null}
      </div>
    </div>
  );
}

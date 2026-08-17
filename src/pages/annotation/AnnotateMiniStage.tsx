import { useRef, useState, type CSSProperties } from "react";
import { DANCER_COLOR_PALETTE_HEX, modDancerColorIndex } from "../../lib/dancerColorPalette";
import { btnSecondary } from "../../components/stageButtonStyles";
import { shell } from "../../theme/choreoShell";
import { ANNOTATE_PRESETS, STAGE_SIZE_M, layoutPreset, resizeLayout, type AnnotateSpot } from "./annotateLayouts";

const CENTER_X = 50;
const HESO_Y = 50;

const floor: CSSProperties = {
  position: "relative",
  width: "min(100%, 70vh, 640px)",
  aspectRatio: "1 / 1",
  borderRadius: 12,
  background: "linear-gradient(180deg, #1a1814 0%, #0c0b09 55%, #16120e 100%)",
  border: `1px solid ${shell.borderStrong}`,
  touchAction: "none",
  overflow: "hidden",
  cursor: "grab",
  margin: "0 auto",
};

function clampPct(n: number): number {
  return Math.min(97, Math.max(3, n));
}

function fromCenterM(pct: number): number {
  return ((pct - 50) / 100) * STAGE_SIZE_M;
}

function baMmLabel(xPct: number, yPct: number): string {
  const x = fromCenterM(xPct);
  const y = fromCenterM(yPct);
  const lr = Math.abs(x) < 0.05 ? "センター" : x > 0 ? `右 ${Math.abs(x).toFixed(1)}m` : `左 ${Math.abs(x).toFixed(1)}m`;
  const fb = Math.abs(y) < 0.05 ? "ヘソ" : y > 0 ? `前 ${Math.abs(y).toFixed(1)}m` : `奥 ${Math.abs(y).toFixed(1)}m`;
  return `${lr}　${fb}`;
}

const GRID_IDS = Array.from({ length: STAGE_SIZE_M + 1 }, (_, i) => i);

type DragState = {
  mode: "one" | "all";
  id: string;
  startX: number;
  startY: number;
  origin: AnnotateSpot[];
};

type Props = {
  positions: AnnotateSpot[];
  formationType: string;
  onChange: (next: { positions: AnnotateSpot[]; formationType: string }) => void;
  onCopyPrevious?: () => void;
  canCopyPrevious?: boolean;
};

export function AnnotateMiniStage({ positions, formationType, onChange, onCopyPrevious, canCopyPrevious }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [groupSelected, setGroupSelected] = useState(false);
  const count = Math.max(1, positions.length || 8);

  const clientToPct = (clientX: number, clientY: number) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return { xPct: 50, yPct: 50 };
    return {
      xPct: clampPct(((clientX - box.left) / box.width) * 100),
      yPct: clampPct(((clientY - box.top) / box.height) * 100),
    };
  };

  const applyDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const now = clientToPct(clientX, clientY);
    const dx = now.xPct - drag.startX;
    const dy = now.yPct - drag.startY;
    if (drag.mode === "one") {
      onChange({
        formationType: formationType || "CUSTOM",
        positions: drag.origin.map((p) => (p.id === drag.id ? { ...p, xPct: clampPct(p.xPct + dx), yPct: clampPct(p.yPct + dy) } : p)),
      });
      return;
    }
    const minDx = Math.max(...drag.origin.map((p) => 3 - p.xPct));
    const maxDx = Math.min(...drag.origin.map((p) => 97 - p.xPct));
    const minDy = Math.max(...drag.origin.map((p) => 3 - p.yPct));
    const maxDy = Math.min(...drag.origin.map((p) => 97 - p.yPct));
    const gx = Math.min(maxDx, Math.max(minDx, dx));
    const gy = Math.min(maxDy, Math.max(minDy, dy));
    onChange({
      formationType: formationType || "CUSTOM",
      positions: drag.origin.map((p) => ({ ...p, xPct: clampPct(p.xPct + gx), yPct: clampPct(p.yPct + gy) })),
    });
  };

  const startDrag = (id: string, clientX: number, clientY: number, all: boolean) => {
    const { xPct, yPct } = clientToPct(clientX, clientY);
    dragRef.current = {
      mode: all ? "all" : "one",
      id,
      startX: xPct,
      startY: yPct,
      origin: positions.map((p) => ({ ...p })),
    };
    applyDrag(clientX, clientY);
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: shell.textSubtle }}>人数</span>
        <button
          type="button"
          style={{ ...btnSecondary, padding: "3px 8px" }}
          onClick={() => onChange({ formationType, positions: resizeLayout(positions, count - 1) })}
          disabled={count <= 1}
        >
          −
        </button>
        <strong style={{ minWidth: 18, textAlign: "center", fontSize: 13 }}>{count}</strong>
        <button
          type="button"
          style={{ ...btnSecondary, padding: "3px 8px" }}
          onClick={() => onChange({ formationType, positions: resizeLayout(positions, count + 1) })}
          disabled={count >= 16}
        >
          ＋
        </button>
        <button
          type="button"
          style={{
            ...btnSecondary,
            padding: "3px 8px",
            background: groupSelected ? shell.accentSoft : btnSecondary.backgroundColor,
            borderColor: groupSelected ? shell.accent : shell.borderStrong,
          }}
          onClick={() => setGroupSelected((v) => !v)}
        >
          {groupSelected ? "全員選択中" : "全員を選択"}
        </button>
        {onCopyPrevious ? (
          <button type="button" style={{ ...btnSecondary, padding: "3px 8px" }} disabled={!canCopyPrevious} onClick={onCopyPrevious}>
            前のキューからコピー
          </button>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {ANNOTATE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            style={{
              ...btnSecondary,
              padding: "4px 8px",
              fontSize: 11,
              background: formationType === preset.id ? shell.accentSoft : btnSecondary.backgroundColor,
              borderColor: formationType === preset.id ? shell.accent : shell.borderStrong,
            }}
            onClick={() => {
              setGroupSelected(false);
              onChange({ formationType: preset.id, positions: layoutPreset(preset.id, count) });
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div
        ref={stageRef}
        style={floor}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          applyDrag(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerLeave={() => {
          if (!dragRef.current) return;
          dragRef.current = null;
        }}
        onDoubleClick={() => setGroupSelected(true)}
        onClick={(e) => {
          if (e.target === stageRef.current) setGroupSelected(false);
        }}
      >
        <svg
          viewBox={`0 0 ${STAGE_SIZE_M} ${STAGE_SIZE_M}`}
          preserveAspectRatio="none"
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
        >
          {GRID_IDS.map((m) => (
            <line
              key={`v-${m}`}
              x1={m}
              y1={0}
              x2={m}
              y2={STAGE_SIZE_M}
              stroke={m === STAGE_SIZE_M / 2 ? shell.accent : "rgba(250,247,240,0.16)"}
              strokeWidth={m === STAGE_SIZE_M / 2 ? 1.5 : 1}
              strokeDasharray={m === STAGE_SIZE_M / 2 ? "5 4" : "4 4"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {GRID_IDS.map((m) => (
            <line
              key={`h-${m}`}
              x1={0}
              y1={m}
              x2={STAGE_SIZE_M}
              y2={m}
              stroke={m === STAGE_SIZE_M / 2 ? "rgba(248,250,252,0.7)" : "rgba(250,247,240,0.16)"}
              strokeWidth={m === STAGE_SIZE_M / 2 ? 1.5 : 1}
              strokeDasharray={m === STAGE_SIZE_M / 2 ? "5 4" : "4 4"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <span
          style={{
            position: "absolute",
            top: 6,
            left: `calc(${CENTER_X}% + 6px)`,
            fontSize: 10,
            color: shell.accent,
            pointerEvents: "none",
            zIndex: 1,
            letterSpacing: "0.08em",
          }}
        >
          センター
        </span>
        <span
          style={{
            position: "absolute",
            top: `calc(${HESO_Y}% + 4px)`,
            left: 8,
            fontSize: 10,
            color: "rgba(248,250,252,0.7)",
            pointerEvents: "none",
            zIndex: 1,
            letterSpacing: "0.08em",
          }}
        >
          ヘソ
        </span>
        <span style={{ position: "absolute", top: 8, left: 12, fontSize: 11, color: shell.textSubtle, zIndex: 1 }}>奥</span>
        <span style={{ position: "absolute", top: 8, right: 12, fontSize: 10, color: shell.textSubtle, zIndex: 1 }}>
          {STAGE_SIZE_M}m × {STAGE_SIZE_M}m
        </span>
        <span
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 11,
            letterSpacing: "0.18em",
            color: "#1c1917",
            background: "linear-gradient(180deg, rgba(212,175,55,0.55), rgba(212,175,55,0.82))",
            padding: "3px 0 5px",
            zIndex: 1,
          }}
        >
          客席
        </span>
        {positions.map((spot, i) => {
          const color = DANCER_COLOR_PALETTE_HEX[modDancerColorIndex(i)]!;
          return (
            <button
              key={spot.id}
              type="button"
              aria-label={`ダンサー ${i + 1} ${baMmLabel(spot.xPct, spot.yPct)}`}
              style={{
                position: "absolute",
                left: `${spot.xPct}%`,
                top: `${spot.yPct}%`,
                width: 28,
                height: 28,
                marginLeft: -14,
                marginTop: -14,
                borderRadius: "50%",
                border: groupSelected ? `2px solid ${shell.accent}` : "2px solid #fff",
                background: color,
                color: "#111",
                fontWeight: 700,
                fontSize: 11,
                cursor: groupSelected ? "move" : "grab",
                touchAction: "none",
                boxShadow: groupSelected ? `0 0 0 3px ${shell.accentSoft}` : "0 2px 8px rgba(0,0,0,0.45)",
                zIndex: 2,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                startDrag(spot.id, e.clientX, e.clientY, groupSelected);
              }}
              onPointerMove={(e) => {
                if (!dragRef.current) return;
                applyDrag(e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setGroupSelected(true);
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p style={{ margin: "6px 0 8px", fontSize: 11, color: shell.textSubtle }}>
        ダブルクリックで全員選択 → ドラッグで全体移動。場は {STAGE_SIZE_M}m × {STAGE_SIZE_M}m、点線は 1m ごと。金がセンター、横の明るい線がヘソです。
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
          gap: 4,
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          color: shell.textMuted,
        }}
      >
        {positions.map((spot, i) => (
          <div key={spot.id} style={{ background: shell.bgChrome, borderRadius: 6, padding: "4px 6px", border: `1px solid ${shell.border}` }}>
            {i + 1}　{baMmLabel(spot.xPct, spot.yPct)}
          </div>
        ))}
      </div>
    </div>
  );
}

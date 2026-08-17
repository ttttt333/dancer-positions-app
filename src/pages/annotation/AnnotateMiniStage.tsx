import { useRef, useState, type CSSProperties } from "react";
import { DANCER_COLOR_PALETTE_HEX, modDancerColorIndex } from "../../lib/dancerColorPalette";
import { btnSecondary } from "../../components/stageButtonStyles";
import { shell } from "../../theme/choreoShell";
import { ANNOTATE_PRESETS, layoutPreset, resizeLayout, type AnnotateSpot } from "./annotateLayouts";

const CENTER_X = 50;
const HESO_Y = 50;

const floor: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 10",
  borderRadius: 12,
  background: "linear-gradient(180deg, #1a1814 0%, #0c0b09 55%, #16120e 100%)",
  border: `1px solid ${shell.borderStrong}`,
  touchAction: "none",
  overflow: "hidden",
  cursor: "grab",
};

function clampPct(n: number): number {
  return Math.min(94, Math.max(6, n));
}

function fmt(n: number): string {
  return n.toFixed(1);
}

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
    const minDx = Math.max(...drag.origin.map((p) => 6 - p.xPct));
    const maxDx = Math.min(...drag.origin.map((p) => 94 - p.xPct));
    const minDy = Math.max(...drag.origin.map((p) => 6 - p.yPct));
    const maxDy = Math.min(...drag.origin.map((p) => 94 - p.yPct));
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
        <span
          style={{
            position: "absolute",
            left: `${CENTER_X}%`,
            top: 0,
            bottom: 22,
            width: 0,
            borderLeft: `1px dashed ${shell.accent}`,
            opacity: 0.7,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
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
            top: `${HESO_Y}%`,
            left: 0,
            right: 0,
            height: 0,
            borderTop: `1px dashed rgba(248,250,252,0.55)`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
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
              aria-label={`ダンサー ${i + 1} x${fmt(spot.xPct)} y${fmt(spot.yPct)}`}
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
        ダブルクリックで全員選択 → そのままドラッグで全体移動。金の点線がセンター、白い横線がヘソです。
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
          gap: 4,
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          color: shell.textMuted,
        }}
      >
        {positions.map((spot, i) => (
          <div key={spot.id} style={{ background: shell.bgChrome, borderRadius: 6, padding: "4px 6px", border: `1px solid ${shell.border}` }}>
            {i + 1}　X {fmt(spot.xPct)}　Y {fmt(spot.yPct)}
          </div>
        ))}
      </div>
    </div>
  );
}

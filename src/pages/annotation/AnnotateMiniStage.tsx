import { useRef, type CSSProperties } from "react";
import { DANCER_COLOR_PALETTE_HEX, modDancerColorIndex } from "../../lib/dancerColorPalette";
import { btnSecondary } from "../../components/stageButtonStyles";
import { shell } from "../../theme/choreoShell";
import { ANNOTATE_PRESETS, layoutPreset, resizeLayout, type AnnotateSpot } from "./annotateLayouts";

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

type Props = {
  positions: AnnotateSpot[];
  formationType: string;
  onChange: (next: { positions: AnnotateSpot[]; formationType: string }) => void;
  onCopyPrevious?: () => void;
  canCopyPrevious?: boolean;
};

export function AnnotateMiniStage({ positions, formationType, onChange, onCopyPrevious, canCopyPrevious }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragId = useRef<string | null>(null);
  const count = Math.max(1, positions.length || 8);

  const clientToPct = (clientX: number, clientY: number) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return { xPct: 50, yPct: 50 };
    return {
      xPct: clampPct(((clientX - box.left) / box.width) * 100),
      yPct: clampPct(((clientY - box.top) / box.height) * 100),
    };
  };

  const moveSpot = (id: string, clientX: number, clientY: number) => {
    const { xPct, yPct } = clientToPct(clientX, clientY);
    onChange({
      formationType: formationType || "CUSTOM",
      positions: positions.map((p) => (p.id === id ? { ...p, xPct, yPct } : p)),
    });
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: shell.textSubtle }}>人数</span>
        <button
          type="button"
          style={{ ...btnSecondary, padding: "4px 10px" }}
          onClick={() => onChange({ formationType, positions: resizeLayout(positions, count - 1) })}
          disabled={count <= 1}
        >
          −
        </button>
        <strong style={{ minWidth: 18, textAlign: "center", fontSize: 13 }}>{count}</strong>
        <button
          type="button"
          style={{ ...btnSecondary, padding: "4px 10px" }}
          onClick={() => onChange({ formationType, positions: resizeLayout(positions, count + 1) })}
          disabled={count >= 16}
        >
          ＋
        </button>
        {onCopyPrevious ? (
          <button type="button" style={{ ...btnSecondary, padding: "4px 10px" }} disabled={!canCopyPrevious} onClick={onCopyPrevious}>
            前のキューからコピー
          </button>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {ANNOTATE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            style={{
              ...btnSecondary,
              padding: "5px 10px",
              fontSize: 12,
              background: formationType === preset.id ? shell.accentSoft : btnSecondary.backgroundColor,
              borderColor: formationType === preset.id ? shell.accent : shell.borderStrong,
            }}
            onClick={() => onChange({ formationType: preset.id, positions: layoutPreset(preset.id, count) })}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div
        ref={stageRef}
        style={floor}
        onPointerMove={(e) => {
          if (!dragId.current) return;
          moveSpot(dragId.current, e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          dragId.current = null;
        }}
        onPointerLeave={() => {
          dragId.current = null;
        }}
      >
        <span style={{ position: "absolute", top: 8, left: 12, fontSize: 11, color: shell.textSubtle }}>奥</span>
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
            padding: "4px 0 6px",
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
              aria-label={`ダンサー ${i + 1}`}
              style={{
                position: "absolute",
                left: `${spot.xPct}%`,
                top: `${spot.yPct}%`,
                width: 30,
                height: 30,
                marginLeft: -15,
                marginTop: -15,
                borderRadius: "50%",
                border: "2px solid #fff",
                background: color,
                color: "#111",
                fontWeight: 700,
                fontSize: 12,
                cursor: "grab",
                touchAction: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
                zIndex: 2,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragId.current = spot.id;
                (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                moveSpot(spot.id, e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (dragId.current !== spot.id) return;
                moveSpot(spot.id, e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                dragId.current = null;
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: shell.textSubtle }}>
        ひな形を置いてから印をドラッグし、自分ならこう置く形に直してください。ドラッグした座標が保存されます。上の名前は近い形の分類です。
      </p>
    </div>
  );
}

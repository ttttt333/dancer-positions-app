import { useRef, useState, type CSSProperties } from "react";
import { DANCER_COLOR_PALETTE_HEX, modDancerColorIndex } from "../../lib/dancerColorPalette";
import { btnSecondary } from "../../components/stageButtonStyles";
import { shell } from "../../theme/choreoShell";
import { ANNOTATE_PRESETS, STAGE_SIZE_M, layoutPreset, resizeLayout, type AnnotateSpot } from "./annotateLayouts";

const CENTER_X = 50;
const HESO_Y = 50;
const DRAG_PX = 5;

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

function clamp01(n: number): number {
  return Math.min(100, Math.max(0, n));
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

function rangeIds(positions: AnnotateSpot[], a: string, b: string): string[] {
  const i0 = positions.findIndex((p) => p.id === a);
  const i1 = positions.findIndex((p) => p.id === b);
  if (i0 < 0 || i1 < 0) return [b];
  const lo = Math.min(i0, i1);
  const hi = Math.max(i0, i1);
  return positions.slice(lo, hi + 1).map((p) => p.id);
}

const GRID_IDS = Array.from({ length: STAGE_SIZE_M + 1 }, (_, i) => i);

type DragState =
  | {
      kind: "move";
      ids: string[];
      startX: number;
      startY: number;
      origin: AnnotateSpot[];
    }
  | {
      kind: "marquee";
      startX: number;
      startY: number;
    }
  | {
      kind: "pending";
      id: string;
      clientX: number;
      clientY: number;
      startX: number;
      startY: number;
      selectMode: "replace" | "toggle" | "range";
    };

export type CopyCueOption = { id: string; label: string };

type Props = {
  positions: AnnotateSpot[];
  formationType: string;
  onChange: (next: { positions: AnnotateSpot[]; formationType: string }) => void;
  copyPrevId?: string | null;
  copyNextId?: string | null;
  copySources?: CopyCueOption[];
  onCopyFrom?: (id: string) => void;
};

export function AnnotateMiniStage({
  positions,
  formationType,
  onChange,
  copyPrevId,
  copyNextId,
  copySources = [],
  onCopyFrom,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const count = Math.max(1, positions.length || 8);
  const selected = new Set(selectedIds);

  const clientToPct = (clientX: number, clientY: number, clamp = true) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return { xPct: 50, yPct: 50 };
    const xPct = ((clientX - box.left) / box.width) * 100;
    const yPct = ((clientY - box.top) / box.height) * 100;
    return clamp ? { xPct: clampPct(xPct), yPct: clampPct(yPct) } : { xPct: clamp01(xPct), yPct: clamp01(yPct) };
  };

  const applyMove = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "move") return;
    const now = clientToPct(clientX, clientY);
    const dx = now.xPct - drag.startX;
    const dy = now.yPct - drag.startY;
    const ids = new Set(drag.ids);
    const group = drag.origin.filter((p) => ids.has(p.id));
    if (group.length === 0) return;
    const minDx = Math.max(...group.map((p) => 3 - p.xPct));
    const maxDx = Math.min(...group.map((p) => 97 - p.xPct));
    const minDy = Math.max(...group.map((p) => 3 - p.yPct));
    const maxDy = Math.min(...group.map((p) => 97 - p.yPct));
    const gx = Math.min(maxDx, Math.max(minDx, dx));
    const gy = Math.min(maxDy, Math.max(minDy, dy));
    onChange({
      formationType: formationType || "CUSTOM",
      positions: drag.origin.map((p) => (ids.has(p.id) ? { ...p, xPct: clampPct(p.xPct + gx), yPct: clampPct(p.yPct + gy) } : p)),
    });
  };

  const beginMove = (ids: string[], clientX: number, clientY: number) => {
    const { xPct, yPct } = clientToPct(clientX, clientY);
    dragRef.current = {
      kind: "move",
      ids,
      startX: xPct,
      startY: yPct,
      origin: positions.map((p) => ({ ...p })),
    };
    applyMove(clientX, clientY);
  };

  const selectByClick = (id: string, shift: boolean, meta: boolean) => {
    if (shift && anchorId) {
      const ids = rangeIds(positions, anchorId, id);
      setSelectedIds(ids);
      return;
    }
    if (meta) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      setAnchorId(id);
      return;
    }
    if (selectedIds.length === 1 && selectedIds[0] !== id) {
      setSelectedIds(rangeIds(positions, selectedIds[0]!, id));
      return;
    }
    setSelectedIds([id]);
    setAnchorId(id);
  };

  const finishPending = (e: { clientX: number; clientY: number }) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pending") {
      const dist = Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY);
      if (dist < DRAG_PX) {
        selectByClick(drag.id, drag.selectMode === "range", drag.selectMode === "toggle");
      }
    }
    if (drag.kind === "marquee" && marquee) {
      const x0 = Math.min(marquee.x0, marquee.x1);
      const x1 = Math.max(marquee.x0, marquee.x1);
      const y0 = Math.min(marquee.y0, marquee.y1);
      const y1 = Math.max(marquee.y0, marquee.y1);
      if (x1 - x0 > 1 && y1 - y0 > 1) {
        setSelectedIds(positions.filter((p) => p.xPct >= x0 && p.xPct <= x1 && p.yPct >= y0 && p.yPct <= y1).map((p) => p.id));
      } else {
        setSelectedIds([]);
        setAnchorId(null);
      }
    }
    dragRef.current = null;
    setMarquee(null);
  };

  const selectedSpots = positions.filter((p) => selected.has(p.id));
  const bounds =
    selectedSpots.length > 0
      ? {
          x0: Math.min(...selectedSpots.map((p) => p.xPct)),
          y0: Math.min(...selectedSpots.map((p) => p.yPct)),
          x1: Math.max(...selectedSpots.map((p) => p.xPct)),
          y1: Math.max(...selectedSpots.map((p) => p.yPct)),
        }
      : null;

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
            background: selectedIds.length === count ? shell.accentSoft : btnSecondary.backgroundColor,
            borderColor: selectedIds.length === count ? shell.accent : shell.borderStrong,
          }}
          onClick={() => {
            if (selectedIds.length === count) {
              setSelectedIds([]);
              setAnchorId(null);
            } else {
              setSelectedIds(positions.map((p) => p.id));
              setAnchorId(positions[0]?.id ?? null);
            }
          }}
        >
          {selectedIds.length === count ? "選択解除" : "全員を選択"}
        </button>
        {selectedIds.length > 0 ? (
          <span style={{ fontSize: 11, color: shell.ruby }}>
            {selectedIds.length}人選択中 · ドラッグでまとめて移動
          </span>
        ) : null}
        {onCopyFrom ? (
          <>
            <button
              type="button"
              style={{ ...btnSecondary, padding: "3px 8px" }}
              disabled={!copyPrevId}
              onClick={() => copyPrevId && onCopyFrom(copyPrevId)}
            >
              前のキューからコピー
            </button>
            <button
              type="button"
              style={{ ...btnSecondary, padding: "3px 8px" }}
              disabled={!copyNextId}
              onClick={() => copyNextId && onCopyFrom(copyNextId)}
            >
              次のキューからコピー
            </button>
            {copySources.length > 0 ? (
              <select
                style={{
                  ...btnSecondary,
                  padding: "3px 8px",
                  fontSize: 12,
                  minWidth: 160,
                }}
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) onCopyFrom(id);
                }}
              >
                <option value="">他のキューからコピー</option>
                {copySources.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.label}
                  </option>
                ))}
              </select>
            ) : null}
          </>
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
              setSelectedIds([]);
              setAnchorId(null);
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
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-dancer]")) return;
          const { xPct, yPct } = clientToPct(e.clientX, e.clientY, false);
          dragRef.current = { kind: "marquee", startX: xPct, startY: yPct };
          setMarquee({ x0: xPct, y0: yPct, x1: xPct, y1: yPct });
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          if (drag.kind === "pending") {
            const dist = Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY);
            if (dist < DRAG_PX) return;
            const ids = selected.has(drag.id) && selectedIds.length > 0 ? selectedIds : [drag.id];
            if (!selected.has(drag.id)) {
              setSelectedIds(ids);
              setAnchorId(drag.id);
            }
            beginMove(ids, drag.clientX, drag.clientY);
            applyMove(e.clientX, e.clientY);
            return;
          }
          if (drag.kind === "marquee") {
            const now = clientToPct(e.clientX, e.clientY, false);
            setMarquee({ x0: drag.startX, y0: drag.startY, x1: now.xPct, y1: now.yPct });
            return;
          }
          applyMove(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => finishPending(e)}
        onPointerCancel={(e) => finishPending(e)}
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
        {bounds ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${bounds.x0}%`,
              top: `${bounds.y0}%`,
              width: `${Math.max(0.5, bounds.x1 - bounds.x0)}%`,
              height: `${Math.max(0.5, bounds.y1 - bounds.y0)}%`,
              marginLeft: -18,
              marginTop: -18,
              paddingRight: 36,
              paddingBottom: 36,
              border: `1.5px dashed ${shell.ruby}`,
              borderRadius: 6,
              background: "rgba(196,30,58,0.06)",
              pointerEvents: "none",
              zIndex: 2,
              boxSizing: "content-box",
            }}
          />
        ) : null}
        {marquee ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${Math.min(marquee.x0, marquee.x1)}%`,
              top: `${Math.min(marquee.y0, marquee.y1)}%`,
              width: `${Math.abs(marquee.x1 - marquee.x0)}%`,
              height: `${Math.abs(marquee.y1 - marquee.y0)}%`,
              border: `1px dashed ${shell.ruby}`,
              background: "rgba(196,30,58,0.12)",
              pointerEvents: "none",
              zIndex: 4,
            }}
          />
        ) : null}
        {positions.map((spot, i) => {
          const color = DANCER_COLOR_PALETTE_HEX[modDancerColorIndex(i)]!;
          const on = selected.has(spot.id);
          return (
            <button
              key={spot.id}
              type="button"
              data-dancer={spot.id}
              aria-label={`ダンサー ${i + 1} ${baMmLabel(spot.xPct, spot.yPct)}`}
              aria-pressed={on}
              style={{
                position: "absolute",
                left: `${spot.xPct}%`,
                top: `${spot.yPct}%`,
                width: 28,
                height: 28,
                marginLeft: -14,
                marginTop: -14,
                borderRadius: "50%",
                border: on ? `2px solid ${shell.ruby}` : "2px solid #fff",
                background: color,
                color: "#111",
                fontWeight: 700,
                fontSize: 11,
                cursor: on ? "move" : "pointer",
                touchAction: "none",
                boxShadow: on ? `0 0 0 3px ${shell.rubySoft}` : "0 2px 8px rgba(0,0,0,0.45)",
                zIndex: 3,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const { xPct, yPct } = clientToPct(e.clientX, e.clientY);
                const selectMode = e.shiftKey ? "range" : e.metaKey || e.ctrlKey ? "toggle" : "replace";
                if (selectMode === "range" && anchorId) {
                  setSelectedIds(rangeIds(positions, anchorId, spot.id));
                }
                dragRef.current = {
                  kind: "pending",
                  id: spot.id,
                  clientX: e.clientX,
                  clientY: e.clientY,
                  startX: xPct,
                  startY: yPct,
                  selectMode,
                };
                (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const drag = dragRef.current;
                if (!drag) return;
                if (drag.kind === "pending") {
                  const dist = Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY);
                  if (dist < DRAG_PX) return;
                  const ids = selected.has(drag.id) && selectedIds.length > 1 ? selectedIds : [drag.id];
                  beginMove(ids, drag.clientX, drag.clientY);
                }
                applyMove(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => finishPending(e)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p style={{ margin: "6px 0 8px", fontSize: 11, color: shell.textSubtle }}>
        メンバーをクリックして選択。もう一人をクリックすると番号の間が範囲選択されます。空いている場をドラッグすると囲って選べます。選んだ人はまとめて移動できます。
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
          <button
            key={spot.id}
            type="button"
            onClick={() => selectByClick(spot.id, false, false)}
            style={{
              background: selected.has(spot.id) ? "rgba(196,30,58,0.16)" : shell.bgChrome,
              borderRadius: 6,
              padding: "4px 6px",
              border: `1px solid ${selected.has(spot.id) ? shell.ruby : shell.border}`,
              color: shell.textMuted,
              textAlign: "left",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            {i + 1}　{baMmLabel(spot.xPct, spot.yPct)}
          </button>
        ))}
      </div>
    </div>
  );
}

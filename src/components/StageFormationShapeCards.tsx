import type { CSSProperties } from "react";
import {
  generateCircleSlots,
  generateDiagonalSlots,
  generateShapeSlots,
  generateTriangleSlots,
  generateWSlots,
  SHAPE_CIRCLE_BBOX,
  SHAPE_DIAGONAL_BBOX,
  SHAPE_TRIANGLE_BBOX,
  SHAPE_W_BBOX,
  STAGE_SHAPE_PRESETS,
  type StageShapePresetId,
} from "../lib/stageShapeGenerator";
import type { StagePosPct } from "../lib/stageEffectivePosition";

const VB_W = 100;
const VB_H = 78;
const PAD = 12;

export function shapeCardDots(slots: readonly StagePosPct[]): {
  cx: number;
  cy: number;
}[] {
  if (slots.length === 0) return [];
  const xs = slots.map((s) => s.xPct);
  const ys = slots.map((s) => s.yPct);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(8, maxX - minX);
  const spanY = Math.max(8, maxY - minY);
  const innerW = VB_W - PAD * 2;
  const innerH = VB_H - PAD * 2 - 4;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const usedW = spanX * scale;
  const usedH = spanY * scale;
  const ox = PAD + (innerW - usedW) / 2;
  const oy = PAD + (innerH - usedH) / 2;
  return slots.map((s) => ({
    cx: ox + (s.xPct - minX) * scale,
    cy: oy + (s.yPct - minY) * scale,
  }));
}

/** カード専用。場ミリは使わない（clamp 重なりで描画が落ちないようにする） */
function schematicFallback(
  n: number,
  presetId: StageShapePresetId
): StagePosPct[] {
  if (n <= 0) return [];
  const geom = (bbox: {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  }) => ({ ...bbox, minSpacingPct: 8 });
  if (presetId === "line") {
    return Array.from({ length: n }, (_, i) => ({
      xPct: n === 1 ? 50 : 12 + (i * 76) / (n - 1),
      yPct: 50,
    }));
  }
  if (presetId === "line_vertical") {
    return Array.from({ length: n }, (_, i) => ({
      xPct: 50,
      yPct: n === 1 ? 50 : 18 + (i * 64) / (n - 1),
    }));
  }
  if (presetId === "w") return generateWSlots(n, geom(SHAPE_W_BBOX));
  if (presetId === "circle") return generateCircleSlots(n, geom(SHAPE_CIRCLE_BBOX));
  if (presetId === "triangle") {
    return generateTriangleSlots(n, geom(SHAPE_TRIANGLE_BBOX));
  }
  if (presetId === "diagonal") {
    return generateDiagonalSlots(n, geom(SHAPE_DIAGONAL_BBOX));
  }
  const slots: StagePosPct[] = [];
  const odd = n % 2 === 1;
  const rows = odd ? (n + 1) / 2 : n / 2;
  const gaps = Math.max(1, rows - 1);
  for (let r = 0; r < rows; r++) {
    const t = rows === 1 ? 0 : r / gaps;
    const y = 72 - t * 40;
    const half = (odd ? 0 : 6) + t * 28;
    if (odd && r === 0) {
      slots.push({ xPct: 50, yPct: y });
    } else {
      slots.push({ xPct: 50 - half, yPct: y });
      slots.push({ xPct: 50 + half, yPct: y });
    }
  }
  return slots.slice(0, n);
}

export function safeShapeCardSlots(
  n: number,
  presetId: StageShapePresetId
): StagePosPct[] {
  try {
    return generateShapeSlots(n, presetId);
  } catch {
    return schematicFallback(n, presetId);
  }
}

const cardBtn: CSSProperties = {
  flex: "0 0 auto",
  width: 96,
  minWidth: 96,
  maxWidth: 96,
  padding: "8px 6px 7px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#e2e8f0",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
};

export type StageFormationShapeCardsProps = {
  selectedCount: number;
  onPick: (presetId: StageShapePresetId) => void;
  activePresetId?: StageShapePresetId | null;
};

/**
 * FORMATION SHAPE のカード。ドット数＝現在の選択人数。
 * サムネは generateShapeSlots の既定形状。場ミリは渡さない（描画で throw しない）。
 */
export function StageFormationShapeCards({
  selectedCount,
  onPick,
  activePresetId = null,
}: StageFormationShapeCardsProps) {
  const n = Math.max(1, selectedCount);
  const r = n >= 9 ? 2.4 : n >= 6 ? 2.8 : 3.2;

  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div
        data-formation-shape-cards
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
          flexWrap: "nowrap",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 6,
        }}
      >
        {STAGE_SHAPE_PRESETS.map((preset) => {
          const slots = safeShapeCardSlots(n, preset.id);
          const dots = shapeCardDots(slots);
          const active = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              data-shape-preset={preset.id}
              data-shape-dot-count={dots.length}
              title={
                preset.id === "circle" && n <= 3
                  ? `${preset.label}（${n}人では円周上の${n}点）`
                  : `${preset.label}（${n}人）のプレビュー`
              }
              onClick={() => onPick(preset.id)}
              style={{
                ...cardBtn,
                borderColor: active ? "rgba(251,191,36,0.9)" : "#334155",
              }}
            >
              <svg
                width="100%"
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                aria-hidden
                style={{ display: "block", maxHeight: 72 }}
              >
                {dots.map((d, i) => (
                  <circle
                    key={`${preset.id}-dot-${i}`}
                    cx={d.cx}
                    cy={d.cy}
                    r={r}
                    fill="#e2e8f0"
                  />
                ))}
              </svg>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: "#cbd5e1",
                }}
              >
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
      {n <= 3 ? (
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            color: "#94a3b8",
            lineHeight: 1.4,
          }}
        >
          3人では円形は円周上の3点になります
        </div>
      ) : null}
    </div>
  );
}

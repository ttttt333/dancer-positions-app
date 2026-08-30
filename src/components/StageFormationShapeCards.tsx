import type { CSSProperties } from "react";
import {
  generateShapeSlots,
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
  flex: "1 1 0",
  minWidth: 88,
  maxWidth: 120,
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
};

/**
 * FORMATION SHAPE の3カード。ドット数＝現在の選択人数。
 * サムネは generateShapeSlots の既定形状。場ミリは渡さない（描画で throw しない）。
 */
export function StageFormationShapeCards({
  selectedCount,
  onPick,
}: StageFormationShapeCardsProps) {
  const n = Math.max(1, selectedCount);
  const r = n >= 9 ? 2.4 : n >= 6 ? 2.8 : 3.2;

  return (
    <div
      data-formation-shape-cards
      style={{
        display: "flex",
        gap: 8,
        alignItems: "stretch",
        justifyContent: "center",
        flexWrap: "nowrap",
      }}
    >
      {STAGE_SHAPE_PRESETS.map((preset) => {
        const slots = safeShapeCardSlots(n, preset.id);
        const dots = shapeCardDots(slots);
        return (
          <button
            key={preset.id}
            type="button"
            data-shape-preset={preset.id}
            data-shape-dot-count={dots.length}
            title={`${preset.label}（${n}人）のプレビュー`}
            onClick={() => onPick(preset.id)}
            style={cardBtn}
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
  );
}

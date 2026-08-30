import type { CSSProperties } from "react";
import {
  generateShapeSlots,
  STAGE_SHAPE_PRESETS,
  type StageShapePresetId,
} from "../lib/stageShapeGenerator";
import type { StagePosPct } from "../lib/stageEffectivePosition";
import type { LayoutPresetOptions } from "../lib/formationLayouts";

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
  layoutOpts?: LayoutPresetOptions;
  onPick: (presetId: StageShapePresetId) => void;
};

/**
 * FORMATION SHAPE の3カード。ドット数＝現在の選択人数。
 * 座標は既存 generateShapeSlots を読むだけ（ロジックは変更しない）。
 */
export function StageFormationShapeCards({
  selectedCount,
  layoutOpts,
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
        const slots = generateShapeSlots(n, preset.id, layoutOpts);
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

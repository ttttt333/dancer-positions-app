import { useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE } from "../lib/dancerColorPalette";
import {
  NAME_BELOW_FONT_PX_MAX,
  NAME_BELOW_FONT_PX_MIN,
} from "../lib/stageNameBelowFontSizing";
import {
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "../lib/projectDefaults";
import { btnSecondary } from "./stageButtonStyles";
import {
  dockActionBtn,
  dockCard,
  dockSectionHint,
  dockSectionTitle,
} from "./stageDockPanelStyles";

const PRIMARY_COLOR_COUNT = 8;

const markerActionBtn: CSSProperties = {
  ...dockActionBtn,
  minWidth: 0,
  padding: "8px 8px",
  fontSize: 12,
  lineHeight: 1.35,
  whiteSpace: "normal",
  overflow: "visible",
  textOverflow: "clip",
  wordBreak: "keep-all",
  overflowWrap: "normal",
};

function SizeSlider({
  label,
  value,
  min,
  max,
  unit,
  disabled,
  onChange,
  onGestureBegin,
  onGestureEnd,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  disabled?: boolean;
  onChange: (px: number) => void;
  onGestureBegin?: () => void;
  onGestureEnd?: () => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          ...dockSectionTitle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onPointerDown={() => onGestureBegin?.()}
        onPointerUp={() => onGestureEnd?.()}
        onPointerCancel={() => onGestureEnd?.()}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          margin: 0,
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
    </div>
  );
}

export type StageSelectionDisplayPanelProps = {
  selectedCount: number;
  disabled?: boolean;
  rawDancerLabelPosition?: "inside" | "below";
  dancerLabelBelow: boolean;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  applyBulkColorToDancerIds: (ids: string[], colorIndex: number) => void;
  applyBulkMarkerClear: (ids: string[]) => void;
  applyBulkMarkerSequence: (ids: string[], start: number) => void;
  applyBulkMarkerSame: (ids: string[], badgeRaw: string) => void;
  applyBulkMarkerCenterDistance: (ids: string[]) => void;
  selectedDancerIds: readonly string[];
  markerPx: number;
  nameFontPx: number;
  onMarkerSizeChange: (px: number) => void;
  onNameFontChange?: (px: number) => void;
  onSizeGestureBegin?: () => void;
  onSizeGestureEnd?: () => void;
};

export function StageSelectionDisplayPanel({
  selectedCount,
  disabled,
  rawDancerLabelPosition,
  dancerLabelBelow,
  setProject,
  applyBulkColorToDancerIds,
  applyBulkMarkerClear,
  applyBulkMarkerSequence,
  applyBulkMarkerSame,
  applyBulkMarkerCenterDistance,
  selectedDancerIds,
  markerPx,
  nameFontPx,
  onMarkerSizeChange,
  onNameFontChange,
  onSizeGestureBegin,
  onSizeGestureEnd,
}: StageSelectionDisplayPanelProps) {
  const [showAllColors, setShowAllColors] = useState(false);
  const colors = showAllColors ? DANCER_PALETTE : DANCER_PALETTE.slice(0, PRIMARY_COLOR_COUNT);
  const ids = [...selectedDancerIds];
  const busy = Boolean(disabled) || selectedCount === 0;

  return (
    <div data-selection-display-panel>
      <div style={{ ...dockCard, padding: "8px 8px 10px", marginBottom: 8 }}>
        <div style={{ ...dockSectionTitle, marginBottom: 8 }}>名前の表示</div>
        <div style={{ display: "flex", gap: 8, marginBottom: dancerLabelBelow ? 8 : 0 }}>
          {(["inside", "below"] as const).map((pos) => {
            const current = rawDancerLabelPosition ?? "inside";
            const on = current === pos;
            return (
              <button
                key={pos}
                type="button"
                disabled={busy}
                onClick={() => setProject((p) => ({ ...p, dancerLabelPosition: pos }))}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: on ? "1px solid rgba(251,191,36,0.9)" : "1px solid #334155",
                  background: on ? "rgba(251,191,36,0.16)" : "#020617",
                  color: on ? "#fde68a" : "#94a3b8",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {pos === "inside" ? "丸の内" : "丸の下"}
              </button>
            );
          })}
        </div>
        {dancerLabelBelow ? (
          <>
            <div style={{ ...dockSectionTitle, marginTop: 8 }}>丸の内</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <button
                type="button"
                disabled={busy}
                style={markerActionBtn}
                onClick={() => applyBulkMarkerClear(ids)}
              >
                空白
              </button>
              <button
                type="button"
                disabled={busy}
                style={markerActionBtn}
                onClick={() => {
                  const raw = window.prompt(
                    "連番の開始番号（整数）。フォーメーション順で丸の内に入れます。",
                    "1"
                  );
                  if (raw == null || raw.trim() === "") return;
                  const v = Number.parseInt(raw.trim(), 10);
                  if (!Number.isFinite(v)) {
                    window.alert("整数として読めませんでした。");
                    return;
                  }
                  applyBulkMarkerSequence(ids, v);
                }}
              >
                連番
              </button>
              <button
                type="button"
                disabled={busy}
                style={markerActionBtn}
                onClick={() => {
                  const raw = window.prompt("全員の丸の内を同じ内容に（最大3文字）。", "1");
                  if (raw == null || raw.trim() === "") return;
                  applyBulkMarkerSame(ids, raw);
                }}
              >
                同じ
              </button>
              <button
                type="button"
                disabled={busy}
                style={{ ...markerActionBtn, gridColumn: "1 / -1" }}
                onClick={() => applyBulkMarkerCenterDistance(ids)}
              >
                センターからの距離
              </button>
            </div>
          </>
        ) : (
          <p style={{ ...dockSectionHint, margin: "8px 0 0" }}>
            「丸の下」にすると、丸の内に連番などを入れられます。
          </p>
        )}
      </div>

      <div style={{ ...dockCard, padding: "8px 8px 10px", marginBottom: 8 }}>
        <div style={{ ...dockSectionTitle, marginBottom: 8 }}>大きさ</div>
        <SizeSlider
          label="丸の大きさ"
          value={markerPx}
          min={MARKER_DIAMETER_PX_MIN}
          max={MARKER_DIAMETER_PX_MAX}
          unit="px"
          disabled={busy}
          onChange={onMarkerSizeChange}
          onGestureBegin={onSizeGestureBegin}
          onGestureEnd={onSizeGestureEnd}
        />
        <SizeSlider
          label="丸の下の名前"
          value={nameFontPx}
          min={NAME_BELOW_FONT_PX_MIN}
          max={NAME_BELOW_FONT_PX_MAX}
          unit="px"
          disabled={busy || !onNameFontChange}
          onChange={(px) => onNameFontChange?.(px)}
          onGestureBegin={onSizeGestureBegin}
          onGestureEnd={onSizeGestureEnd}
        />
      </div>

      <div style={{ ...dockCard, marginBottom: 0, padding: "8px 8px 10px" }}>
        <div style={{ ...dockSectionTitle, marginBottom: 8 }}>印の色（選択に一括）</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {colors.map((hex, i) => (
            <button
              key={`dock-color-${i}`}
              type="button"
              disabled={busy}
              title={`色 ${i + 1}`}
              onClick={() => applyBulkColorToDancerIds(ids, i)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                border: "1px solid #1e293b",
                background: hex,
                cursor: busy ? "not-allowed" : "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
        {DANCER_PALETTE.length > PRIMARY_COLOR_COUNT ? (
          <button
            type="button"
            onClick={() => setShowAllColors((v) => !v)}
            style={{
              ...btnSecondary,
              width: "100%",
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {showAllColors ? "色を減らす" : "もっと見る"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

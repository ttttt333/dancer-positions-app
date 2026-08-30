import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import {
  NAME_BELOW_FONT_PX_MAX,
  NAME_BELOW_FONT_PX_MIN,
} from "../lib/stageNameBelowFontSizing";
import { placeStageContextToolbar } from "../lib/placeStageContextToolbar";
import {
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "../lib/projectDefaults";
import { shell } from "../theme/choreoShell";

type PopoverKind = "name" | "size" | "color" | null;

export type StageDancerContextToolbarProps = {
  dancerLabel: string;
  xPct: number;
  yPct: number;
  markerPx: number;
  colorIndex: number;
  nameFontPx: number;
  dancerLabelBelow: boolean;
  onNameFontChange: (px: number) => void;
  onMarkerSizeChange: (px: number) => void;
  onColorChange: (index: number) => void;
  onOpenMore: () => void;
  onSizeGestureBegin?: () => void;
  onSizeGestureEnd?: () => void;
};

const BTN_BORDER = "#334155";

const bar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 5px",
  borderRadius: 10,
  border: `1px solid ${shell.borderStrong}`,
  background: "rgba(8, 11, 18, 0.94)",
  boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
};

const btn: CSSProperties = {
  minWidth: 34,
  height: 32,
  padding: "0 7px",
  borderRadius: 8,
  border: `1px solid ${BTN_BORDER}`,
  background: "#0b1220",
  color: "#e2e8f0",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  lineHeight: 1,
};

const popover: CSSProperties = {
  position: "absolute",
  left: 0,
  top: "100%",
  marginTop: 6,
  minWidth: 196,
  padding: 10,
  borderRadius: 10,
  border: `1px solid ${shell.borderStrong}`,
  background: "rgba(8, 11, 18, 0.96)",
  boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
  zIndex: 2,
};

export function StageDancerContextToolbar({
  dancerLabel,
  xPct,
  yPct,
  markerPx,
  colorIndex,
  nameFontPx,
  dancerLabelBelow,
  onNameFontChange,
  onMarkerSizeChange,
  onColorChange,
  onOpenMore,
  onSizeGestureBegin,
  onSizeGestureEnd,
}: StageDancerContextToolbarProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ leftPx: 0, topPx: 0 });
  const [open, setOpen] = useState<PopoverKind>(null);
  const [showAllColors, setShowAllColors] = useState(false);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const barEl = barRef.current;
    const stage = host?.offsetParent as HTMLElement | null;
    if (!host || !barEl || !stage) return;
    const stageRect = stage.getBoundingClientRect();
    const barRect = barEl.getBoundingClientRect();
    const next = placeStageContextToolbar({
      xPct,
      yPct,
      markerRadiusPx: markerPx / 2,
      toolbarW: barRect.width || 220,
      toolbarH: barRect.height || 40,
      stageW: stageRect.width,
      stageH: stageRect.height,
    });
    setPos({ leftPx: next.leftPx, topPx: next.topPx });
  }, [xPct, yPct, markerPx, open]);

  const colors = showAllColors ? DANCER_PALETTE : DANCER_PALETTE.slice(0, 8);
  const selectedColor = modDancerColorIndex(colorIndex);

  return (
    <div
      ref={hostRef}
      data-dancer-context-toolbar
      role="toolbar"
      aria-label={`${dancerLabel}を編集中`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: pos.leftPx,
        top: pos.topPx,
        zIndex: 16,
        pointerEvents: "auto",
      }}
    >
      <div ref={barRef} style={{ ...bar, position: "relative" }}>
        <button type="button" style={btn} title="ステージ上をドラッグして移動">
          移動
        </button>
        <button
          type="button"
          style={{
            ...btn,
            borderColor: open === "name" ? "rgba(59,130,246,0.9)" : BTN_BORDER,
          }}
          title={dancerLabelBelow ? "名前サイズ" : "名前サイズ（丸の下表示のとき）"}
          aria-expanded={open === "name"}
          onClick={() => setOpen((v) => (v === "name" ? null : "name"))}
        >
          Aa
        </button>
        <button
          type="button"
          style={{
            ...btn,
            borderColor: open === "size" ? "rgba(251,191,36,0.9)" : BTN_BORDER,
          }}
          title="ダンサーサイズ"
          aria-expanded={open === "size"}
          onClick={() => setOpen((v) => (v === "size" ? null : "size"))}
        >
          ◯
        </button>
        <button
          type="button"
          style={{
            ...btn,
            borderColor: open === "color" ? "rgba(232,121,249,0.9)" : BTN_BORDER,
          }}
          title="色"
          aria-expanded={open === "color"}
          onClick={() => setOpen((v) => (v === "color" ? null : "color"))}
        >
          色
        </button>
        <button type="button" style={btn} title="その他の操作" onClick={onOpenMore}>
          ⋯
        </button>

        {open === "name" ? (
          <div style={popover}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              名前サイズ
            </div>
            <input
              type="range"
              min={NAME_BELOW_FONT_PX_MIN}
              max={NAME_BELOW_FONT_PX_MAX}
              value={nameFontPx}
              aria-label="名前サイズ"
              onPointerDown={() => onSizeGestureBegin?.()}
              onPointerUp={() => onSizeGestureEnd?.()}
              onPointerCancel={() => onSizeGestureEnd?.()}
              onChange={(e) => onNameFontChange(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        ) : null}
        {open === "size" ? (
          <div style={popover}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              ダンサーサイズ
            </div>
            <input
              type="range"
              min={MARKER_DIAMETER_PX_MIN}
              max={MARKER_DIAMETER_PX_MAX}
              value={markerPx}
              aria-label="ダンサーサイズ"
              onPointerDown={() => onSizeGestureBegin?.()}
              onPointerUp={() => onSizeGestureEnd?.()}
              onPointerCancel={() => onSizeGestureEnd?.()}
              onChange={(e) => onMarkerSizeChange(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        ) : null}
        {open === "color" ? (
          <div style={popover}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>色</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {colors.map((hex, i) => (
                <button
                  key={`tb-color-${i}`}
                  type="button"
                  title={`色 ${i + 1}`}
                  onClick={() => onColorChange(i)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    padding: 0,
                    border:
                      selectedColor === i ? "2px solid #fbbf24" : "1px solid #1e293b",
                    background: hex,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
            {DANCER_PALETTE.length > 8 ? (
              <button
                type="button"
                onClick={() => setShowAllColors((v) => !v)}
                style={{
                  ...btn,
                  width: "100%",
                  marginTop: 8,
                  height: 28,
                }}
              >
                {showAllColors ? "色を減らす" : "もっと見る"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

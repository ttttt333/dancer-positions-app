import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import {
  NAME_BELOW_FONT_PX_MAX,
  NAME_BELOW_FONT_PX_MIN,
} from "../lib/stageNameBelowFontSizing";
import {
  placeStageContextToolbar,
  type StageContextToolbarBoxPct,
} from "../lib/placeStageContextToolbar";
import {
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "../lib/projectDefaults";
import { shell } from "../theme/choreoShell";
import type {
  SelectionAlignEdge,
  SelectionDistributeAxis,
  SelectionFlipAxis,
} from "../lib/stageSelectionTransform";
import type { StageEditMode } from "../lib/stageEditMode";
import {
  STAGE_SHAPE_PRESETS,
  type StageShapePresetId,
} from "../lib/stageShapeGenerator";

type PopoverKind =
  | "name"
  | "size"
  | "color"
  | "align"
  | "distribute"
  | "flip"
  | "shape"
  | null;

export type StageDancerContextToolbarProps = {
  dancerLabel: string;
  selectedCount: number;
  editMode?: StageEditMode;
  xPct: number;
  yPct: number;
  markerPx: number;
  colorIndex: number;
  nameFontPx: number;
  dancerLabelBelow: boolean;
  southExtraPx?: number;
  boxPct?: StageContextToolbarBoxPct;
  handleOutsetPx?: number;
  onNameFontChange?: (px: number) => void;
  onMarkerSizeChange: (px: number) => void;
  onColorChange: (index: number) => void;
  onOpenMore: () => void;
  onSizeGestureBegin?: () => void;
  onSizeGestureEnd?: () => void;
  onAlign?: (edge: SelectionAlignEdge) => void;
  onDistribute?: (axis: SelectionDistributeAxis) => void;
  onFlip?: (axis: SelectionFlipAxis) => void;
  shapePreviewActive?: boolean;
  onBeginShapePreview?: (presetId: StageShapePresetId) => void;
  onCancelShapePreview?: () => void;
  onApplyShapePreview?: () => void;
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

const caption: CSSProperties = {
  padding: "0 6px 0 4px",
  fontSize: 11,
  fontWeight: 700,
  color: "#94a3b8",
  whiteSpace: "nowrap",
};

function popoverStyle(placeAbove: boolean): CSSProperties {
  return {
    position: "absolute",
    left: 0,
    minWidth: 196,
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${shell.borderStrong}`,
    background: "rgba(8, 11, 18, 0.96)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
    zIndex: 2,
    ...(placeAbove
      ? { bottom: "100%", top: "auto", marginBottom: 6 }
      : { top: "100%", bottom: "auto", marginTop: 6 }),
  };
}

export function StageDancerContextToolbar({
  dancerLabel,
  selectedCount,
  editMode = "none",
  xPct,
  yPct,
  markerPx,
  colorIndex,
  nameFontPx,
  dancerLabelBelow,
  southExtraPx = 0,
  boxPct,
  handleOutsetPx,
  onNameFontChange,
  onMarkerSizeChange,
  onColorChange,
  onOpenMore,
  onSizeGestureBegin,
  onSizeGestureEnd,
  onAlign,
  onDistribute,
  onFlip,
  shapePreviewActive = false,
  onBeginShapePreview,
  onCancelShapePreview,
  onApplyShapePreview,
}: StageDancerContextToolbarProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ leftPx: 0, topPx: 0, placeAbove: true });
  const [open, setOpen] = useState<PopoverKind>(null);
  const [showAllColors, setShowAllColors] = useState(false);
  const multi = selectedCount >= 2;
  const formationEdit = editMode === "formation";

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
      toolbarW: barRect.width || (multi ? 320 : 220),
      toolbarH: barRect.height || 40,
      stageW: stageRect.width,
      stageH: stageRect.height,
      southExtraPx,
      boxPct,
      handleOutsetPx,
    });
    setPos({
      leftPx: next.leftPx,
      topPx: next.topPx,
      placeAbove: next.placeAbove,
    });
  }, [
    xPct,
    yPct,
    markerPx,
    open,
    southExtraPx,
    boxPct?.x0,
    boxPct?.y0,
    boxPct?.x1,
    boxPct?.y1,
    handleOutsetPx,
    multi,
    selectedCount,
    editMode,
    shapePreviewActive,
  ]);

  const colors = showAllColors ? DANCER_PALETTE : DANCER_PALETTE.slice(0, 8);
  const selectedColor = modDancerColorIndex(colorIndex);
  const ariaLabel = formationEdit
    ? "FORMATION EDIT"
    : multi
      ? `${selectedCount}人選択中`
      : `${dancerLabel}を編集中`;

  return (
    <div
      ref={hostRef}
      data-dancer-context-toolbar
      data-toolbar-mode={
        formationEdit ? "formation" : multi ? "multi" : "single"
      }
      role="toolbar"
      aria-label={ariaLabel}
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
        {formationEdit ? (
          <span
            style={{
              ...caption,
              color: "#fbbf24",
              letterSpacing: "0.04em",
            }}
          >
            FORMATION EDIT
          </span>
        ) : multi ? (
          <span style={caption}>{selectedCount}人選択中</span>
        ) : null}
        <button type="button" style={btn} title="ステージ上をドラッグして移動">
          移動
        </button>
        {formationEdit && onBeginShapePreview ? (
          <button
            type="button"
            style={{
              ...btn,
              borderColor:
                open === "shape" || shapePreviewActive
                  ? "rgba(251,191,36,0.9)"
                  : BTN_BORDER,
            }}
            title="フォーメーションの形"
            aria-expanded={open === "shape"}
            onClick={() => setOpen((v) => (v === "shape" ? null : "shape"))}
          >
            形
          </button>
        ) : null}
        {formationEdit && shapePreviewActive ? (
          <>
            <button
              type="button"
              style={btn}
              title="形のプレビューを取り消す"
              onClick={() => {
                setOpen(null);
                onCancelShapePreview?.();
              }}
            >
              取消
            </button>
            <button
              type="button"
              style={{
                ...btn,
                borderColor: "rgba(52,211,153,0.9)",
                color: "#6ee7b7",
              }}
              title="形を適用する"
              onClick={() => {
                setOpen(null);
                onApplyShapePreview?.();
              }}
            >
              適用
            </button>
          </>
        ) : null}
        {multi ? (
          <>
            <button
              type="button"
              style={{
                ...btn,
                borderColor: open === "align" ? "rgba(96,165,250,0.9)" : BTN_BORDER,
              }}
              title="整列"
              aria-expanded={open === "align"}
              onClick={() => setOpen((v) => (v === "align" ? null : "align"))}
            >
              整列
            </button>
            <button
              type="button"
              style={{
                ...btn,
                borderColor:
                  open === "distribute" ? "rgba(52,211,153,0.9)" : BTN_BORDER,
              }}
              title="等間隔"
              aria-expanded={open === "distribute"}
              onClick={() =>
                setOpen((v) => (v === "distribute" ? null : "distribute"))
              }
            >
              等間隔
            </button>
            <button
              type="button"
              style={{
                ...btn,
                borderColor: open === "flip" ? "rgba(251,146,60,0.9)" : BTN_BORDER,
              }}
              title="反転"
              aria-expanded={open === "flip"}
              onClick={() => setOpen((v) => (v === "flip" ? null : "flip"))}
            >
              反転
            </button>
          </>
        ) : (
          <button
            type="button"
            style={{
              ...btn,
              borderColor: open === "name" ? "rgba(59,130,246,0.9)" : BTN_BORDER,
            }}
            title={
              dancerLabelBelow
                ? "名前サイズ"
                : "名前サイズ（丸の下表示のとき）"
            }
            aria-expanded={open === "name"}
            onClick={() => setOpen((v) => (v === "name" ? null : "name"))}
          >
            Aa
          </button>
        )}
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
          {multi ? "サイズ" : "◯"}
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

        {!multi && open === "name" && onNameFontChange ? (
          <div style={popoverStyle(pos.placeAbove)}>
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
          <div style={popoverStyle(pos.placeAbove)}>
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
          <div style={popoverStyle(pos.placeAbove)}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              色
            </div>
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
        {multi && open === "align" ? (
          <div style={popoverStyle(pos.placeAbove)}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              整列
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {(
                [
                  ["left", "左"],
                  ["centerX", "中央"],
                  ["right", "右"],
                  ["top", "上"],
                  ["centerY", "中央"],
                  ["bottom", "下"],
                ] as const
              ).map(([edge, label]) => (
                <button
                  key={edge}
                  type="button"
                  style={{ ...btn, width: "100%", minWidth: 0 }}
                  title={
                    edge === "left"
                      ? "左揃え"
                      : edge === "centerX"
                        ? "左右中央"
                        : edge === "right"
                          ? "右揃え"
                          : edge === "top"
                            ? "上揃え"
                            : edge === "centerY"
                              ? "上下中央"
                              : "下揃え"
                  }
                  onClick={() => onAlign?.(edge)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {multi && open === "distribute" ? (
          <div style={popoverStyle(pos.placeAbove)}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              等間隔
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                style={{ ...btn, flex: 1 }}
                title="横方向に等間隔（両端は固定）"
                onClick={() => onDistribute?.("x")}
              >
                横
              </button>
              <button
                type="button"
                style={{ ...btn, flex: 1 }}
                title="縦方向に等間隔（両端は固定）"
                onClick={() => onDistribute?.("y")}
              >
                縦
              </button>
            </div>
          </div>
        ) : null}
        {multi && open === "flip" ? (
          <div style={popoverStyle(pos.placeAbove)}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              反転
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                style={{ ...btn, flex: 1 }}
                title="選択範囲の左右を反転"
                onClick={() => onFlip?.("x")}
              >
                左右
              </button>
              <button
                type="button"
                style={{ ...btn, flex: 1 }}
                title="選択範囲の上下を反転"
                onClick={() => onFlip?.("y")}
              >
                上下
              </button>
            </div>
          </div>
        ) : null}
        {formationEdit && open === "shape" ? (
          <div style={popoverStyle(pos.placeAbove)}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
              FORMATION SHAPE
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {STAGE_SHAPE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  style={{ ...btn, width: "100%", minWidth: 0, textAlign: "left" }}
                  title={`${preset.label}のプレビュー`}
                  onClick={() => {
                    onBeginShapePreview?.(preset.id);
                    setOpen(null);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

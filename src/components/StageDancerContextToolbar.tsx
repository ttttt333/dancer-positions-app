import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import {
  NAME_BELOW_FONT_PX_MAX,
  NAME_BELOW_FONT_PX_MIN,
} from "../lib/stageNameBelowFontSizing";
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
import type { StageShapePresetId } from "../lib/stageShapeGenerator";
import type { DepthSwapInspect } from "../lib/stageDepthPreview";
import {
  isStageTidyAvailable,
  STAGE_TIDY_ACTIONS,
} from "../lib/stageTidyActions";
import { StageFormationShapeCards } from "./StageFormationShapeCards";

type PopoverKind = "name" | "size" | "color" | "tidy" | "flip" | "shape" | "depth" | null;

export type StageDancerContextToolbarProps = {
  dancerLabel: string;
  selectedCount: number;
  editMode?: StageEditMode;
  markerPx: number;
  colorIndex: number;
  nameFontPx: number;
  dancerLabelBelow: boolean;
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
  depthPreviewActive?: boolean;
  depthSwapInspect?: DepthSwapInspect;
  onBeginShapePreview?: (presetId: StageShapePresetId) => void;
  onBeginDepthPreview?: (colA: number, colB: number) => void;
  onCancelShapePreview?: () => void;
  onApplyShapePreview?: () => void;
  onDepthGuidesVisibleChange?: (visible: boolean) => void;
};

const BTN_BORDER = "#334155";

const bar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 4,
  padding: "4px 5px",
  borderRadius: 10,
  border: `1px solid ${shell.borderStrong}`,
  background: "rgba(8, 11, 18, 0.94)",
};

const previewBar: CSSProperties = {
  ...bar,
  justifyContent: "space-between",
  flexWrap: "nowrap",
  width: "100%",
  padding: "6px 8px",
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
  padding: "0 0 6px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  color: "#fbbf24",
  whiteSpace: "nowrap",
  textAlign: "center",
};

function popoverStyle(): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    minWidth: 196,
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${shell.borderStrong}`,
    background: "rgba(8, 11, 18, 0.96)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
    zIndex: 2,
    bottom: "100%",
    top: "auto",
    marginBottom: 6,
  };
}

export function StageDancerContextToolbar({
  dancerLabel,
  selectedCount,
  editMode = "none",
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
  onAlign,
  onDistribute,
  onFlip,
  shapePreviewActive = false,
  depthPreviewActive = false,
  depthSwapInspect,
  onBeginShapePreview,
  onBeginDepthPreview,
  onCancelShapePreview,
  onApplyShapePreview,
  onDepthGuidesVisibleChange,
}: StageDancerContextToolbarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<PopoverKind>(null);
  const [showAllColors, setShowAllColors] = useState(false);
  const [depthNoChangePair, setDepthNoChangePair] = useState<{
    markA: string;
    markB: string;
  } | null>(null);
  const formationEdit = editMode === "formation";
  const groupEdit = editMode === "group";
  const dancerEdit = editMode === "dancer";
  const tidyAvailable = isStageTidyAvailable(editMode);
  const previewKind = shapePreviewActive
    ? "shape"
    : depthPreviewActive
      ? "depth"
      : null;

  useEffect(() => {
    if (previewKind) setOpen(null);
  }, [previewKind]);

  useEffect(() => {
    onDepthGuidesVisibleChange?.(open === "depth" || depthPreviewActive);
  }, [open, depthPreviewActive, onDepthGuidesVisibleChange]);

  useEffect(() => {
    return () => onDepthGuidesVisibleChange?.(false);
  }, [onDepthGuidesVisibleChange]);

  const colors = showAllColors ? DANCER_PALETTE : DANCER_PALETTE.slice(0, 8);
  const selectedColor = modDancerColorIndex(colorIndex);
  const ariaLabel = previewKind
    ? previewKind === "shape"
      ? "形をプレビュー中"
      : "前後をプレビュー中"
    : formationEdit
      ? "FORMATION EDIT"
      : groupEdit
        ? `${selectedCount}人を編集中`
        : `${dancerLabel}を編集中`;

  return (
    <div
      data-dancer-context-toolbar
      data-stage-edit-dock
      data-toolbar-mode={
        formationEdit ? "formation" : groupEdit ? "group" : "dancer"
      }
      data-preview-kind={previewKind ?? undefined}
      role="toolbar"
      aria-label={ariaLabel}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "min(100%, 640px)",
        pointerEvents: "auto",
      }}
    >
      {!previewKind && formationEdit ? (
        <div style={caption}>FORMATION EDIT</div>
      ) : null}
      {!previewKind && groupEdit ? (
        <div style={{ ...caption, color: "#94a3b8", letterSpacing: 0 }}>
          {selectedCount}人を編集中
        </div>
      ) : null}
      <div
        ref={barRef}
        style={{
          ...(previewKind ? previewBar : bar),
          position: "relative",
        }}
      >
        {previewKind ? (
          <>
            <span
              style={{
                padding: "0 8px",
                fontSize: 13,
                fontWeight: 700,
                color: "#e2e8f0",
                whiteSpace: "nowrap",
              }}
            >
              {previewKind === "shape" ? "形をプレビュー中" : "前後をプレビュー中"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                style={btn}
                title="プレビューを取り消す"
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
                title="プレビューを適用する"
                onClick={() => {
                  setOpen(null);
                  onApplyShapePreview?.();
                }}
              >
                適用
              </button>
            </div>
          </>
        ) : (
          <>
            {formationEdit && onBeginShapePreview ? (
              <button
                type="button"
                style={{
                  ...btn,
                  borderColor:
                    open === "shape" ? "rgba(251,191,36,0.9)" : BTN_BORDER,
                }}
                title="フォーメーションの形"
                aria-expanded={open === "shape"}
                onClick={() => setOpen((v) => (v === "shape" ? null : "shape"))}
              >
                形
              </button>
            ) : null}
            {formationEdit && onBeginDepthPreview ? (
              <button
                type="button"
                style={{
                  ...btn,
                  borderColor:
                    open === "depth" ? "rgba(125,211,252,0.9)" : BTN_BORDER,
                }}
                title="前後の立ち位置を交換"
                aria-expanded={open === "depth"}
                onClick={() => {
                  setDepthNoChangePair(null);
                  setOpen((v) => (v === "depth" ? null : "depth"));
                }}
              >
                前後
              </button>
            ) : null}
            {tidyAvailable ? (
              <button
                type="button"
                data-tidy-entry
                style={{
                  ...btn,
                  borderColor:
                    open === "tidy" ? "rgba(96,165,250,0.9)" : BTN_BORDER,
                }}
                title="整える"
                aria-expanded={open === "tidy"}
                onClick={() => setOpen((v) => (v === "tidy" ? null : "tidy"))}
              >
                整える
              </button>
            ) : null}
            {formationEdit || groupEdit ? (
              <button
                type="button"
                style={{
                  ...btn,
                  borderColor:
                    open === "flip" ? "rgba(251,146,60,0.9)" : BTN_BORDER,
                }}
                title="反転"
                aria-expanded={open === "flip"}
                onClick={() => setOpen((v) => (v === "flip" ? null : "flip"))}
              >
                反転
              </button>
            ) : null}
            {dancerEdit ? (
              <button
                type="button"
                style={{
                  ...btn,
                  borderColor:
                    open === "name" ? "rgba(59,130,246,0.9)" : BTN_BORDER,
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
            ) : null}
            {dancerEdit ? (
              <button
                type="button"
                style={{
                  ...btn,
                  borderColor:
                    open === "size" ? "rgba(251,191,36,0.9)" : BTN_BORDER,
                }}
                title="ダンサーサイズ"
                aria-expanded={open === "size"}
                onClick={() => setOpen((v) => (v === "size" ? null : "size"))}
              >
                ◯
              </button>
            ) : null}
            {dancerEdit ? (
              <button
                type="button"
                style={{
                  ...btn,
                  borderColor:
                    open === "color" ? "rgba(232,121,249,0.9)" : BTN_BORDER,
                }}
                title="色"
                aria-expanded={open === "color"}
                onClick={() => setOpen((v) => (v === "color" ? null : "color"))}
              >
                色
              </button>
            ) : null}
            <button
              type="button"
              style={btn}
              title="その他の操作"
              onClick={onOpenMore}
            >
              ⋯
            </button>
          </>
        )}

        {dancerEdit && open === "name" && onNameFontChange ? (
          <div style={popoverStyle()}>
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
        {dancerEdit && open === "size" ? (
          <div style={popoverStyle()}>
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
        {dancerEdit && open === "color" ? (
          <div style={popoverStyle()}>
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
        {tidyAvailable && open === "tidy" ? (
          <div
            data-tidy-panel
            style={{ ...popoverStyle(), minWidth: 280 }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#e2e8f0",
                marginBottom: 10,
              }}
            >
              整える
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              {STAGE_TIDY_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  data-tidy-action={action.id}
                  style={{
                    ...btn,
                    width: "100%",
                    minWidth: 0,
                    height: "auto",
                    minHeight: 32,
                    padding: "7px 8px",
                    fontSize: 11,
                  }}
                  title={action.label}
                  onClick={() => {
                    if (action.kind === "align") onAlign?.(action.edge);
                    else onDistribute?.(action.axis);
                    setOpen(null);
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {(formationEdit || groupEdit) && open === "flip" ? (
          <div style={popoverStyle()}>
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
          <div style={{ ...popoverStyle(), minWidth: 318, left: "50%" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
              FORMATION SHAPE
            </div>
            <StageFormationShapeCards
              selectedCount={selectedCount}
              onPick={(presetId) => {
                onBeginShapePreview?.(presetId);
                setOpen(null);
              }}
            />
          </div>
        ) : null}
        {formationEdit && open === "depth" ? (
          <div style={{ ...popoverStyle(), minWidth: 228 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#e2e8f0",
                marginBottom: 8,
              }}
            >
              前後の位置を入れ替える
            </div>
            {depthSwapInspect && depthSwapInspect.groupCount >= 2 ? (
              <>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#e2e8f0",
                    marginBottom: 4,
                  }}
                >
                  {depthSwapInspect.groupCount}グループ
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    lineHeight: 1.45,
                    marginBottom: 10,
                    whiteSpace: "normal",
                  }}
                >
                  {depthSwapInspect.groupSummaryLine}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {depthSwapInspect.pairs.map((pair) => (
                    <button
                      key={`${pair.colA}-${pair.colB}`}
                      type="button"
                      style={{
                        ...btn,
                        width: "100%",
                        minWidth: 0,
                        height: "auto",
                        minHeight: 32,
                        padding: "7px 8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                      title={
                        pair.noChange
                          ? `${pair.markA}と${pair.markB}は前後位置が同じです`
                          : `${pair.markA}と${pair.markB}の前後を交換（左右は動かない）`
                      }
                      onClick={() => {
                        if (pair.noChange) {
                          setDepthNoChangePair({
                            markA: pair.markA,
                            markB: pair.markB,
                          });
                          return;
                        }
                        setDepthNoChangePair(null);
                        onBeginDepthPreview?.(pair.colA, pair.colB);
                        setOpen(null);
                      }}
                    >
                      <span>
                        {pair.markA} ⇄ {pair.markB}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: pair.noChange ? "#fbbf24" : "#94a3b8",
                        }}
                      >
                        {pair.noChange
                          ? "変化なし"
                          : `移動：${pair.movementLabel}`}
                      </span>
                    </button>
                  ))}
                </div>
                {depthNoChangePair ? (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 11,
                      color: "#fde68a",
                      lineHeight: 1.45,
                    }}
                  >
                    {depthNoChangePair.markA} ⇄ {depthNoChangePair.markB}
                    <br />
                    前後位置が同じため、配置は変わりません。
                  </p>
                ) : null}
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 10,
                    color: "#64748b",
                  }}
                >
                  ※左右の位置は変わりません
                </p>
              </>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "#94a3b8",
                  lineHeight: 1.45,
                }}
              >
                グループを判定できませんでした。前後の位置が分かれるように並べてください。
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

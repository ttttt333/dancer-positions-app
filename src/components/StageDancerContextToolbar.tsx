import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
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
import type { LayoutPresetId } from "../lib/formationLayouts";
import type { DepthSwapInspect } from "../lib/stageDepthPreview";
import { formatRankIndexSetLabel } from "../lib/stageDepthPreview";
import {
  classifyShapeMovementCost,
  resolveShapePreviewEsc,
  shapePreviewLabel,
} from "../lib/stageShapePreviewSession";
import {
  positionRotationLabel,
  type PositionRotationDir,
} from "../lib/stagePositionRotation";
import {
  isStageTidyAvailable,
  STAGE_TIDY_ACTIONS,
  tidyActionLabel,
  type StageTidyAction,
} from "../lib/stageTidyActions";
import { StageFormationShapeCards } from "./StageFormationShapeCards";
import { StageFormationRanksPanel } from "./StageFormationRanksPanel";
import { StageSelectionArrangePanel } from "./StageSelectionArrangePanel";
import { StageSelectionDisplayPanel } from "./StageSelectionDisplayPanel";
import { StageSelectionComparePanel } from "./StageSelectionComparePanel";
import { StagePrevCueCompareSummary } from "./StagePrevCueCompareOverlay";
import {
  dockActionBtn,
  dockCard,
  dockSectionHint,
  dockSectionTitle,
} from "./stageDockPanelStyles";
import { useMobileShellBridgeStore } from "../store/useMobileShellBridgeStore";
import type { PrevCueCompareSummary } from "../lib/stagePrevCueCompare";
import type { DancerSpot, ChoreographyProjectJson } from "../types/choreography";

type PopoverKind =
  | "name"
  | "size"
  | "color"
  | "tidy"
  | "shape"
  | "depth"
  | "sort"
  | "display"
  | "compare"
  | "more"
  | null;

export type StageDancerContextToolbarProps = {
  dancerLabel: string;
  selectedCount: number;
  editMode?: StageEditMode;
  cueOrdinal?: number | null;
  markerPx: number;
  colorIndex: number;
  nameFontPx: number;
  dancerLabelBelow: boolean;
  onNameFontChange?: (px: number) => void;
  onMarkerSizeChange: (px: number) => void;
  onColorChange: (index: number) => void;
  onOpenMore: () => void;
  onCreateNextCue?: () => void;
  onSizeGestureBegin?: () => void;
  onSizeGestureEnd?: () => void;
  onAlign?: (edge: SelectionAlignEdge) => void;
  onDistribute?: (axis: SelectionDistributeAxis) => void;
  onFlip?: (axis: SelectionFlipAxis) => void;
  onPermuteSelection?: (
    fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
  ) => void;
  onArrangeSelection?: (
    fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
  ) => void;
  selectedDancerIds?: readonly string[];
  rawDancerLabelPosition?: "inside" | "below";
  setProject?: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  applyBulkColorToDancerIds?: (ids: string[], colorIndex: number) => void;
  applyBulkMarkerClear?: (ids: string[]) => void;
  applyBulkMarkerSequence?: (ids: string[], start: number) => void;
  applyBulkMarkerSame?: (ids: string[], badgeRaw: string) => void;
  applyBulkMarkerCenterDistance?: (ids: string[]) => void;
  shapePreviewActive?: boolean;
  depthPreviewActive?: boolean;
  rotationPreviewActive?: boolean;
  rotationPreviewDir?: PositionRotationDir | null;
  tidyPreviewActive?: boolean;
  tidyPreviewActionId?: StageTidyAction["id"] | null;
  shapePreviewPresetId?: string | null;
  shapePreviewMovementCostPct?: number;
  depthSwapInspect?: DepthSwapInspect;
  onBeginShapePreview?: (presetId: StageShapePresetId) => void;
  onBeginLayoutPresetPreview?: (presetId: LayoutPresetId) => void;
  onBeginDepthPreview?: (
    colsA: number | readonly number[],
    colsB: number | readonly number[]
  ) => boolean | void;
  rankPickSlot?: "a" | "b";
  rankPickA?: readonly number[];
  rankPickB?: readonly number[];
  onRankPickSlot?: (slot: "a" | "b") => void;
  onToggleRankPick?: (index: number) => void;
  onBeginRotationPreview?: (direction: PositionRotationDir) => void;
  onBeginTidyPreview?: (actionId: StageTidyAction["id"]) => void;
  onCancelShapePreview?: () => void;
  onApplyShapePreview?: () => void;
  onDepthGuidesVisibleChange?: (visible: boolean) => void;
  prevCueCompareAvailable?: boolean;
  prevCueCompareOn?: boolean;
  prevCueCompareSummary?: PrevCueCompareSummary | null;
  onTogglePrevCueCompare?: () => void;
  prevCueMotionViewOn?: boolean;
  prevCueFromOrdinal?: number | null;
  prevCueToOrdinal?: number | null;
  onTogglePrevCueMotionView?: () => void;
  /** side: 右メニュー。floor: ステージ下（portal がないとき） */
  placement?: "floor" | "side";
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

const floorBtn: CSSProperties = {
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

function popoverStyle(side: boolean): CSSProperties {
  return {
    position: "relative",
    left: "auto",
    transform: "none",
    width: "100%",
    minWidth: side ? 0 : 196,
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${shell.borderStrong}`,
    background: "rgba(8, 11, 18, 0.96)",
    zIndex: 2,
  };
}

export function StageDancerContextToolbar({
  dancerLabel,
  selectedCount,
  editMode = "none",
  cueOrdinal = null,
  markerPx,
  colorIndex,
  nameFontPx,
  dancerLabelBelow,
  onNameFontChange,
  onMarkerSizeChange,
  onColorChange,
  onOpenMore,
  onCreateNextCue,
  onSizeGestureBegin,
  onSizeGestureEnd,
  onAlign,
  onDistribute,
  onFlip,
  onPermuteSelection,
  onArrangeSelection,
  selectedDancerIds = [],
  rawDancerLabelPosition,
  setProject,
  applyBulkColorToDancerIds,
  applyBulkMarkerClear,
  applyBulkMarkerSequence,
  applyBulkMarkerSame,
  applyBulkMarkerCenterDistance,
  shapePreviewActive = false,
  depthPreviewActive = false,
  rotationPreviewActive = false,
  rotationPreviewDir = null,
  tidyPreviewActive = false,
  tidyPreviewActionId = null,
  shapePreviewPresetId = null,
  shapePreviewMovementCostPct = 0,
  depthSwapInspect,
  onBeginShapePreview,
  onBeginLayoutPresetPreview,
  onBeginDepthPreview,
  rankPickSlot = "a",
  rankPickA = [],
  rankPickB = [],
  onRankPickSlot,
  onToggleRankPick,
  onBeginRotationPreview,
  onBeginTidyPreview,
  onCancelShapePreview,
  onApplyShapePreview,
  onDepthGuidesVisibleChange,
  prevCueCompareAvailable = false,
  prevCueCompareOn = false,
  prevCueCompareSummary = null,
  onTogglePrevCueCompare,
  prevCueMotionViewOn = false,
  prevCueFromOrdinal = null,
  prevCueToOrdinal = null,
  onTogglePrevCueMotionView,
  placement = "floor",
}: StageDancerContextToolbarProps) {
  const side = placement === "side";
  const btn: CSSProperties = side
    ? {
        ...floorBtn,
        minWidth: 0,
        width: "100%",
        height: 46,
        fontSize: 15,
        fontWeight: 800,
        padding: "0 8px",
      }
    : floorBtn;
  const barStyle: CSSProperties = side
    ? {
        ...bar,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        alignItems: "stretch",
        justifyContent: "stretch",
        flexWrap: "nowrap",
        gap: 8,
        width: "100%",
        padding: "8px 4px",
      }
    : bar;
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
  const multiEdit = formationEdit || groupEdit;
  const tidyAvailable = isStageTidyAvailable(editMode);
  const openFormationPresets = useMobileShellBridgeStore(
    (s) => s.onFormationChange
  );
  const canOpenFormationPresets = useMobileShellBridgeStore(
    (s) => s.showFormationChange
  );
  const goToShapePicker = () => {
    setOpen(null);
    if (canOpenFormationPresets) {
      onCancelShapePreview?.();
      openFormationPresets();
      return;
    }
    setOpen("shape");
  };
  const previewKind = shapePreviewActive
    ? "shape"
    : tidyPreviewActive
      ? "tidy"
      : depthPreviewActive
        ? "depth"
        : rotationPreviewActive
          ? "rotation"
          : null;

  useEffect(() => {
    if (previewKind === "depth") setOpen(null);
  }, [previewKind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const action = resolveShapePreviewEsc({
        pickerOpen: open !== null,
        draftActive: Boolean(previewKind),
      });
      if (action !== "close-picker") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, previewKind]);

  useEffect(() => {
    onDepthGuidesVisibleChange?.(open === "depth" || depthPreviewActive);
  }, [open, depthPreviewActive, onDepthGuidesVisibleChange]);

  useEffect(() => {
    return () => onDepthGuidesVisibleChange?.(false);
  }, [onDepthGuidesVisibleChange]);

  const colors = showAllColors ? DANCER_PALETTE : DANCER_PALETTE.slice(0, 8);
  const selectedColor = modDancerColorIndex(colorIndex);
  const depthChrome = open === "depth" || previewKind === "depth";
  const dockExpanded = open != null || previewKind != null;
  const fillSideDock = Boolean(
    side && (previewKind || (multiEdit && open != null))
  );
  const ariaLabel = previewKind
    ? previewKind === "shape"
      ? "形をプレビュー中"
      : previewKind === "tidy"
        ? "整えるをプレビュー中"
        : previewKind === "depth"
          ? "前後をプレビュー中"
          : "位置をプレビュー中"
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
      data-toolbar-open={open ?? undefined}
      data-preview-kind={previewKind ?? undefined}
      data-dock-fill={fillSideDock ? "1" : undefined}
      data-edit-dock-placement={placement}
      role="toolbar"
      aria-label={ariaLabel}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        height: side && fillSideDock ? "100%" : undefined,
        maxWidth: side ? "100%" : "min(100%, 640px)",
        maxHeight: side
          ? fillSideDock
            ? "100%"
            : "min(72vh, 680px)"
          : undefined,
        overflowX: "hidden",
        overflowY: side ? (depthChrome ? "hidden" : "auto") : undefined,
        pointerEvents: "auto",
      }}
    >
      {!previewKind && !dockExpanded && formationEdit ? (
        <div
          style={{
            ...caption,
            fontSize: side ? 15 : 11,
            fontWeight: side ? 800 : 700,
            textAlign: side ? "left" : "center",
            whiteSpace: side ? "normal" : "nowrap",
          }}
        >
          FORMATION EDIT
          {cueOrdinal != null ? ` · キュー ${cueOrdinal}` : ""}
        </div>
      ) : null}
      {!previewKind && !dockExpanded && groupEdit ? (
        <div
          style={{
            ...caption,
            color: "#94a3b8",
            letterSpacing: 0,
            fontSize: side ? 15 : 11,
            fontWeight: side ? 800 : 700,
            textAlign: side ? "left" : "center",
          }}
        >
          {selectedCount}人を編集中
        </div>
      ) : null}
      <div
        ref={barRef}
        style={{
          ...(previewKind === "depth"
            ? {
                ...previewBar,
                flexWrap: "wrap",
                flexDirection: "column",
                alignItems: "stretch",
                minWidth: 0,
                overflow: "hidden",
                width: "100%",
              }
            : previewKind
              ? previewBar
              : barStyle),
          position: "relative",
        }}
      >
        {previewKind === "shape" ? (
          <div
            data-shape-preview-chrome
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              width: "100%",
              padding: "2px 2px 0",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              形をプレビュー中
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                color: "#fbbf24",
              }}
            >
              <span data-shape-preview-label>
                {shapePreviewPresetId
                  ? shapePreviewLabel(shapePreviewPresetId)
                  : "形"}
              </span>
              <span data-shape-preview-move>
                移動：
                {classifyShapeMovementCost(
                  shapePreviewMovementCostPct,
                  selectedCount
                )}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 4,
              }}
            >
              <button
                type="button"
                data-shape-change
                style={{
                  ...btn,
                  borderColor:
                    open === "shape" ? "rgba(251,191,36,0.9)" : BTN_BORDER,
                }}
                title="プレビュー中の形を変更"
                aria-expanded={open === "shape"}
                onClick={goToShapePicker}
              >
                形を変更
              </button>
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
            </div>
          </div>
        ) : previewKind === "tidy" ? (
          <div
            data-tidy-preview-chrome
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              width: "100%",
              padding: "2px 2px 0",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              整えるをプレビュー中
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#fbbf24",
              }}
              data-tidy-preview-label
            >
              {tidyPreviewActionId
                ? tidyActionLabel(tidyPreviewActionId)
                : "整える"}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 4,
              }}
            >
              <button
                type="button"
                data-tidy-change
                style={{
                  ...btn,
                  borderColor:
                    open === "tidy" ? "rgba(96,165,250,0.9)" : BTN_BORDER,
                }}
                title="整える操作を変更"
                aria-expanded={open === "tidy"}
                onClick={() =>
                  setOpen((v) => (v === "tidy" ? null : "tidy"))
                }
              >
                操作を変更
              </button>
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
            </div>
          </div>
        ) : previewKind === "rotation" ? (
          <div
            data-rotation-preview-chrome
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              width: "100%",
              padding: "2px 2px 0",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              位置をプレビュー中
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#fbbf24",
              }}
              data-rotation-preview-label
            >
              {rotationPreviewDir
                ? positionRotationLabel(rotationPreviewDir)
                : "位置交換"}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 4,
              }}
            >
              <button
                type="button"
                data-rotation-change
                style={{
                  ...btn,
                  borderColor:
                    open === "sort" ? "rgba(251,191,36,0.9)" : BTN_BORDER,
                }}
                title="ずらす方向を変更"
                aria-expanded={open === "sort"}
                onClick={() =>
                  setOpen((v) => (v === "sort" ? null : "sort"))
                }
              >
                方向を変更
              </button>
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
            </div>
          </div>
        ) : previewKind === "depth" ? (
          <div
            data-depth-preview-chrome
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              width: "100%",
              minWidth: 0,
              overflow: "hidden",
              padding: side ? "4px 2px 2px" : "2px 2px 0",
            }}
          >
            <div
              style={{
                fontSize: side ? 14 : 13,
                fontWeight: 800,
                color: "#e2e8f0",
                lineHeight: 1.3,
              }}
            >
              前後をプレビュー中
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                width: "100%",
                minWidth: 0,
              }}
            >
              <button
                type="button"
                style={{
                  ...btn,
                  width: "100%",
                  minWidth: 0,
                  height: side ? 48 : 36,
                  fontSize: side ? 14 : 12,
                }}
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
                  width: "100%",
                  minWidth: 0,
                  height: side ? 48 : 36,
                  fontSize: side ? 14 : 12,
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
          </div>
        ) : (
          <>
            {multiEdit && (onBeginShapePreview || canOpenFormationPresets) ? (
              <button
                type="button"
                style={{
                  ...btn,
                  borderColor:
                    open === "shape" ? "rgba(251,191,36,0.9)" : BTN_BORDER,
                }}
                title="雛形から形を選ぶ"
                aria-expanded={open === "shape"}
                onClick={goToShapePicker}
              >
                形
              </button>
            ) : null}
            {multiEdit && onBeginDepthPreview ? (
              <button
                type="button"
                data-ranks-entry
                style={{
                  ...btn,
                  borderColor:
                    open === "depth"
                      ? "rgba(125,211,252,0.9)"
                      : BTN_BORDER,
                }}
                title="列番号を表示して前後を入れ替える"
                aria-expanded={open === "depth"}
                onClick={() => {
                  setDepthNoChangePair(null);
                  setOpen((v) => (v === "depth" ? null : "depth"));
                }}
              >
                列
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
            {multiEdit && onArrangeSelection && onPermuteSelection ? (
              <button
                type="button"
                data-arrange-entry
                style={{
                  ...btn,
                  borderColor:
                    open === "sort" ? "rgba(251,146,60,0.9)" : BTN_BORDER,
                }}
                title="並べ替え・反転・位置交換"
                aria-expanded={open === "sort"}
                onClick={() => setOpen((v) => (v === "sort" ? null : "sort"))}
              >
                並べ替え
              </button>
            ) : null}
            {multiEdit && setProject && applyBulkColorToDancerIds ? (
              <button
                type="button"
                data-display-entry
                style={{
                  ...btn,
                  borderColor:
                    open === "display" ? "rgba(167,139,250,0.9)" : BTN_BORDER,
                }}
                title="名前と色の表示"
                aria-expanded={open === "display"}
                onClick={() =>
                  setOpen((v) => (v === "display" ? null : "display"))
                }
              >
                表示
              </button>
            ) : null}
            {multiEdit ? (
              <button
                type="button"
                data-prev-cue-compare
                style={{
                  ...btn,
                  borderColor:
                    open === "compare" || prevCueCompareOn
                      ? "rgba(148,163,184,0.95)"
                      : BTN_BORDER,
                  background:
                    prevCueCompareOn || prevCueMotionViewOn
                      ? "#1e293b"
                      : "#0b1220",
                }}
                title="前のキューと比べる"
                aria-expanded={open === "compare"}
                onClick={() =>
                  setOpen((v) => (v === "compare" ? null : "compare"))
                }
              >
                比較
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
              data-toolbar-more
              style={{
                ...btn,
                ...(side ? { gridColumn: "1 / -1", height: 40, fontSize: 14 } : {}),
                borderColor:
                  open === "more" ? "rgba(148,163,184,0.9)" : BTN_BORDER,
              }}
              title="その他の操作"
              aria-expanded={open === "more"}
              onClick={() => {
                if (formationEdit && onCreateNextCue) {
                  setOpen((v) => (v === "more" ? null : "more"));
                  return;
                }
                onOpenMore();
              }}
            >
              ⋯
            </button>
          </>
        )}
      </div>

        {dancerEdit && open === "name" && onNameFontChange ? (
          <div style={popoverStyle(side)}>
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
          <div style={popoverStyle(side)}>
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
          <div style={popoverStyle(side)}>
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
            style={{ ...popoverStyle(side), minWidth: side ? 0 : 280 }}
          >
            <div style={{ ...dockCard, marginBottom: 0 }}>
              <div style={dockSectionTitle}>整える</div>
              <p style={dockSectionHint}>
                選択した人の位置だけを動かします。形の雛形は変わりません。
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {STAGE_TIDY_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    data-tidy-action={action.id}
                    style={dockActionBtn}
                    title={action.label}
                    onClick={() => {
                      if (onBeginTidyPreview) {
                        onBeginTidyPreview(action.id);
                      } else if (action.kind === "align") {
                        onAlign?.(action.edge);
                      } else {
                        onDistribute?.(action.axis);
                      }
                      setOpen(null);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {multiEdit && open === "sort" && onArrangeSelection && onPermuteSelection ? (
          <div
            style={{
              ...popoverStyle(side),
              minWidth: 0,
              marginTop: side ? 6 : 8,
              padding: side ? 6 : 10,
            }}
          >
            <StageSelectionArrangePanel
              selectedCount={selectedCount}
              onPermute={onPermuteSelection}
              onArrange={onArrangeSelection}
              onFlip={onFlip}
              onBeginRotationPreview={
                onBeginRotationPreview
                  ? (dir) => {
                      setOpen(null);
                      onBeginRotationPreview(dir);
                    }
                  : undefined
              }
            />
          </div>
        ) : null}
        {multiEdit && open === "display" && setProject && applyBulkColorToDancerIds ? (
          <div style={{ ...popoverStyle(side), minWidth: side ? 0 : 280 }}>
            <StageSelectionDisplayPanel
              selectedCount={selectedCount}
              selectedDancerIds={selectedDancerIds}
              rawDancerLabelPosition={rawDancerLabelPosition}
              dancerLabelBelow={dancerLabelBelow}
              setProject={setProject}
              applyBulkColorToDancerIds={applyBulkColorToDancerIds}
              applyBulkMarkerClear={applyBulkMarkerClear ?? (() => {})}
              applyBulkMarkerSequence={applyBulkMarkerSequence ?? (() => {})}
              applyBulkMarkerSame={applyBulkMarkerSame ?? (() => {})}
              applyBulkMarkerCenterDistance={
                applyBulkMarkerCenterDistance ?? (() => {})
              }
            />
          </div>
        ) : null}
        {multiEdit && open === "compare" ? (
          <div style={popoverStyle(side)}>
            <StageSelectionComparePanel
              prevCueCompareAvailable={prevCueCompareAvailable}
              prevCueCompareOn={prevCueCompareOn}
              prevCueMotionViewOn={prevCueMotionViewOn}
              prevCueCompareSummary={prevCueCompareSummary}
              prevCueFromOrdinal={prevCueFromOrdinal}
              prevCueToOrdinal={prevCueToOrdinal}
              onTogglePrevCueCompare={onTogglePrevCueCompare}
              onTogglePrevCueMotionView={onTogglePrevCueMotionView}
            />
          </div>
        ) : null}
        {formationEdit && onCreateNextCue && open === "more" ? (
          <div style={popoverStyle(side)} data-create-next-cue-panel>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#e2e8f0",
                marginBottom: 4,
              }}
            >
              このフォーメーション
            </div>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 11,
                color: "#94a3b8",
                lineHeight: 1.45,
              }}
            >
              今の隊形を引き継いだキューを、直後に追加します。
            </p>
            <button
              type="button"
              data-create-next-cue
              style={{ ...btn, width: "100%", height: 34 }}
              title="今の隊形を引き継いで、次のキューを作る"
              onClick={() => {
                setOpen(null);
                onCreateNextCue();
              }}
            >
              次のキューを作る
            </button>
            <button
              type="button"
              style={{
                ...btn,
                width: "100%",
                height: 32,
                marginTop: 6,
                fontWeight: 600,
                color: "#94a3b8",
              }}
              title="選択した立ち位置の操作"
              onClick={() => {
                setOpen(null);
                onOpenMore();
              }}
            >
              その他の操作
            </button>
          </div>
        ) : null}
        {multiEdit && open === "shape" ? (
          <div style={{ ...popoverStyle(side), minWidth: side ? 0 : 360, maxWidth: side ? "100%" : 440, left: side ? "auto" : "50%" }}>
            <StageFormationShapeCards
              selectedCount={selectedCount}
              compact={side}
              activePresetId={shapePreviewPresetId}
              onPick={(presetId) => {
                onBeginShapePreview?.(presetId);
                setOpen(null);
              }}
              onPickLayoutPreset={
                onBeginLayoutPresetPreview
                  ? (presetId) => {
                      onBeginLayoutPresetPreview(presetId);
                      setOpen(null);
                    }
                  : undefined
              }
            />
          </div>
        ) : null}
        {multiEdit && open === "depth" && depthSwapInspect ? (
          <div
            style={{
              ...popoverStyle(side),
              minWidth: 0,
              marginTop: side ? 6 : 8,
              padding: side ? 6 : 10,
              overflow: "hidden",
            }}
          >
            <StageFormationRanksPanel
              inspect={depthSwapInspect}
              pickSlot={rankPickSlot}
              selectedA={rankPickA}
              selectedB={rankPickB}
              onPickSlot={(slot) => onRankPickSlot?.(slot)}
              onToggleIndex={(i) => onToggleRankPick?.(i)}
              onSwapSets={(a, b) => {
                const moved = onBeginDepthPreview?.(a, b);
                if (moved === false) {
                  setDepthNoChangePair({
                    markA:
                      formatRankIndexSetLabel(a, depthSwapInspect.unit) || "列",
                    markB:
                      formatRankIndexSetLabel(b, depthSwapInspect.unit) || "列",
                  });
                  return;
                }
                setDepthNoChangePair(null);
                if (!side) setOpen(null);
              }}
            />
            {depthNoChangePair ? (
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: side ? 13 : 12,
                  color: "#fde68a",
                  lineHeight: 1.45,
                }}
              >
                {depthNoChangePair.markA} ⇄ {depthNoChangePair.markB}
                <br />
                前後位置が同じため、配置は変わりません。
              </p>
            ) : null}
          </div>
        ) : null}
      {prevCueCompareSummary && (prevCueCompareOn || prevCueMotionViewOn) ? (
        <StagePrevCueCompareSummary
          summary={prevCueCompareSummary}
          motionViewOn={prevCueMotionViewOn}
          fromCueOrdinal={prevCueFromOrdinal}
          toCueOrdinal={prevCueToOrdinal}
          onToggleMotionView={
            prevCueCompareAvailable ? onTogglePrevCueMotionView : undefined
          }
        />
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
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
import { gatherSelectedDancersToEdge } from "../lib/gatherDancers";
import { StageFormationShapeCards } from "./StageFormationShapeCards";
import { StageFormationRanksPanel } from "./StageFormationRanksPanel";
import { StageSelectionArrangePanel } from "./StageSelectionArrangePanel";
import { StageSelectionDisplayPanel } from "./StageSelectionDisplayPanel";
import { StagePrevCueCompareSummary } from "./StagePrevCueCompareOverlay";
import {
  dockActionBtn,
  dockCard,
  dockSectionTitle,
} from "./stageDockPanelStyles";
import { useMobileShellBridgeStore } from "../store/useMobileShellBridgeStore";
import type { PrevCueCompareSummary } from "../lib/stagePrevCueCompare";
import type { DancerSpot, ChoreographyProjectJson } from "../types/choreography";

type PopoverKind =
  | "tidy"
  | "shape"
  | "sort"
  | "display"
  | "dup"
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
  applyBulkFaceStamp?: (
    ids: string[],
    stamp: import("../lib/dancerFaceStamp").DancerFaceStampId | null
  ) => void;
  applyBulkGenderToDancerIds?: (
    ids: string[],
    genderLabel: string | null
  ) => void;
  applyBulkFigure3dToDancerIds?: (
    ids: string[],
    figure3d: import("../lib/dancerFigure3d").DancerFigure3dId,
    scope?: import("../lib/applyDancerFigure3d").DancerFigure3dApplyScope
  ) => void;
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
  /** 直前 Cue の立ち位置（並べ替えパネルの最短距離用） */
  prevCueDancers?: readonly DancerSpot[] | null;
  /** side: 右メニュー。floor: ステージ下（portal がないとき） */
  placement?: "floor" | "side";
  /**
   * 右クリック等から開くセクション要求。
   * `requestId` が変わるたびにそのセクションを開く。
   */
  dockSectionRequest?: { requestId: number; section: "shape" | "display" | "sort" } | null;
  /** 選択中のダンサーを複製（end=末尾 / after=選択の直後） */
  onDuplicateSelection?: (placement: "end" | "after") => void;
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
  applyBulkFaceStamp,
  applyBulkGenderToDancerIds,
  applyBulkFigure3dToDancerIds,
  shapePreviewActive = false,
  depthPreviewActive: _depthPreviewActive = false,
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
  prevCueDancers = null,
  placement = "floor",
  dockSectionRequest = null,
  onDuplicateSelection,
}: StageDancerContextToolbarProps) {
  const side = placement === "side";
  const formationEdit = editMode === "formation";
  const groupEdit = editMode === "group";
  const dancerEdit = editMode === "dancer";
  const multiEdit = formationEdit || groupEdit;
  const showDup = Boolean(onDuplicateSelection) && selectedCount >= 1;
  const btn: CSSProperties = side
    ? {
        ...floorBtn,
        minWidth: 0,
        width: "100%",
        height: 40,
        fontSize: 13,
        fontWeight: 800,
        padding: "0 4px",
      }
    : floorBtn;
  const barStyle: CSSProperties = side
    ? {
        ...bar,
        display: "grid",
        gridTemplateColumns: showDup ? "1fr 1fr" : "1fr 1fr 1fr",
        alignItems: "stretch",
        justifyContent: "stretch",
        flexWrap: "nowrap",
        gap: 6,
        width: "100%",
        padding: "4px 2px",
      }
    : bar;
  const barRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<PopoverKind>(null);
  const [depthNoChangePair, setDepthNoChangePair] = useState<{
    markA: string;
    markB: string;
  } | null>(null);
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
      : rotationPreviewActive
        ? "rotation"
        : null;

  useEffect(() => {
    if (!dockSectionRequest) return;
    const section = dockSectionRequest.section;
    if (section === "shape") {
      goToShapePicker();
      return;
    }
    setOpen(section);
  }, [dockSectionRequest?.requestId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // 列番号ガイドは並べ替えパネル開放中（列機能集約）のみ
    onDepthGuidesVisibleChange?.(open === "sort" && Boolean(depthSwapInspect));
  }, [open, depthSwapInspect, onDepthGuidesVisibleChange]);

  useEffect(() => {
    return () => onDepthGuidesVisibleChange?.(false);
  }, [onDepthGuidesVisibleChange]);

  const dockExpanded = open != null || previewKind != null;
  const fillSideDock = Boolean(side && (previewKind || open != null || multiEdit || dancerEdit));
  const showDisplay =
    Boolean(setProject && applyBulkColorToDancerIds) &&
    (multiEdit || dancerEdit);
  const showShape =
    multiEdit && Boolean(onBeginShapePreview || canOpenFormationPresets);
  const showSort =
    multiEdit && Boolean(onArrangeSelection && onPermuteSelection);
  const ariaLabel = previewKind
    ? previewKind === "shape"
      ? "形をプレビュー中"
      : previewKind === "tidy"
        ? "整えるをプレビュー中"
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
        maxWidth: side ? "100%" : "min(100%, 640px)",
        maxHeight: side && !fillSideDock ? "min(72vh, 680px)" : undefined,
        overflowX: "hidden",
        overflowY: side && !fillSideDock ? "auto" : "visible",
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
        ) : (
          <>
            {showShape ? (
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
                雛形
              </button>
            ) : null}
            {showDisplay ? (
              <button
                type="button"
                data-display-entry
                style={{
                  ...btn,
                  borderColor:
                    open === "display" ? "rgba(167,139,250,0.9)" : BTN_BORDER,
                }}
                title="名前・大きさ・色の表示"
                aria-expanded={open === "display"}
                onClick={() =>
                  setOpen((v) => (v === "display" ? null : "display"))
                }
              >
                表示
              </button>
            ) : null}
            {showSort ? (
              <button
                type="button"
                data-arrange-entry
                style={{
                  ...btn,
                  borderColor:
                    open === "sort" ? "rgba(251,146,60,0.9)" : BTN_BORDER,
                }}
                title="並べ替え・列の前後交代・反転"
                aria-expanded={open === "sort"}
                onClick={() => {
                  setDepthNoChangePair(null);
                  setOpen((v) => (v === "sort" ? null : "sort"));
                }}
              >
                並べ替え
              </button>
            ) : null}
            {showDup ? (
              <button
                type="button"
                data-dup-entry
                style={{
                  ...btn,
                  borderColor:
                    open === "dup" ? "rgba(56,189,248,0.9)" : BTN_BORDER,
                }}
                title="選択中のダンサーを複製"
                aria-expanded={open === "dup"}
                onClick={() => setOpen((v) => (v === "dup" ? null : "dup"))}
              >
                複製
              </button>
            ) : null}
          </>
        )}
      </div>

        {tidyAvailable && open === "tidy" ? (
          <div
            data-tidy-panel
            style={{
              ...popoverStyle(side),
              minWidth: 0,
              marginTop: side ? 6 : 8,
              padding: side ? 6 : 10,
            }}
          >
            <div style={{ ...dockCard, marginBottom: 0, padding: "8px 8px 10px" }}>
              <div style={{ ...dockSectionTitle, marginBottom: 8 }}>整える</div>
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
              {onArrangeSelection ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    style={dockActionBtn}
                    title="選択メンバーを下手（左）へ寄せる"
                    onClick={() => {
                      onArrangeSelection((dancers, ids) =>
                        gatherSelectedDancersToEdge(dancers, ids, "shimote")
                      );
                      setOpen(null);
                    }}
                  >
                    下手に寄せる
                  </button>
                  <button
                    type="button"
                    style={dockActionBtn}
                    title="選択メンバーを上手（右）へ寄せる"
                    onClick={() => {
                      onArrangeSelection((dancers, ids) =>
                        gatherSelectedDancersToEdge(dancers, ids, "kamite")
                      );
                      setOpen(null);
                    }}
                  >
                    上手に寄せる
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {showSort && open === "sort" && onArrangeSelection && onPermuteSelection ? (
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
              prevCueDancers={prevCueDancers}
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
              ranksSlot={
                depthSwapInspect && onBeginDepthPreview ? (
                  <div style={{ marginBottom: 8 }}>
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
                              formatRankIndexSetLabel(a, depthSwapInspect.unit) ||
                              "列",
                            markB:
                              formatRankIndexSetLabel(b, depthSwapInspect.unit) ||
                              "列",
                          });
                          return;
                        }
                        setDepthNoChangePair(null);
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
                ) : undefined
              }
            />
          </div>
        ) : null}
        {showDisplay && open === "display" && setProject && applyBulkColorToDancerIds ? (
          <div
            style={{
              ...popoverStyle(side),
              minWidth: 0,
              marginTop: side ? 6 : 8,
              padding: side ? 6 : 10,
            }}
          >
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
              applyBulkFaceStamp={applyBulkFaceStamp}
              applyBulkGenderToDancerIds={applyBulkGenderToDancerIds}
              applyBulkFigure3dToDancerIds={applyBulkFigure3dToDancerIds}
              markerPx={markerPx}
              nameFontPx={nameFontPx}
              onMarkerSizeChange={onMarkerSizeChange}
              onNameFontChange={onNameFontChange}
              onSizeGestureBegin={onSizeGestureBegin}
              onSizeGestureEnd={onSizeGestureEnd}
            />
          </div>
        ) : null}
        {showDup && open === "dup" && onDuplicateSelection ? (
          <div
            style={{
              ...popoverStyle(side),
              minWidth: 0,
              marginTop: side ? 6 : 8,
              padding: side ? 6 : 10,
            }}
          >
            <div style={{ ...dockSectionTitle, marginBottom: 8 }}>複製</div>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 11,
                color: "#94a3b8",
                lineHeight: 1.4,
              }}
            >
              選択中を少しずらしてコピーします。置き場所を選んでください。
            </p>
            <button
              type="button"
              style={{ ...dockActionBtn, width: "100%", marginBottom: 6 }}
              title="フォーメーションの末尾に追加"
              onClick={() => {
                onDuplicateSelection("end");
                setOpen(null);
              }}
            >
              一番最後に複製
            </button>
            <button
              type="button"
              style={{ ...dockActionBtn, width: "100%" }}
              title="選択したメンバーのすぐ後ろに挿入"
              onClick={() => {
                onDuplicateSelection("after");
                setOpen(null);
              }}
            >
              すぐ後に複製
            </button>
          </div>
        ) : null}
        {showShape && open === "shape" ? (
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

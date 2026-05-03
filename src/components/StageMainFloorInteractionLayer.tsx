import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { DancerSpot } from "../types/choreography";
import { DEFAULT_DANCER_MARKER_DIAMETER_PX } from "../lib/projectDefaults";
import {
  dancerCircleInnerBelowLabel,
  markerBelowLabelFontPx,
  markerCircleLabelFontPx,
  type GroupBoxHandle,
} from "../lib/stageBoardModelHelpers";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
  normalizeDancerFacingDeg,
} from "../lib/dancerColorPalette";
import { shell } from "../theme/choreoShell";
import { StageDancerDragGhostItem } from "./StageDancerDragGhostItem";
import { StageGroupRotateGuideBadge } from "./StageGroupRotateGuideBadge";
import { StageGroupRotateHandleButton } from "./StageGroupRotateHandleButton";
import { StageGroupSelectionBox } from "./StageGroupSelectionBox";
import { StageMarqueeOverlay } from "./StageMarqueeOverlay";
import { StagePrimaryMarkerResizeHandle } from "./StagePrimaryMarkerResizeHandle";
import { StageTapToEditOverlay } from "./StageTapToEditOverlay";

export type StageSelectionBoxPct = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type StageMarqueePct = {
  startXPct: number;
  curXPct: number;
  startYPct: number;
  curYPct: number;
};

export type StageMainFloorInteractionLayerProps = {
  setPieceElements: ReactNode;
  selectionBox: StageSelectionBoxPct | null;
  groupRotateGuideDeltaDeg: number | null;
  playbackOrPreview: boolean;
  viewMode: "edit" | "view";
  stageInteractionsEnabled: boolean;
  marquee: StageMarqueePct | null;
  primarySelectedDancer: DancerSpot | null;
  effectiveMarkerPx: (d: DancerSpot) => number;
  effectiveFacingDeg: (d: DancerSpot) => number;
  onGroupBoxHandlePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    h: GroupBoxHandle,
    box: StageSelectionBoxPct
  ) => void;
  selectedDancerIds: readonly string[];
  onGroupRotatePointerDown: (
    e: ReactPointerEvent<HTMLButtonElement>
  ) => void;
  dragGhostById: Map<string, { xPct: number; yPct: number }> | null;
  stageDancerById: Map<string, DancerSpot>;
  bulkHideDancerGlyphs: boolean;
  dancerLabelBelow: boolean;
  stageDancerIndexById: Map<string, number>;
  effStageWidthMm: number;
  nameBelowClearanceExtraPx: number;
  /** 客席向き（床ラベル正立などと同じ基準） */
  rot: number;
  dancerMarkerElements: ReactNode;
  onMarkerResizePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>
  ) => void;
  tapStageToEditLayout: boolean;
  onTapEditOverlayPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>
  ) => void;
};

/** メイン床: 大道具・選択 UI・ゴースト印・本印・リサイズ・タップ編集オーバーレイ */
export function StageMainFloorInteractionLayer({
  setPieceElements,
  selectionBox,
  groupRotateGuideDeltaDeg,
  playbackOrPreview,
  viewMode,
  stageInteractionsEnabled,
  marquee,
  primarySelectedDancer,
  effectiveMarkerPx,
  effectiveFacingDeg,
  onGroupBoxHandlePointerDown,
  selectedDancerIds,
  onGroupRotatePointerDown,
  dragGhostById,
  stageDancerById,
  bulkHideDancerGlyphs,
  dancerLabelBelow,
  stageDancerIndexById,
  effStageWidthMm,
  nameBelowClearanceExtraPx,
  rot,
  dancerMarkerElements,
  onMarkerResizePointerDown,
  tapStageToEditLayout,
  onTapEditOverlayPointerDown,
}: StageMainFloorInteractionLayerProps) {
  return (
    <>
      {setPieceElements}
      {selectionBox &&
        groupRotateGuideDeltaDeg != null &&
        !playbackOrPreview &&
        viewMode !== "view" && (
          <StageGroupRotateGuideBadge
            centerXPct={(selectionBox.x0 + selectionBox.x1) / 2}
            centerYPct={(selectionBox.y0 + selectionBox.y1) / 2}
            deltaDeg={groupRotateGuideDeltaDeg}
          />
        )}
      {marquee ? (
        <StageMarqueeOverlay
          startXPct={marquee.startXPct}
          curXPct={marquee.curXPct}
          startYPct={marquee.startYPct}
          curYPct={marquee.curYPct}
        />
      ) : null}
      {selectionBox ? (
        <StageGroupSelectionBox
          box={selectionBox}
          handleInsetPx={
            primarySelectedDancer
              ? Math.round(effectiveMarkerPx(primarySelectedDancer) / 2) + 14
              : Math.round(DEFAULT_DANCER_MARKER_DIAMETER_PX / 2) + 14
          }
          onHandlePointerDown={(e, h) =>
            onGroupBoxHandlePointerDown(e, h, selectionBox)
          }
        />
      ) : null}
      {selectionBox &&
        selectedDancerIds.length >= 2 &&
        !playbackOrPreview &&
        viewMode !== "view" &&
        stageInteractionsEnabled && (
          <StageGroupRotateHandleButton
            centerXPct={(selectionBox.x0 + selectionBox.x1) / 2}
            bottomEdgeYPct={selectionBox.y1}
            selectedCount={selectedDancerIds.length}
            borderDeepColor={shell.bgDeep}
            rubyColor={shell.ruby}
            onPointerDown={onGroupRotatePointerDown}
          />
        )}
      {dragGhostById &&
        dragGhostById.size > 0 &&
        !playbackOrPreview &&
        viewMode !== "view" &&
        [...dragGhostById.entries()].map(([ghostId, pos]) => {
          const d = stageDancerById.get(ghostId) ?? null;
          if (!d) return null;
          const hideGlyph =
            bulkHideDancerGlyphs &&
            !playbackOrPreview &&
            selectedDancerIds.length >= 2 &&
            (selectedDancerIds ?? []).includes(ghostId);
          const dMarkerPx = effectiveMarkerPx(d);
          const dLabelFontPx = markerCircleLabelFontPx(dMarkerPx);
          const diRaw = stageDancerIndexById.get(ghostId) ?? -1;
          const di = diRaw >= 0 ? diRaw : 0;
          const ghostLabelWmm = effStageWidthMm ?? 0;
          const circleInnerOptsGhost =
            ghostLabelWmm > 0
              ? { effXPct: pos.xPct, stageWidthMm: ghostLabelWmm }
              : undefined;
          const circleLabel = dancerLabelBelow
            ? dancerCircleInnerBelowLabel(d, di, circleInnerOptsGhost)
            : d.label || "?";
          const facing = normalizeDancerFacingDeg(effectiveFacingDeg(d));
          const labelOffsetPx =
            Math.round(dMarkerPx / 2) + 4 + nameBelowClearanceExtraPx;
          const pivotTransform = `translate(-50%, -50%) rotate(${facing}deg)`;
          const halfMarker = dMarkerPx / 2;
          const screenUnrotateDeg = -(rot + facing);
          const belowNameFontPx = markerBelowLabelFontPx(dLabelFontPx);
          const belowLabelOriginYpx =
            -labelOffsetPx + Math.round((belowNameFontPx * 1.12) / 2);
          return (
            <StageDancerDragGhostItem
              key={`drag-ghost-${ghostId}`}
              xPct={pos.xPct}
              yPct={pos.yPct}
              pivotTransform={pivotTransform}
              halfMarker={halfMarker}
              markerPx={dMarkerPx}
              fillHex={DANCER_PALETTE[modDancerColorIndex(d.colorIndex)]}
              labelFontPx={dLabelFontPx}
              hideGlyph={hideGlyph}
              circleLabel={circleLabel}
              screenUnrotateDeg={screenUnrotateDeg}
              showNameBelow={dancerLabelBelow && !hideGlyph}
              labelOffsetPx={labelOffsetPx}
              belowLabelOriginYpx={belowLabelOriginYpx}
              belowNameFontPx={belowNameFontPx}
              nameBelowLabel={d.label || "?"}
            />
          );
        })}
      {dancerMarkerElements}
      {primarySelectedDancer && !marquee ? (
        <StagePrimaryMarkerResizeHandle
          xPct={primarySelectedDancer.xPct}
          yPct={primarySelectedDancer.yPct}
          facingDeg={normalizeDancerFacingDeg(
            effectiveFacingDeg(primarySelectedDancer)
          )}
          markerPx={effectiveMarkerPx(primarySelectedDancer)}
          selectedCount={selectedDancerIds.length}
          onPointerDown={onMarkerResizePointerDown}
        />
      ) : null}
      {tapStageToEditLayout ? (
        <StageTapToEditOverlay onPointerDown={onTapEditOverlayPointerDown} />
      ) : null}
    </>
  );
}

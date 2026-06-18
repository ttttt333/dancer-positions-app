/**
 * @file ステージ床のダンサー印（`StageDancerMarkerItem` 列）の組み立て。`StageBoardBody` の見通し用フック。
 */
import type { PointerEvent as ReactPointerEvent } from "react";
import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
  normalizeDancerFacingDeg,
} from "../lib/dancerColorPalette";
import {
  dancerCircleInnerBelowLabel,
  layoutMarkerCircleInnerLabel,
} from "../lib/stageBoardModelHelpers";
import {
  dancerNameBelowLabelOffsetPx,
} from "../lib/stageNameBelowFontSizing";
import type { DancerSpot } from "../types/choreography";
import { StageDancerMarkerItem } from "../components/StageDancerMarkerItem";
import type { StageBoardContextMenuState } from "../components/StageBoardContextMenuLayer";

export type UseStageDancerMarkerElementsParams = {
  dancersForStageMarkers: readonly DancerSpot[];
  effectiveMarkerPx: (d: DancerSpot) => number;
  effectiveFacingDeg: (d: DancerSpot) => number;
  bulkHideDancerGlyphs: boolean;
  playbackOrPreview: boolean;
  selectedDancerIds: readonly string[];
  effStageWidthMm: number | null | undefined;
  dancerLabelBelow: boolean;
  nameBelowClearanceExtraPx: number;
  resolveNameBelowFontPx: (d: DancerSpot, markerPx: number) => number;
  rot: number;
  mmLabel: (xPct: number, yPct: number) => string;
  snapGrid: boolean;
  handlePointerDownDancer: (
    e: ReactPointerEvent,
    dancerId: string,
    xPct: number,
    yPct: number
  ) => void;
  viewMode: "edit" | "view";
  playbackDancers: DancerSpot[] | null;
  previewDancers: DancerSpot[] | null;
  stageInteractionsEnabled: boolean;
  /** 複数選択時の枠線色（`shell.ruby` 相当） */
  rubyAccent: string;
  dancerQuickEditId: string | null;
  setShowStageDancerColorToolbar: Dispatch<SetStateAction<boolean>>;
  setStageContextMenu: Dispatch<SetStateAction<StageBoardContextMenuState>>;
  setDancerQuickEditId: Dispatch<SetStateAction<string | null>>;
  studentViewerFocus:
    | null
    | { kind: "all" }
    | { kind: "one"; crewMemberId: string; label: string };
};

export function useStageDancerMarkerElements(
  params: UseStageDancerMarkerElementsParams
) {
  const {
    dancersForStageMarkers,
    effectiveMarkerPx,
    effectiveFacingDeg,
    bulkHideDancerGlyphs,
    playbackOrPreview,
    selectedDancerIds,
    effStageWidthMm,
    dancerLabelBelow,
    nameBelowClearanceExtraPx,
    resolveNameBelowFontPx,
    rot,
    handlePointerDownDancer,
    viewMode,
    playbackDancers,
    previewDancers,
    stageInteractionsEnabled,
    rubyAccent,
    dancerQuickEditId,
    setShowStageDancerColorToolbar,
    setStageContextMenu,
    setDancerQuickEditId,
    studentViewerFocus,
  } = params;

  return useMemo(
    () =>
      dancersForStageMarkers.map((d, di) => {
        const dMarkerPx = effectiveMarkerPx(d);
        const hideGlyph =
          bulkHideDancerGlyphs &&
          !playbackOrPreview &&
          selectedDancerIds.length >= 2 &&
          selectedDancerIds.includes(d.id);
        const markerLabelWmm = effStageWidthMm ?? 0;
        const facing = normalizeDancerFacingDeg(effectiveFacingDeg(d));
        const screenUnrotateDeg = -(rot + facing);
        const showCenterDistanceAbove =
          d.markerBadgeSource === "centerDistance" &&
          dancerLabelBelow &&
          !playbackOrPreview &&
          viewMode !== "view" &&
          stageInteractionsEnabled &&
          selectedDancerIds.includes(d.id);
        const labelXPct = showCenterDistanceAbove
          ? d.xPct
          : d.centerDistanceLabelXPct ?? d.xPct;
        const circleInnerOptsMarker =
          markerLabelWmm > 0
            ? { effXPct: labelXPct, stageWidthMm: markerLabelWmm }
            : undefined;
        const circleLabel = dancerLabelBelow
          ? dancerCircleInnerBelowLabel(d, di, circleInnerOptsMarker)
          : d.label || "?";
        const centerDistanceAboveLabel =
          showCenterDistanceAbove && markerLabelWmm > 0
            ? {
                text: dancerCircleInnerBelowLabel(d, di, {
                  effXPct: d.xPct,
                  stageWidthMm: markerLabelWmm,
                }),
                fontSizePx: Math.max(
                  13,
                  Math.min(18, Math.round(dMarkerPx * 0.42)),
                ),
                screenUnrotateDeg,
              }
            : undefined;
        const circleInnerLabelLayout = layoutMarkerCircleInnerLabel(
          dMarkerPx,
          circleLabel,
          screenUnrotateDeg
        );
        const dLabelFontPx = circleInnerLabelLayout.fontSizePx;
        const labelOffsetPx = dancerNameBelowLabelOffsetPx(
          dMarkerPx,
          nameBelowClearanceExtraPx
        );
        const pivotTransform = playbackOrPreview
          ? `translate3d(-50%, -50%, 0) rotate(${facing}deg)`
          : `translate(-50%, -50%) rotate(${facing}deg)`;
        const halfMarker = dMarkerPx / 2;
        const belowNameFontPx = resolveNameBelowFontPx(d, dMarkerPx);
        const belowLabelOriginYpx =
          -labelOffsetPx + Math.round((belowNameFontPx * 1.12) / 2);
        const isStudentHighlight = (() => {
          if (!studentViewerFocus || studentViewerFocus.kind === "all") {
            return true;
          }
          const { crewMemberId, label } = studentViewerFocus;
          if (d.crewMemberId && d.crewMemberId === crewMemberId) return true;
          if ((d.label ?? "").trim() === (label ?? "").trim()) return true;
          return false;
        })();
        const onePersonMode =
          studentViewerFocus != null && studentViewerFocus.kind === "one";
        const zMark =
          onePersonMode && isStudentHighlight
            ? 8
            : showCenterDistanceAbove
              ? 7
              : 4;
        const pivotOpacityDimmed = onePersonMode && !isStudentHighlight;
        const interactionLocked =
          viewMode === "view" ||
          Boolean(playbackDancers) ||
          Boolean(previewDancers) ||
          !stageInteractionsEnabled;
        const borderCss =
          dancerQuickEditId === d.id
            ? "2px solid rgba(99,102,241,0.95)"
            : selectedDancerIds.includes(d.id)
              ? selectedDancerIds.length >= 2
                ? `2px solid ${rubyAccent}`
                : "2px solid rgba(251,191,36,0.92)"
              : "2px solid rgba(255,255,255,0.35)";
        const cursorCss =
          dancerQuickEditId === d.id
            ? "default"
            : interactionLocked
              ? "default"
              : "grab";
        const pointerEventsCss: "auto" | "none" = interactionLocked
          ? "none"
          : "auto";
        const boxShadowCss =
          onePersonMode && isStudentHighlight
            ? "0 0 0 2px rgba(250, 204, 21, 0.95), 0 4px 18px rgba(0,0,0,0.5)"
            : "0 4px 14px rgba(0,0,0,0.35)";
        const scaleTransform =
          onePersonMode && isStudentHighlight ? "scale(1.12)" : "scale(1)";
        return (
          <StageDancerMarkerItem
            key={d.id}
            dancerId={d.id}
            xPct={d.xPct}
            yPct={d.yPct}
            nameBelowLabel={d.label || "?"}
            pivotTransform={pivotTransform}
            zMark={zMark}
            playbackOrPreview={playbackOrPreview}
            pivotOpacityDimmed={pivotOpacityDimmed}
            onPointerDownButton={(e) =>
              handlePointerDownDancer(e, d.id, d.xPct, d.yPct)
            }
            onContextMenuButton={(e) => {
              if (interactionLocked) return;
              e.preventDefault();
              e.stopPropagation();
              setShowStageDancerColorToolbar(true);
              setStageContextMenu({
                kind: "dancer",
                clientX: e.clientX,
                clientY: e.clientY,
                dancerId: d.id,
              });
            }}
            onDoubleClickButton={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (interactionLocked) return;
              setDancerQuickEditId(d.id);
            }}
            halfMarker={halfMarker}
            markerPx={dMarkerPx}
            borderCss={borderCss}
            fillHex={DANCER_PALETTE[modDancerColorIndex(d.colorIndex)]}
            labelFontPx={dLabelFontPx}
            cursorCss={cursorCss}
            pointerEventsCss={pointerEventsCss}
            boxShadowCss={boxShadowCss}
            scaleTransform={scaleTransform}
            hideGlyph={hideGlyph}
            circleLabel={circleLabel}
            circleInnerLabelSpanStyle={circleInnerLabelLayout.spanStyle}
            centerDistanceAboveLabel={centerDistanceAboveLabel}
            screenUnrotateDeg={screenUnrotateDeg}
            showNameBelow={dancerLabelBelow && !hideGlyph}
            labelOffsetPx={labelOffsetPx}
            belowLabelOriginYpx={belowLabelOriginYpx}
            belowNameFontPx={belowNameFontPx}
            isStudentHighlight={isStudentHighlight}
            onePersonMode={onePersonMode}
          />
        );
      }),
    [
      dancersForStageMarkers,
      effectiveFacingDeg,
      effectiveMarkerPx,
      bulkHideDancerGlyphs,
      playbackOrPreview,
      selectedDancerIds,
      effStageWidthMm,
      dancerLabelBelow,
      nameBelowClearanceExtraPx,
      resolveNameBelowFontPx,
      rot,
      handlePointerDownDancer,
      viewMode,
      playbackDancers,
      previewDancers,
      stageInteractionsEnabled,
      rubyAccent,
      dancerQuickEditId,
      setShowStageDancerColorToolbar,
      setStageContextMenu,
      setDancerQuickEditId,
      studentViewerFocus,
    ]
  );
}

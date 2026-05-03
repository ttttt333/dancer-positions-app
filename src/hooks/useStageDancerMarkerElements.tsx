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
  markerBelowLabelFontPx,
  markerCircleLabelFontPx,
} from "../lib/stageBoardModelHelpers";
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
    rot,
    mmLabel,
    snapGrid,
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
        const dLabelFontPx = markerCircleLabelFontPx(dMarkerPx);
        const hideGlyph =
          bulkHideDancerGlyphs &&
          !playbackOrPreview &&
          selectedDancerIds.length >= 2 &&
          (selectedDancerIds ?? []).includes(d.id);
        const markerLabelWmm = effStageWidthMm ?? 0;
        const circleInnerOptsMarker =
          markerLabelWmm > 0
            ? { effXPct: d.xPct, stageWidthMm: markerLabelWmm }
            : undefined;
        const circleLabel = dancerLabelBelow
          ? dancerCircleInnerBelowLabel(d, di, circleInnerOptsMarker)
          : d.label || "?";
        const facing = normalizeDancerFacingDeg(effectiveFacingDeg(d));
        const labelOffsetPx =
          Math.round(dMarkerPx / 2) + 4 + nameBelowClearanceExtraPx;
        const pivotTransform = playbackOrPreview
          ? `translate3d(-50%, -50%, 0) rotate(${facing}deg)`
          : `translate(-50%, -50%) rotate(${facing}deg)`;
        const halfMarker = dMarkerPx / 2;
        const screenUnrotateDeg = -(rot + facing);
        const belowNameFontPx = markerBelowLabelFontPx(dLabelFontPx);
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
        const zMark = onePersonMode && isStudentHighlight ? 8 : 4;
        const pivotOpacityDimmed = onePersonMode && !isStudentHighlight;
        const interactionLocked =
          viewMode === "view" ||
          Boolean(playbackDancers) ||
          Boolean(previewDancers) ||
          !stageInteractionsEnabled;
        const buttonTitle = !playbackOrPreview
          ? [
              mmLabel(d.xPct, d.yPct),
              "ダブルクリックで名前・身長・学年・性別・スキル・備考",
              "右クリックで削除・並べ替えメニュー",
              "ポインタを画面の左端へ寄せるとゴミ箱が出ます。そこへドロップで削除",
              "Shift / Cmd / Ctrl+クリックで複数選択に追加",
              "空のステージをドラッグで範囲選択",
              snapGrid ? "Shift+ドラッグで細かいグリッドにスナップ" : null,
              "Alt+矢印で微移動（Shift+Altでさらに細かく）",
              "⌘D / Ctrl+D で選択メンバーを複製",
              "Alt+クリックで重なった印の背面へ切替（§10）",
              facing !== 0
                ? `向き ${facing}°（印の下の丸ハンドルをドラッグで変更）`
                : "印の下の丸いハンドルで向きを変更",
            ]
              .filter(Boolean)
              .join(" · ")
          : mmLabel(d.xPct, d.yPct) || undefined;
        const borderCss =
          dancerQuickEditId === d.id
            ? "2px solid rgba(99,102,241,0.95)"
            : (selectedDancerIds ?? []).includes(d.id)
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
            buttonTitle={buttonTitle}
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
            screenUnrotateDeg={screenUnrotateDeg}
            showNameBelow={dancerLabelBelow && !hideGlyph}
            labelOffsetPx={labelOffsetPx}
            belowLabelOriginYpx={belowLabelOriginYpx}
            belowNameFontPx={belowNameFontPx}
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
      rot,
      mmLabel,
      snapGrid,
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

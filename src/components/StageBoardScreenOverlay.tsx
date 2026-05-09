import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  FloorTextMarkupBlock,
  type FloorTextMarkupBlockProps,
} from "./FloorTextMarkupBlock";
import { FloorTextPlacePreview } from "./FloorTextPlacePreview";
import { FloorTextDraftGhostPreview } from "./FloorTextDraftGhostPreview";
import { StageScreenOverlayPortal } from "./StageScreenOverlayPortal";
import type {
  FloorTextPlaceSession,
  StageFloorTextMarkup,
} from "../types/choreography";
import type { FloorTextDraftShape } from "./FloorTextDraftEditorForm";

/** `FloorTextMarkupBlock` の screen 用共有 props（`markup` / `coordLayer` 除く） */
export type StageBoardScreenMarkupSharedProps = Omit<
  FloorTextMarkupBlockProps,
  "markup" | "coordLayer"
>;

export type StageBoardScreenOverlayProps = {
  root: HTMLElement | null;
  open: boolean;
  screenFloorTexts: StageFloorTextMarkup[];
  markupShared: StageBoardScreenMarkupSharedProps;
  screenSetPieceElements: ReactNode;
  floorTextPlaceSession: FloorTextPlaceSession | null;
  setPiecesEditable: boolean;
  playbackOrPreview: boolean;
  onFloorTextPlaceSessionChange?: (next: FloorTextPlaceSession) => void;
  onFloorTextPlacePreviewPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>
  ) => void;
  /** テキストツール: 入力中ドラフトのゴーストプレビュー */
  floorTextDraftGhost?: FloorTextDraftShape | null;
  /** screen 座標での表示位置 (%) — 省略時は中央 */
  floorTextGhostPos?: { xPct: number; yPct: number };
  /** floorMarkupTool 現在値 */
  floorMarkupTool?: null | "text" | "line" | "erase";
};

/**
 * 編集画面全体に重ねる screen レイヤー（床テキスト・大道具プレビュー・置き位置プレビュー）。
 */
export function StageBoardScreenOverlay({
  root,
  open,
  screenFloorTexts,
  markupShared,
  screenSetPieceElements,
  floorTextPlaceSession,
  setPiecesEditable,
  playbackOrPreview,
  onFloorTextPlaceSessionChange,
  onFloorTextPlacePreviewPointerDown,
  floorTextDraftGhost,
  floorTextGhostPos,
  floorMarkupTool,
}: StageBoardScreenOverlayProps) {
  return (
    <StageScreenOverlayPortal root={root} open={open}>
      {screenFloorTexts.map((m) => (
        <FloorTextMarkupBlock
          key={m.id}
          markup={m}
          coordLayer="screen"
          {...markupShared}
        />
      ))}
      {screenSetPieceElements}
      {floorTextPlaceSession &&
      !floorTextPlaceSession.editTargetId &&
      setPiecesEditable &&
      !playbackOrPreview &&
      onFloorTextPlaceSessionChange ? (
        <FloorTextPlacePreview
          session={floorTextPlaceSession}
          dragTitle="ドラッグで位置を調整。編集画面の空所をクリックしても移動できます。"
          maxWidth="min(42vw, 520px)"
          onPointerDown={onFloorTextPlacePreviewPointerDown}
        />
      ) : null}
      {floorMarkupTool === "text" &&
      !playbackOrPreview &&
      setPiecesEditable &&
      floorTextDraftGhost &&
      !floorTextPlaceSession ? (
        <FloorTextDraftGhostPreview
          draft={floorTextDraftGhost}
          xPct={floorTextGhostPos?.xPct ?? 50}
          yPct={floorTextGhostPos?.yPct ?? 50}
        />
      ) : null}
    </StageScreenOverlayPortal>
  );
}

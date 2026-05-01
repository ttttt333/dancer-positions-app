import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  FloorTextMarkupBlock,
  type FloorTextMarkupBlockProps,
} from "./FloorTextMarkupBlock";
import { FloorTextPlacePreview } from "./FloorTextPlacePreview";
import { StageScreenOverlayPortal } from "./StageScreenOverlayPortal";
import type {
  FloorTextPlaceSession,
  StageFloorTextMarkup,
} from "../types/choreography";

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
    </StageScreenOverlayPortal>
  );
}

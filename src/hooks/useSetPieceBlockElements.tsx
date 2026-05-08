/**
 * @file 大道具 `SetPieceBlock` 列の組み立て。ステージ座標とスクリーン座標で `coord` のみが異なるため共通フックに寄せる。
 */
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useMemo } from "react";
import type { SetPiece } from "../types/choreography";
import type { SetPieceResizeHandle } from "../lib/stageBoardModelHelpers";
import { SetPieceBlock } from "../components/SetPieceBlock";

export type UseSetPieceBlockElementsParams = {
  pieces: readonly SetPiece[];
  coord: "stage" | "screen";
  selectedSetPieceId: string | null;
  setPiecesEditable: boolean;
  snapGrid: boolean;
  viewMode: "edit" | "view";
  playbackOrPreview: boolean;
  onBodyPointerDown: (
    e: ReactPointerEvent<HTMLButtonElement>,
    piece: SetPiece
  ) => void;
  onBodyContextMenu: (
    e: ReactMouseEvent<HTMLButtonElement>,
    piece: SetPiece
  ) => void;
  onToggleInterpolateInGaps: (piece: SetPiece) => void;
  onResizePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    piece: SetPiece,
    handle: SetPieceResizeHandle
  ) => void;
  onRotatePointerDown: (
    e: ReactPointerEvent<HTMLButtonElement>,
    piece: SetPiece
  ) => void;
};

export function useSetPieceBlockElements(
  params: UseSetPieceBlockElementsParams
) {
  const {
    pieces,
    coord,
    selectedSetPieceId,
    setPiecesEditable,
    snapGrid,
    viewMode,
    playbackOrPreview,
    onBodyPointerDown,
    onBodyContextMenu,
    onToggleInterpolateInGaps,
    onResizePointerDown,
    onRotatePointerDown,
  } = params;

  return useMemo(
    () =>
      pieces.map((p) => (
        <SetPieceBlock
          key={p.id}
          piece={p}
          coord={coord}
          selected={selectedSetPieceId === p.id}
          setPiecesEditable={setPiecesEditable}
          snapGrid={snapGrid}
          viewMode={viewMode}
          playbackOrPreview={playbackOrPreview}
          onBodyPointerDown={onBodyPointerDown}
          onBodyContextMenu={onBodyContextMenu}
          onToggleInterpolateInGaps={onToggleInterpolateInGaps}
          onResizePointerDown={onResizePointerDown}
          onRotatePointerDown={onRotatePointerDown}
        />
      )),
    [
      pieces,
      coord,
      selectedSetPieceId,
      setPiecesEditable,
      snapGrid,
      viewMode,
      playbackOrPreview,
      onBodyPointerDown,
      onBodyContextMenu,
      onToggleInterpolateInGaps,
      onResizePointerDown,
      onRotatePointerDown,
    ]
  );
}

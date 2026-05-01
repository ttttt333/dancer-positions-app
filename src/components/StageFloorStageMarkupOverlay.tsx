import type { PointerEvent as ReactPointerEvent } from "react";
import type { FloorTextPlaceSession, StageFloorMarkup } from "../types/choreography";
import { floorTextLayer } from "../lib/stageBoardModelHelpers";
import {
  FloorTextMarkupBlock,
  type FloorTextMarkupBlockProps,
} from "./FloorTextMarkupBlock";
import { FloorTextPlacePreview } from "./FloorTextPlacePreview";
import { StageFloorLineMarkupSvg } from "./StageFloorLineMarkupSvg";

export type StageFloorStageMarkupOverlayProps = {
  displayFloorMarkup: StageFloorMarkup[];
  floorLineDraft: [number, number][] | null;
  floorMarkupTool: null | "text" | "line" | "erase";
  setPiecesEditable: boolean;
  onRemoveFloorLineById: (id: string) => void;
  textShared: Omit<FloorTextMarkupBlockProps, "markup" | "coordLayer">;
  floorTextPlaceSession: FloorTextPlaceSession | null;
  viewportTextOverlayRoot: HTMLElement | null | undefined;
  playbackOrPreview: boolean;
  onFloorTextPlaceSessionChange?: (next: FloorTextPlaceSession) => void;
  onFloorTextPlacePreviewPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>
  ) => void;
};

/** メイン床ブロック上: 線 SVG・床テキスト・置きプレビュー */
export function StageFloorStageMarkupOverlay({
  displayFloorMarkup,
  floorLineDraft,
  floorMarkupTool,
  setPiecesEditable,
  onRemoveFloorLineById,
  textShared,
  floorTextPlaceSession,
  viewportTextOverlayRoot,
  playbackOrPreview,
  onFloorTextPlaceSessionChange,
  onFloorTextPlacePreviewPointerDown,
}: StageFloorStageMarkupOverlayProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <StageFloorLineMarkupSvg
        displayFloorMarkup={displayFloorMarkup}
        floorLineDraft={floorLineDraft}
        floorMarkupTool={floorMarkupTool}
        setPiecesEditable={setPiecesEditable}
        onRemoveLineById={onRemoveFloorLineById}
      />
      {displayFloorMarkup.map((m) => {
        if (m.kind !== "text") return null;
        if (floorTextLayer(m) === "screen") return null;
        return (
          <FloorTextMarkupBlock
            key={m.id}
            markup={m}
            coordLayer="stage"
            {...textShared}
          />
        );
      })}
      {floorTextPlaceSession &&
      !viewportTextOverlayRoot &&
      setPiecesEditable &&
      !playbackOrPreview &&
      onFloorTextPlaceSessionChange ? (
        <FloorTextPlacePreview
          session={floorTextPlaceSession}
          dragTitle="ドラッグで位置を調整。空いた床をクリックしても移動できます。"
          maxWidth="42%"
          onPointerDown={onFloorTextPlacePreviewPointerDown}
        />
      ) : null}
    </div>
  );
}

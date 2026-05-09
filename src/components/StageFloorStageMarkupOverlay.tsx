import type { PointerEvent as ReactPointerEvent } from "react";
import type { FloorTextPlaceSession, StageFloorMarkup } from "../types/choreography";
import { floorTextLayer } from "../lib/stageBoardModelHelpers";
import {
  FloorTextMarkupBlock,
  type FloorTextMarkupBlockProps,
} from "./FloorTextMarkupBlock";
import { FloorTextPlacePreview } from "./FloorTextPlacePreview";
import { FloorTextDraftGhostPreview } from "./FloorTextDraftGhostPreview";
import { StageFloorLineMarkupSvg } from "./StageFloorLineMarkupSvg";
import type { FloorTextDraftShape } from "./FloorTextDraftEditorForm";

export type StageFloorStageMarkupOverlayProps = {
  displayFloorMarkup: StageFloorMarkup[];
  globalFloorMarkup?: StageFloorMarkup[] | null;
  onRemoveGlobalFloorMarkupById?: (id: string) => void;
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
  /** 入力中ドラフトのゴーストプレビュー（floorMarkupTool==="text" かつ未配置のとき） */
  floorTextDraftGhost?: FloorTextDraftShape | null;
  /** ゴーストの表示位置（ステージ % 座標）— 省略時は中央 */
  floorTextGhostPos?: { xPct: number; yPct: number };
};

/** メイン床ブロック上: 線 SVG・床テキスト・置きプレビュー */
export function StageFloorStageMarkupOverlay({
  displayFloorMarkup,
  globalFloorMarkup,
  onRemoveGlobalFloorMarkupById,
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
  floorTextDraftGhost,
  floorTextGhostPos,
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
      {/* 全編共通テキスト（キュー切替に関係なく常時表示） */}
      {(globalFloorMarkup ?? []).map((m) => {
        if (m.kind !== "text") return null;
        if (floorTextLayer(m) === "screen") return null;
        return (
          <FloorTextMarkupBlock
            key={`global-${m.id}`}
            markup={m}
            coordLayer="stage"
            {...textShared}
            onRemoveFloorMarkup={onRemoveGlobalFloorMarkupById ?? textShared.onRemoveFloorMarkup}
          />
        );
      })}
      {floorTextPlaceSession &&
      !floorTextPlaceSession.editTargetId &&
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
    </div>
  );
}

import type { CSSProperties, RefObject } from "react";
import { setPieceLayer } from "../lib/stageBoardModelHelpers";
import {
  StageContextMenuFloorTextBody,
  StageContextMenuSetPieceBody,
} from "./StageContextMenuBodies";
import {
  StageDancerContextMenu,
  type StageDancerContextMenuProps,
} from "./StageDancerContextMenu";

export type StageBoardContextMenuState =
  | { kind: "dancer"; clientX: number; clientY: number; dancerId: string }
  | { kind: "setPiece"; clientX: number; clientY: number; pieceId: string }
  | { kind: "floorText"; clientX: number; clientY: number; markupId: string }
  | null;

export type StageBoardContextMenuLayerProps = {
  menu: Exclude<StageBoardContextMenuState, null>;
  style: CSSProperties;
  containerRef: RefObject<HTMLDivElement | null>;
  onCloseMenu: () => void;
  dancerMenu: Omit<StageDancerContextMenuProps, "anchorDancerId" | "onCloseMenu">;
  viewMode: "edit" | "view";
  setPiecesEditable: boolean;
  playbackDancers: DancerSpot[] | null;
  previewDancers: DancerSpot[] | null;
  removeFloorMarkupById: (id: string) => void;
  writeFormationSetPieces: SetPiece[] | undefined;
  updateActiveFormation: (updater: (f: Formation) => Formation) => void;
  removeSetPieceById: (pieceId: string) => void;
};

/**
 * ステージ上の右クリックメニュー（ダンサー / 床テキスト / 大道具）。
 */
export function StageBoardContextMenuLayer({
  menu,
  style,
  containerRef,
  onCloseMenu,
  dancerMenu,
  viewMode,
  setPiecesEditable,
  playbackDancers,
  previewDancers,
  removeFloorMarkupById,
  writeFormationSetPieces,
  updateActiveFormation,
  removeSetPieceById,
}: StageBoardContextMenuLayerProps) {
  return (
    <div
      ref={containerRef}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {menu.kind === "dancer" ? (
        <StageDancerContextMenu
          anchorDancerId={menu.dancerId}
          onCloseMenu={onCloseMenu}
          {...dancerMenu}
        />
      ) : menu.kind === "floorText" ? (
        <StageContextMenuFloorTextBody
          deleteDisabled={
            viewMode === "view" ||
            !setPiecesEditable ||
            Boolean(playbackDancers) ||
            Boolean(previewDancers)
          }
          onDeleteText={() => {
            if (menu.kind !== "floorText") return;
            removeFloorMarkupById(menu.markupId);
            onCloseMenu();
          }}
        />
      ) : (
        <StageContextMenuSetPieceBody
          piece={writeFormationSetPieces?.find((z) => z.id === menu.pieceId)}
          layerButtonDisabled={
            viewMode === "view" ||
            !setPiecesEditable ||
            Boolean(playbackDancers) ||
            Boolean(previewDancers)
          }
          onToggleLayer={() => {
            if (menu.kind !== "setPiece") return;
            const pid = menu.pieceId;
            onCloseMenu();
            updateActiveFormation((f) => {
              const pieces = [...(f.setPieces ?? [])];
              const idx = pieces.findIndex((x) => x.id === pid);
              if (idx < 0) return f;
              const x = pieces[idx]!;
              const goScreen = setPieceLayer(x) !== "screen";
              pieces[idx] = goScreen
                ? { ...x, layer: "screen" as const }
                : (() => {
                    const { layer: _omit, ...rest } = x;
                    return rest as SetPiece;
                  })();
              return { ...f, setPieces: pieces };
            });
          }}
          onDelete={() => {
            if (menu.kind !== "setPiece") return;
            removeSetPieceById(menu.pieceId);
          }}
        />
      )}
    </div>
  );
}

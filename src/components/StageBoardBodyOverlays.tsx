import { memo } from "react";
import { DancerQuickEditDialog } from "./DancerQuickEditDialog";
import { FloorTextInlineEditPortal } from "./FloorTextInlineEditPortal";
import { TrashDropStripPortal } from "./TrashDropStripPortal";
import { floorTextDraftColorHex } from "../lib/stageBoardModelHelpers";
import type { StageBoardBodyOverlaysProps } from "./stageBoardTypes";

/**
 * StageBoard のレイアウト列の外に出すポータル／ダイアログ（床テキストその場編集・ゴミ箱・クイック編集）。
 * 親はオーバーレイ専用 props を `useMemo` 化し、ここを `memo` で包んで再描画を抑える。
 */
export const StageBoardBodyOverlays = memo(function StageBoardBodyOverlays({
  floorTextInlineRect,
  floorTextEditId,
  floorTextDraft,
  setFloorTextDraft,
  floorTextInlineMarkupScale,
  updateActiveFormation,
  floorTextEditIsGlobal = false,
  onUpdateGlobalMarkup,
  onFloorTextInlineRequestClose,
  showTrashDrop,
  trashHot,
  trashDockViewportRef,
  trashDropEdge = "left",
  onTrashTapDelete,
  dancerQuickEditId,
  quickEditDancerForDialog,
  viewMode,
  onCloseQuickEdit,
  onApplyQuickEdit,
}: StageBoardBodyOverlaysProps) {
  return (
    <>
      {floorTextInlineRect && floorTextEditId === floorTextInlineRect.id ? (
        <FloorTextInlineEditPortal
          layout={{
            left: floorTextInlineRect.left,
            top: floorTextInlineRect.top,
            width: floorTextInlineRect.width,
            height: floorTextInlineRect.height,
          }}
          value={floorTextDraft.body}
          onValueChange={(body) => {
            setFloorTextDraft((d) => ({ ...d, body }));
            const id = floorTextInlineRect.id;
            if (floorTextEditIsGlobal && onUpdateGlobalMarkup) {
              onUpdateGlobalMarkup((prev) =>
                prev.map((x) =>
                  x.id === id && x.kind === "text"
                    ? { ...x, text: body.slice(0, 400) }
                    : x
                )
              );
            } else {
              updateActiveFormation((f) => ({
                ...f,
                floorMarkup: (f.floorMarkup ?? []).map((x) =>
                  x.id === id && x.kind === "text"
                    ? { ...x, text: body.slice(0, 400) }
                    : x
                ),
              }));
            }
          }}
          fontSizePx={floorTextDraft.fontSizePx}
          fontWeight={floorTextDraft.fontWeight}
          fontFamily={floorTextDraft.fontFamily}
          textColor={floorTextDraftColorHex(floorTextDraft.color)}
          markupScale={floorTextInlineMarkupScale}
          onRequestClose={onFloorTextInlineRequestClose}
        />
      ) : null}
      <TrashDropStripPortal
        open={showTrashDrop}
        trashHot={trashHot}
        dockRef={trashDockViewportRef}
        edge={trashDropEdge}
        onTapDelete={onTrashTapDelete}
      />
      <DancerQuickEditDialog
        open={Boolean(dancerQuickEditId && quickEditDancerForDialog)}
        dancer={quickEditDancerForDialog}
        viewMode={viewMode}
        onClose={onCloseQuickEdit}
        onApply={onApplyQuickEdit}
      />
    </>
  );
});

StageBoardBodyOverlays.displayName = "StageBoardBodyOverlays";

import { EMPTY_FLOOR_TEXT_DRAFT } from "../lib/stageBoardModelHelpers";
import {
  StageFloorMarkupFloatingToolbars,
  type StageFloorMarkupFloatingToolbarsProps,
} from "./StageFloorMarkupFloatingToolbars";
import { StageFloorMarkupHiddenLineEraseStrip } from "./StageFloorMarkupHiddenLineEraseStrip";
import { StageFloorMarkupHiddenTextPanel } from "./StageFloorMarkupHiddenTextPanel";

export type StageFloorMarkupToolbarHostProps =
  StageFloorMarkupFloatingToolbarsProps & {
    hideFloorMarkupFloatingToolbars: boolean;
  };

/**
 * メイン床の床マークアップ UI コンテナ（左上の浮遊帯 or 床下パネル）。
 * ポインタのバブリングを止め、床のドラッグ操作と競合しないようにする。
 */
export function StageFloorMarkupToolbarHost({
  hideFloorMarkupFloatingToolbars,
  ...toolbar
}: StageFloorMarkupToolbarHostProps) {
  const {
    floorMarkupTool,
    setFloorMarkupTool,
    floorTextEditId,
    setFloorTextEditId,
    floorTextDraft,
    setFloorTextDraft,
    updateActiveFormation,
    floorLineSessionRef,
    setFloorLineDraft,
    setFloorTextInlineRect,
  } = toolbar;

  const clearLineEraseSession = () => {
    setFloorMarkupTool(null);
    floorLineSessionRef.current = null;
    setFloorLineDraft(null);
    setFloorTextEditId(null);
    setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
    setFloorTextInlineRect(null);
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 6,
        left: 6,
        right: 6,
        zIndex: 37,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: "calc(100% - 12px)",
      }}
    >
      {!hideFloorMarkupFloatingToolbars ? (
        <StageFloorMarkupFloatingToolbars {...toolbar} />
      ) : null}
      {hideFloorMarkupFloatingToolbars && floorMarkupTool === "text" ? (
        <StageFloorMarkupHiddenTextPanel
          floorTextEditId={floorTextEditId}
          setFloorTextEditId={setFloorTextEditId}
          floorTextDraft={floorTextDraft}
          setFloorTextDraft={setFloorTextDraft}
          updateActiveFormation={updateActiveFormation}
          setFloorMarkupTool={setFloorMarkupTool}
          setFloorTextInlineRect={setFloorTextInlineRect}
        />
      ) : null}
      {hideFloorMarkupFloatingToolbars &&
      (floorMarkupTool === "line" || floorMarkupTool === "erase") ? (
        <StageFloorMarkupHiddenLineEraseStrip
          tool={floorMarkupTool}
          onDone={clearLineEraseSession}
        />
      ) : null}
    </div>
  );
}

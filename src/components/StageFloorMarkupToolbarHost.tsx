import { createPortal } from "react-dom";
import {
  StageFloorMarkupFloatingToolbars,
  type StageFloorMarkupFloatingToolbarsProps,
} from "./StageFloorMarkupFloatingToolbars";
import { StageFloorMarkupHiddenTextPanel } from "./StageFloorMarkupHiddenTextPanel";

export type StageFloorMarkupToolbarHostProps =
  StageFloorMarkupFloatingToolbarsProps & {
    hideFloorMarkupFloatingToolbars: boolean;
    /** テキストパネルをこの要素にポータル表示する（右サイドシート用）。指定時はステージ上には表示しない */
    textPanelPortalTarget?: HTMLElement | null;
  };

/**
 * メイン床の床マークアップ UI コンテナ（左上の浮遊帯 or 床下パネル）。
 * ポインタのバブリングを止め、床のドラッグ操作と競合しないようにする。
 */
export function StageFloorMarkupToolbarHost({
  hideFloorMarkupFloatingToolbars,
  textPanelPortalTarget,
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
    setFloorTextInlineRect,
    onAddTemplateText,
    floorTextEditIsGlobal,
    onUpdateGlobalMarkup,
  } = toolbar;

  return (
    <div
      className="stage-floor-markup-toolbar-host"
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
      {/*
        上部ドック時はテキスト浮遊帯だけ隠す（サイドシートへ）。
        落書きは起動入口が他に無いので常にステージ上に出す。
      */}
      <StageFloorMarkupFloatingToolbars
        {...toolbar}
        hideTextToolbar={hideFloorMarkupFloatingToolbars}
      />
      {hideFloorMarkupFloatingToolbars && floorMarkupTool === "text" && !textPanelPortalTarget ? (
        <StageFloorMarkupHiddenTextPanel
          floorTextEditId={floorTextEditId}
          setFloorTextEditId={setFloorTextEditId}
          floorTextDraft={floorTextDraft}
          setFloorTextDraft={setFloorTextDraft}
          updateActiveFormation={updateActiveFormation}
          setFloorMarkupTool={setFloorMarkupTool}
          setFloorTextInlineRect={setFloorTextInlineRect}
          onAddTemplateText={onAddTemplateText}
          floorTextEditIsGlobal={floorTextEditIsGlobal}
          onUpdateGlobalMarkup={onUpdateGlobalMarkup}
        />
      ) : null}
      {hideFloorMarkupFloatingToolbars && floorMarkupTool === "text" && textPanelPortalTarget
        ? createPortal(
            <StageFloorMarkupHiddenTextPanel
              floorTextEditId={floorTextEditId}
              setFloorTextEditId={setFloorTextEditId}
              floorTextDraft={floorTextDraft}
              setFloorTextDraft={setFloorTextDraft}
              updateActiveFormation={updateActiveFormation}
              setFloorMarkupTool={setFloorMarkupTool}
              setFloorTextInlineRect={setFloorTextInlineRect}
              onAddTemplateText={onAddTemplateText}
              floorTextEditIsGlobal={floorTextEditIsGlobal}
              onUpdateGlobalMarkup={onUpdateGlobalMarkup}
            />,
            textPanelPortalTarget
          )
        : null}
    </div>
  );
}

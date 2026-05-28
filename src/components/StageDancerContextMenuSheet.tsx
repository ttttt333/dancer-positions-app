import { EditorSideSheet } from "./EditorSideSheet";
import {
  StageDancerContextMenu,
  type StageDancerContextMenuProps,
} from "./StageDancerContextMenu";

export type StageDancerContextMenuSheetProps = {
  open: boolean;
  onClose: () => void;
  anchorDancerId: string;
} & Omit<StageDancerContextMenuProps, "anchorDancerId" | "onCloseMenu" | "presentation">;

/** 範囲選択後の緑ボタンから開く、右クリックメニューと同等の大きな操作パネル */
export function StageDancerContextMenuSheet({
  open,
  onClose,
  anchorDancerId,
  ...menuProps
}: StageDancerContextMenuSheetProps) {
  return (
    <EditorSideSheet
      open={open}
      onClose={onClose}
      zIndex={10001}
      width="min(400px, 94vw)"
      ariaLabelledBy="stage-dancer-menu-sheet-title"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          color: "#e2e8f0",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "14px 16px 10px",
            borderBottom: "1px solid #334155",
            background: "#07090f",
          }}
        >
          <h2
            id="stage-dancer-menu-sheet-title"
            style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}
          >
            選択した立ち位置
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "12px",
              color: "#94a3b8",
              lineHeight: 1.45,
            }}
          >
            {menuProps.selectedDancerIds.length >= 2
              ? `${menuProps.selectedDancerIds.length} 人を選択中`
              : "1 人を選択中"}
            ・複製・表示・並べ替えなど
          </p>
        </div>
        <div
          className="stage-dancer-menu-sheet-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 14px 20px",
          }}
        >
          <StageDancerContextMenu
            anchorDancerId={anchorDancerId}
            onCloseMenu={onClose}
            presentation="sheet"
            {...menuProps}
          />
        </div>
      </div>
    </EditorSideSheet>
  );
}

import type { ReactNode } from "react";

export type StageBoardMainColumnProps = {
  /** フォーメーション案プレビュー時の帯など。不要なら `null`。 */
  previewBanner: ReactNode;
  /** ステージ枠の外・上側。編集レベル（DANCER / GROUP / FORMATION）。 */
  editModeHeader?: ReactNode;
  /** `StageBoardFitViewport` 〜ステージ本体まで。 */
  stageFrame: ReactNode;
  /** ステージ枠の外・客席側。編集ドック。 */
  editDock?: ReactNode;
  /** 床下の一括ツールバー等。不要なら `null`。 */
  bulkToolbar: ReactNode;
};

/**
 * ステージ画面のメイン列（プレビュー帯・ステージ枠・補助ツールバー）。
 */
export function StageBoardMainColumn({
  previewBanner,
  editModeHeader = null,
  stageFrame,
  editDock = null,
  bulkToolbar,
}: StageBoardMainColumnProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        minHeight: 0,
        flex: 1,
        width: "100%",
      }}
    >
      {previewBanner}
      <div
        className="stage-board-main-slot"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 0,
          /**
           * ステージ枠のリサイズハンドル（左右・上下）が枠より外に
           * わずかに飛び出して配置されるため、padding で隠れないよう
           * 少しだけ外側に余白を確保する。
           */
          padding: "5px",
          overflow: "visible",
        }}
      >
        {editModeHeader ? (
          <div style={{ flexShrink: 0, width: "100%" }}>{editModeHeader}</div>
        ) : null}
        {stageFrame}
        {editDock ? (
          <div style={{ flexShrink: 0, width: "100%" }}>{editDock}</div>
        ) : null}
        {bulkToolbar}
      </div>
    </div>
  );
}

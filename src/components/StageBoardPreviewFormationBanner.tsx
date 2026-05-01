export type StageBoardPreviewFormationBannerProps = {
  /** プレビューダンサーが 1 人以上いるときだけ帯を出す */
  show: boolean;
};

/**
 * フォーメーション案プレビュー時のステージ上メッセージ帯。
 */
export function StageBoardPreviewFormationBanner({
  show,
}: StageBoardPreviewFormationBannerProps) {
  if (!show) return null;
  return (
    <div
      style={{
        fontSize: "11px",
        color: "#64748b",
        textAlign: "center",
        letterSpacing: "0.05em",
      }}
    >
      <div
        style={{
          color: "#c4b5fd",
          fontWeight: 600,
        }}
      >
        フォーメーション案プレビュー
      </div>
    </div>
  );
}

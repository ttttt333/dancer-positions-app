import type { CSSProperties, ReactNode, Ref } from "react";

const stretchColumnStyle: CSSProperties = {
  flex: "1 1 0%",
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  gap: 0,
};

/*
 * コンテナクエリは「舞台ブロック」だけにかける。
 * 下の一括ツールバーを同じ CQ 親に置くと、選択の有無で cqb が変わり
 * 範囲選択直後に舞台がわずらかに動いて見える。
 * 列 flex の alignItems:center だけだと、環境によって狭い枠が左寄りに見えるため、
 * その内側で row + justifyContent:center を挟んで常に中央に置く。
 *
 * `paddingTop` を渡すとコンテナクエリの親に直接かかるため `cqb` が縮小され、
 * ステージ枠が自動的に小さくなる（客席が上の時の帯はみ出し対策）。
 */
export function StageBoardFitViewport({
  children,
  paddingTop,
  paddingBottom,
  alignTop,
  measureRef,
  className,
}: {
  children: ReactNode;
  paddingTop?: number;
  paddingBottom?: number;
  /** true のとき alignItems を flex-start にしてステージを上寄せ */
  alignTop?: boolean;
  /** 実測フィット用（生徒共有横画面） */
  measureRef?: Ref<HTMLDivElement | null>;
  className?: string;
}) {
  const containerQueryRowStyle: CSSProperties = {
    flex: "1 1 0%",
    minHeight: 0,
    minWidth: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: alignTop ? "flex-start" : "center",
    alignSelf: "stretch",
    containerType: "size",
    containerName: "stage-board-fit",
    ...(paddingTop ? { paddingTop } : {}),
    ...(paddingBottom ? { paddingBottom } : {}),
  };

  return (
    <div
      className={["stage-board-fit-viewport", className].filter(Boolean).join(" ")}
      style={stretchColumnStyle}
    >
      <div
        ref={measureRef}
        className="stage-board-fit-viewport-inner"
        style={containerQueryRowStyle}
      >
        {children}
      </div>
    </div>
  );
}

import type { CSSProperties, ReactNode } from "react";

const stretchColumnStyle: CSSProperties = {
  flex: "1 1 0%",
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  gap: 0,
};

const containerQueryRowStyle: CSSProperties = {
  flex: "1 1 0%",
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  alignSelf: "stretch",
  containerType: "size",
  containerName: "stage-board-fit",
};

/*
 * コンテナクエリは「舞台ブロック」だけにかける。
 * 下の一括ツールバーを同じ CQ 親に置くと、選択の有無で cqb が変わり
 * 範囲選択直後に舞台がわずらかに動いて見える。
 * 列 flex の alignItems:center だけだと、環境によって狭い枠が左寄りに見えるため、
 * その内側で row + justifyContent:center を挟んで常に中央に置く。
 */
export function StageBoardFitViewport({ children }: { children: ReactNode }) {
  return (
    <div style={stretchColumnStyle}>
      <div style={containerQueryRowStyle}>{children}</div>
    </div>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { shell } from "../theme/choreoShell";

export type StageMainFloorGridCellProps = {
  /** グリッド中央セル（`gridColumn` / `gridRow` 等を含む） */
  cellStyle: CSSProperties;
  showShell: boolean;
  /** 奥行き帯「舞台裏」の mm（`Bmm`）。帯ありのときはコンパクトな上部ラベルを隠す */
  stageBackDepthMm: number;
  labelScreenKeepUpright: (origin: string) => CSSProperties;
  floor: ReactNode;
  footer: ReactNode;
};

/**
 * シェル付きグリッドの中央セル: コンパクト「舞台裏」行 or スペーサー、メイン床、客席帯。
 */
export function StageMainFloorGridCell({
  cellStyle,
  showShell,
  stageBackDepthMm,
  labelScreenKeepUpright,
  floor,
  footer,
}: StageMainFloorGridCellProps) {
  const showCompactBackLabel = !(showShell && stageBackDepthMm > 0);

  return (
    <div style={cellStyle}>
      {showCompactBackLabel ? (
        <div
          style={{
            flex: "0 0 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.14em",
            color: shell.textMuted,
            pointerEvents: "none",
            userSelect: "none",
            ...labelScreenKeepUpright("top center"),
          }}
        >
          舞台裏
        </div>
      ) : (
        <div
          style={{ flex: "0 0 0px", height: 0, overflow: "hidden" }}
          aria-hidden
        />
      )}
      {floor}
      {footer}
    </div>
  );
}

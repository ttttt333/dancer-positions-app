import type { CSSProperties, ReactNode } from "react";
import { formatMeterCmLabel } from "../lib/stageDimensions";
import { shell } from "../theme/choreoShell";

const stripShellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center" as const,
  fontSize: "10px",
  lineHeight: 1.35,
  color: shell.textMuted,
  background: `linear-gradient(135deg, ${shell.surfaceRaised} 0%, ${shell.surface} 45%, ${shell.surfaceRaised} 100%)`,
  border: `1px solid ${shell.border}`,
  minWidth: 0,
  minHeight: 0,
  padding: "4px",
};

export type StageShellGridLayoutProps = {
  showShell: boolean;
  Bmm: number;
  Dmm: number;
  Wmm: number;
  Smm: number;
  labelScreenKeepUpright: (origin: string) => CSSProperties;
  /** 中央セル（`StageMainFloorGridCell` など） */
  center: ReactNode;
};

/**
 * ステージ本体のシェル付きグリッド: 奥「舞台裏」帯・左右サイド・中央。
 * `showShell` が false のときは単一ブロックのグラデ背景のみ。
 */
export function StageShellGridLayout({
  showShell,
  Bmm,
  Dmm,
  Wmm,
  Smm,
  labelScreenKeepUpright,
  center,
}: StageShellGridLayoutProps) {
  return (
    <div
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        position: "relative",
        overflow: "visible",
        display: showShell ? "grid" : "block",
        ...(showShell
          ? {
              gridTemplateRows:
                Bmm > 0 ? `${Bmm}fr ${Dmm}fr` : `${Dmm}fr`,
              gridTemplateColumns:
                Smm > 0 ? `${Smm}fr ${Wmm}fr ${Smm}fr` : `${Wmm}fr`,
              background: shell.bgDeep,
            }
          : {
              background:
                "linear-gradient(180deg, #1e293b 0%, #0f172a 55%, #020617 100%)",
            }),
      }}
    >
      {showShell && Bmm > 0 && (
        <div
          style={{
            ...stripShellStyle,
            ...labelScreenKeepUpright("center center"),
            gridColumn: "1 / -1",
            gridRow: 1,
            borderBottom: `1px solid ${shell.border}`,
          }}
        >
          舞台裏
          <br />
          {formatMeterCmLabel(Bmm)}
        </div>
      )}
      {showShell && Smm > 0 && (
        <div
          style={{
            ...stripShellStyle,
            ...labelScreenKeepUpright("center center"),
            gridColumn: 1,
            gridRow: Bmm > 0 ? 2 : 1,
            borderRight: `1px solid ${shell.border}`,
          }}
        >
          サイド
          <br />
          {formatMeterCmLabel(Smm)}
        </div>
      )}
      {center}
      {showShell && Smm > 0 && (
        <div
          style={{
            ...stripShellStyle,
            ...labelScreenKeepUpright("center center"),
            gridColumn: 3,
            gridRow: Bmm > 0 ? 2 : 1,
            borderLeft: `1px solid ${shell.border}`,
          }}
        >
          サイド
          <br />
          {formatMeterCmLabel(Smm)}
        </div>
      )}
    </div>
  );
}

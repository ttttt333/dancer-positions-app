import { DANCER_COLOR_PALETTE_HEX } from "../lib/dancerColorPalette";

const RAINBOW = `conic-gradient(${DANCER_COLOR_PALETTE_HEX.slice(0, 8).join(", ")}, ${DANCER_COLOR_PALETTE_HEX[0]})`;

export type DancerColorRandomSwatchProps = {
  size: number;
  radius: number;
  disabled?: boolean;
  onClick: () => void;
};

/** 一括色パレットの「ランダム（バラバラに戻す）」ボタン */
export function DancerColorRandomSwatch({
  size,
  radius,
  disabled = false,
  onClick,
}: DancerColorRandomSwatchProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      title="色をランダム（バラバラ）に戻す"
      aria-label="色をランダムに戻す"
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        border: "1px solid #1e293b",
        background: RAINBOW,
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: Math.max(8, Math.round(size * 0.27)),
        fontWeight: 800,
        textShadow: "0 1px 2px rgba(0,0,0,0.85)",
        lineHeight: 1,
      }}
    >
      {size >= 26 ? "ﾗﾝﾀﾞﾑ" : "?"}
    </button>
  );
}

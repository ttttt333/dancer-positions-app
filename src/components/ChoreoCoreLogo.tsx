import type { CSSProperties } from "react";

const BRAND_LOGO_SRC = "/brand-logo.png";

export type ChoreoCoreLogoProps = {
  /** ロゴの高さ（px）。幅はアスペクト比に従い自動 */
  height?: number;
  /** スクリーンリーダー用ラベル */
  title?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * ChoreoCore ブランドロゴ（横長画像）。
 * height だけ指定すれば幅は自動調整される。
 */
export function ChoreoCoreLogo({
  height = 36,
  title = "ChoreoCore",
  className,
  style,
}: ChoreoCoreLogoProps) {
  return (
    <img
      className={className}
      src={BRAND_LOGO_SRC}
      alt={title}
      height={height}
      decoding="async"
      style={{
        display: "block",
        width: "auto",
        height: `${height}px`,
        objectFit: "contain",
        ...style,
      }}
    />
  );
}

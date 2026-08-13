import type { CSSProperties } from "react";

const APP_ICON_SRC = "/brand/app-icon.png";

export type ChoreoCoreLogoProps = {
  /** アイコンの高さ（px） */
  height?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
  /** 横に CHOREO CORE の文字を出す（ヘッダー用） */
  withWordmark?: boolean;
};

/**
 * ChoreoCore ブランドマーク（金の C + 赤矢印アイコン）。
 * ヘッダーでは withWordmark で「CHOREO CORE」を併記し、視認性を確保する。
 */
export function ChoreoCoreLogo({
  height = 36,
  title = "ChoreoCore",
  className,
  style,
  withWordmark = false,
}: ChoreoCoreLogoProps) {
  const icon = (
    <img
      src={APP_ICON_SRC}
      alt={withWordmark ? "" : title}
      height={height}
      width={height}
      decoding="async"
      className={withWordmark ? undefined : className}
      style={{
        display: "block",
        width: `${height}px`,
        height: `${height}px`,
        objectFit: "contain",
        borderRadius: Math.max(8, Math.round(height * 0.22)),
        boxShadow: "0 0 0 1px rgba(232, 197, 71, 0.35)",
        ...(withWordmark ? undefined : style),
      }}
    />
  );

  if (!withWordmark) return icon;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
        ...style,
      }}
    >
      {icon}
      <span
        aria-label={title}
        style={{
          display: "flex",
          flexDirection: "column",
          lineHeight: 1.05,
          minWidth: 0,
        }}
      >
        <span className="home-wordmark">
          <span className="home-wordmark-choreo">CHOREO</span>
          <span className="home-wordmark-core"> CORE</span>
        </span>
      </span>
    </span>
  );
}

import { shell } from "../theme/choreoShell";

export type ChoreoGridLogoProps = {
  /** 表示サイズ（正方形、px） */
  size?: number;
  /** スクリーンリーダー用。未指定時は "ChoreoGrid" */
  title?: string;
  className?: string;
};

const BRAND_LOGO_SRC = "/brand-logo.png";

/**
 * アプリのブランドロゴ（`public/brand-logo.png`）。
 */
export function ChoreoGridLogo({
  size = 44,
  title = "ChoreoGrid",
  className,
}: ChoreoGridLogoProps) {
  return (
    <img
      className={className}
      src={BRAND_LOGO_SRC}
      alt=""
      width={size}
      height={size}
      role="img"
      aria-label={title}
      decoding="async"
      style={{
        display: "block",
        borderRadius: "50%",
        objectFit: "cover",
        boxSizing: "border-box",
        boxShadow: [
          `0 0 0 1px ${shell.brandRing}`,
          "0 4px 22px rgba(0,0,0,0.55)",
          `0 0 32px ${shell.brandGlow}`,
        ].join(", "),
      }}
    />
  );
}

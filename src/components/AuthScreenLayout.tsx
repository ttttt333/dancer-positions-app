import type { ReactNode } from "react";
import { ChoreoCoreLogo } from "./ChoreoCoreLogo";
import { panelCard, shell } from "../theme/choreoShell";

function BrandMark() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        marginBottom: 20,
      }}
    >
      <ChoreoCoreLogo height={52} title="ChoreoCore" />
    </div>
  );
}

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * ログイン／登録の共通シェル（ダーク・グリッド風・赤アクセントのトーン）。
 */
export function AuthScreenLayout({ title, subtitle, children }: Props) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: shell.bgDeep,
        color: shell.text,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
        WebkitFontSmoothing: "antialiased",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 90% 55% at 50% -18%, ${shell.accentSoft}, transparent 52%),
            radial-gradient(ellipse 55% 35% at 92% 102%, ${shell.rubySoft}, transparent 48%),
            linear-gradient(180deg, ${shell.bgChrome} 0%, ${shell.bgDeep} 48%, #030302 100%)
          `,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.07,
          backgroundImage: `
            linear-gradient(0deg, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding:
            "max(24px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            ...panelCard,
            padding: "clamp(22px, 5vw, 32px) clamp(16px, 5vw, 28px)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          }}
        >
          <BrandMark />
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              style={{
                margin: "0 0 24px",
                fontSize: "13px",
                lineHeight: 1.55,
                color: shell.textMuted,
              }}
            >
              {subtitle}
            </p>
          ) : (
            <div style={{ height: 8 }} />
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

import type { CSSProperties } from "react";
import { btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import { useI18n } from "../i18n/I18nContext";
import type { AppLocale } from "../i18n/types";
import { isAppLocale } from "../i18n/types";

const LOCALE_ORDER: AppLocale[] = ["ja", "en", "ko", "zh"];

/**
 * 画面右下に置く言語セレクタ（日本語・英語・韓国語・簡体中国語）。
 */
export function LanguageSwitcher({
  variant = "floating",
}: {
  /** floating: 固定右下 / inline: 親レイアウトに埋め込み */
  variant?: "floating" | "inline";
}) {
  const { locale, setLocale, t } = useI18n();

  const wrap: CSSProperties =
    variant === "floating"
      ? {
          position: "fixed",
          bottom: "max(10px, env(safe-area-inset-bottom, 0px))",
          right: "max(10px, env(safe-area-inset-right, 0px))",
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderRadius: 10,
          border: `1px solid ${shell.borderStrong}`,
          background: "rgba(10, 9, 8, 0.92)",
          boxShadow: `0 4px 22px rgba(0,0,0,0.45), 0 0 0 1px ${shell.brandGlow}`,
          backdropFilter: "blur(8px)",
        }
      : {
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        };

  return (
    <div style={wrap} className="app-language-switcher" role="group" aria-label={t("lang.label")}>
      <span
        style={{
          fontSize: 10,
          color: "#64748b",
          fontWeight: 700,
          letterSpacing: "0.04em",
          userSelect: "none",
        }}
      >
        {t("lang.label")}
      </span>
      <select
        id="choreogrid-locale-select"
        aria-label={t("lang.label")}
        value={locale}
        onChange={(e) => {
          const v = e.target.value;
          if (isAppLocale(v)) setLocale(v);
        }}
        style={{
          ...btnSecondary,
          padding: "4px 8px",
          fontSize: 12,
          borderRadius: 8,
          cursor: "pointer",
          maxWidth: 140,
          color: "#e2e8f0",
        }}
      >
        {LOCALE_ORDER.map((code) => (
          <option key={code} value={code}>
            {t(`lang.${code}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

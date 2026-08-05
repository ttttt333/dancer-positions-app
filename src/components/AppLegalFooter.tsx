import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nContext";
import { TOKUSHOHO_PATH } from "../lib/commercialDisclosure";

type Props = {
  style?: CSSProperties;
};

/** フッター用：特定商取引法表記へのリンク */
export function AppLegalFooter({ style }: Props) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("legal.navAria")}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 16px",
        fontSize: 12,
        ...style,
      }}
    >
      <Link
        to={TOKUSHOHO_PATH}
        style={{ color: "#64748b", textDecoration: "underline" }}
      >
        {t("legal.tokushoho.link")}
      </Link>
    </nav>
  );
}

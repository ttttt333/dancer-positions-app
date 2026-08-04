import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { TOKUSHOHO_PATH } from "../lib/commercialDisclosure";

type Props = {
  style?: CSSProperties;
};

/** フッター用：特定商取引法表記へのリンク */
export function AppLegalFooter({ style }: Props) {
  return (
    <nav
      aria-label="法的情報"
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
        特定商取引法に基づく表記
      </Link>
    </nav>
  );
}

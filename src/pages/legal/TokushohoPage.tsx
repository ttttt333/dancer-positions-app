import { Link } from "react-router-dom";
import { BUSINESS, SERVICE_NAME, TOKUSHOHO_ROWS } from "../../lib/commercialDisclosure";
import { btnSecondary } from "../../components/stageButtonStyles";

export function TokushohoPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        padding: "28px 20px 48px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
          {SERVICE_NAME} / {BUSINESS.name}
        </p>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#f8fafc" }}>
          特定商取引法に基づく表記
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 12, lineHeight: 1.5, color: "#64748b" }}>
          本ページは一般的な情報開示のためのものです。［要記入］の項目は事業者情報が確定次第更新します。
        </p>

        <dl style={{ margin: 0 }}>
          {TOKUSHOHO_ROWS.map((row) => (
            <div
              key={row.label}
              style={{
                marginBottom: 18,
                paddingBottom: 16,
                borderBottom: "1px solid #1e293b",
              }}
            >
              <dt
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#94a3b8",
                }}
              >
                {row.label}
              </dt>
              <dd
                style={{
                  margin: "8px 0 0",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#e2e8f0",
                  whiteSpace: "pre-wrap",
                }}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <Link
          to="/"
          style={{
            ...btnSecondary,
            textDecoration: "none",
            display: "inline-block",
            marginTop: 8,
          }}
        >
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}

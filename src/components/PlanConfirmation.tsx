import { Link } from "react-router-dom";
import {
  PLAN_CONFIRMATION_ITEMS,
  PRO_PRICE_YEN_TAX_IN,
  PRO_TRIAL_DAYS,
  TOKUSHOHO_PATH,
} from "../lib/commercialDisclosure";
import { btnAccent, btnSecondary } from "./stageButtonStyles";

type Props = {
  confirmed: boolean;
  onConfirmedChange: (v: boolean) => void;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

/**
 * 特定商取引法（2022年改正）対応：申込みボタン直前に表示する契約内容要約。
 */
export function PlanConfirmation({
  confirmed,
  onConfirmedChange,
  busy,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="plan-confirmation" style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: 20,
          fontWeight: 700,
          color: "#f8fafc",
        }}
      >
        お申し込み内容の確認
      </h1>
      <p
        style={{
          margin: "0 0 20px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "#94a3b8",
        }}
      >
        下記の内容をご確認のうえ、お申し込みください。
        <span style={{ display: "block", marginTop: 6, color: "#e2e8f0", fontWeight: 600 }}>
          月額{PRO_PRICE_YEN_TAX_IN}円（税込）・解約しない限り自動更新
        </span>
        <span style={{ display: "block", marginTop: 4, color: "#fbbf24", fontWeight: 600 }}>
          本日から{PRO_TRIAL_DAYS}日間無料。その後クレジットカードへ
          {PRO_PRICE_YEN_TAX_IN}円が課金されます。
        </span>
      </p>

      <dl
        style={{
          margin: "0 0 20px",
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid #334155",
          background: "rgba(15, 23, 42, 0.85)",
        }}
      >
        {PLAN_CONFIRMATION_ITEMS.map((item) => (
          <div
            key={item.term}
            style={{
              marginBottom: 14,
              paddingBottom: 14,
              borderBottom: "1px solid #1e293b",
            }}
          >
            <dt
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                color: "#94a3b8",
                letterSpacing: "0.02em",
              }}
            >
              {item.term}
            </dt>
            <dd
              style={{
                margin: "6px 0 0",
                fontSize: 14,
                lineHeight: 1.55,
                color: "#e2e8f0",
                whiteSpace: "pre-wrap",
              }}
            >
              {item.description}
            </dd>
          </div>
        ))}
        <div style={{ marginBottom: 0 }}>
          <dt
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              color: "#94a3b8",
            }}
          >
            詳細表記
          </dt>
          <dd style={{ margin: "6px 0 0", fontSize: 13 }}>
            <Link
              to={TOKUSHOHO_PATH}
              style={{ color: "#93c5fd", textDecoration: "underline" }}
            >
              特定商取引法に基づく表記
            </Link>
          </dd>
        </div>
      </dl>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 16,
          fontSize: 13,
          lineHeight: 1.45,
          color: "#e2e8f0",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
        />
        <span>上記の内容を確認しました</span>
      </label>

      {error ? (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#f87171" }}>{error}</p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          disabled={busy || !confirmed}
          style={{
            ...btnAccent,
            width: "100%",
            fontWeight: 700,
            minHeight: 48,
            opacity: busy || !confirmed ? 0.55 : 1,
          }}
          onClick={onConfirm}
        >
          {busy ? "決済画面へ移動中…" : "この内容で申し込む"}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={busy}
            style={{ ...btnSecondary, width: "100%" }}
            onClick={onCancel}
          >
            戻る
          </button>
        ) : null}
      </div>
    </div>
  );
}

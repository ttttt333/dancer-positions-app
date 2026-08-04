import { Link } from "react-router-dom";
import {
  planConfirmationItems,
  PRO_ANNUAL_PRICE_YEN_TAX_IN,
  PRO_PRICE_YEN_TAX_IN,
  PRO_TRIAL_DAYS,
  TOKUSHOHO_PATH,
  type ProCheckoutPlan,
} from "../lib/commercialDisclosure";
import { btnAccent, btnSecondary } from "./stageButtonStyles";

type Props = {
  plan: ProCheckoutPlan;
  onPlanChange: (plan: ProCheckoutPlan) => void;
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
  plan,
  onPlanChange,
  confirmed,
  onConfirmedChange,
  busy,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const items = planConfirmationItems(plan);
  const isAnnual = plan === "annual";

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
          margin: "0 0 16px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "#94a3b8",
        }}
      >
        プランを選び、下記の内容をご確認のうえお申し込みください。
      </p>

      <div
        role="radiogroup"
        aria-label="プラン選択"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <PlanOption
          selected={!isAnnual}
          disabled={busy}
          title="月額"
          subtitle={`${PRO_PRICE_YEN_TAX_IN}円/月（税込）`}
          hint={`${PRO_TRIAL_DAYS}日無料・カード`}
          onSelect={() => onPlanChange("monthly")}
        />
        <PlanOption
          selected={isAnnual}
          disabled={busy}
          title="年額"
          subtitle={`${PRO_ANNUAL_PRICE_YEN_TAX_IN}円/年（税込）`}
          hint="PayPay・カード可"
          onSelect={() => onPlanChange("annual")}
        />
      </div>

      <p
        style={{
          margin: "0 0 20px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "#94a3b8",
        }}
      >
        {isAnnual ? (
          <>
            <span
              style={{ display: "block", color: "#e2e8f0", fontWeight: 600 }}
            >
              年額{PRO_ANNUAL_PRICE_YEN_TAX_IN}円（税込）・1年間・自動更新なし
            </span>
            <span
              style={{
                display: "block",
                marginTop: 4,
                color: "#fbbf24",
                fontWeight: 600,
              }}
            >
              PayPay またはクレジットカードで一括支払い（トライアルなし）
            </span>
          </>
        ) : (
          <>
            <span
              style={{ display: "block", color: "#e2e8f0", fontWeight: 600 }}
            >
              月額{PRO_PRICE_YEN_TAX_IN}円（税込）・解約しない限り自動更新
            </span>
            <span
              style={{
                display: "block",
                marginTop: 4,
                color: "#fbbf24",
                fontWeight: 600,
              }}
            >
              本日から{PRO_TRIAL_DAYS}日間無料。その後クレジットカードへ
              {PRO_PRICE_YEN_TAX_IN}円が課金されます。
            </span>
          </>
        )}
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
        {items.map((item) => (
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
          {busy
            ? "決済画面へ移動中…"
            : isAnnual
              ? "この内容で申し込む（PayPay / カード）"
              : "この内容で申し込む（カード）"}
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

function PlanOption({
  selected,
  disabled,
  title,
  subtitle,
  hint,
  onSelect,
}: {
  selected: boolean;
  disabled: boolean;
  title: string;
  subtitle: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 10,
        border: selected ? "2px solid #fbbf24" : "1px solid #334155",
        background: selected ? "rgba(251,191,36,0.12)" : "rgba(15,23,42,0.6)",
        color: "#e2e8f0",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 13, color: "#f8fafc" }}>{subtitle}</div>
      <div style={{ marginTop: 4, fontSize: 11, color: "#94a3b8" }}>{hint}</div>
    </button>
  );
}

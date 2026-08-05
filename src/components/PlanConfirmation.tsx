import { Link } from "react-router-dom";
import {
  PRO_ANNUAL_DAYS,
  PRO_ANNUAL_PRICE_YEN_TAX_IN,
  PRO_PRICE_YEN_TAX_IN,
  PRO_TRIAL_DAYS,
  TOKUSHOHO_PATH,
  type ProCheckoutPlan,
} from "../lib/commercialDisclosure";
import { useI18n } from "../i18n/I18nContext";
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
  const { t } = useI18n();
  const isAnnual = plan === "annual";
  const price = isAnnual ? PRO_ANNUAL_PRICE_YEN_TAX_IN : PRO_PRICE_YEN_TAX_IN;
  const prefix = isAnnual ? "billing.confirm.annual" : "billing.confirm.monthly";
  const items = [
    {
      term: t("billing.confirm.term.plan"),
      description: t(`${prefix}.plan`),
    },
    {
      term: t("billing.confirm.term.price"),
      description: t(`${prefix}.price`, {
        price,
        days: isAnnual ? PRO_ANNUAL_DAYS : PRO_TRIAL_DAYS,
      }),
    },
    {
      term: t("billing.confirm.term.payment"),
      description: t(`${prefix}.payment`, {
        price: PRO_PRICE_YEN_TAX_IN,
        days: PRO_TRIAL_DAYS,
        chargeDay: PRO_TRIAL_DAYS + 1,
      }),
    },
    {
      term: t("billing.confirm.term.delivery"),
      description: t(`${prefix}.delivery`),
    },
    {
      term: t("billing.confirm.term.period"),
      description: t(`${prefix}.period`),
    },
    {
      term: t("billing.confirm.term.cancel"),
      description: t(`${prefix}.cancel`),
    },
  ];

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
        {t("billing.confirm.title")}
      </h1>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "#94a3b8",
        }}
      >
        {t("billing.confirm.lead")}
      </p>

      <div
        role="radiogroup"
        aria-label={t("billing.confirm.planGroupAria")}
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
          title={t("billing.confirm.monthly")}
          subtitle={t("billing.confirm.monthlyPrice", {
            price: PRO_PRICE_YEN_TAX_IN,
          })}
          hint={t("billing.confirm.monthlyHint", { days: PRO_TRIAL_DAYS })}
          onSelect={() => onPlanChange("monthly")}
        />
        <PlanOption
          selected={isAnnual}
          disabled={busy}
          title={t("billing.confirm.annual")}
          subtitle={t("billing.confirm.annualPrice", {
            price: PRO_ANNUAL_PRICE_YEN_TAX_IN,
          })}
          hint={t("billing.confirm.annualHint")}
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
              {t("billing.confirm.annualHighlight1", {
                price: PRO_ANNUAL_PRICE_YEN_TAX_IN,
              })}
            </span>
            <span
              style={{
                display: "block",
                marginTop: 4,
                color: "#fbbf24",
                fontWeight: 600,
              }}
            >
              {t("billing.confirm.annualHighlight2")}
            </span>
          </>
        ) : (
          <>
            <span
              style={{ display: "block", color: "#e2e8f0", fontWeight: 600 }}
            >
              {t("billing.confirm.monthlyHighlight1", {
                price: PRO_PRICE_YEN_TAX_IN,
              })}
            </span>
            <span
              style={{
                display: "block",
                marginTop: 4,
                color: "#fbbf24",
                fontWeight: 600,
              }}
            >
              {t("billing.confirm.monthlyHighlight2", {
                days: PRO_TRIAL_DAYS,
                price: PRO_PRICE_YEN_TAX_IN,
              })}
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
            {t("billing.confirm.detailLabel")}
          </dt>
          <dd style={{ margin: "6px 0 0", fontSize: 13 }}>
            <Link
              to={TOKUSHOHO_PATH}
              style={{ color: "#93c5fd", textDecoration: "underline" }}
            >
              {t("legal.tokushoho.link")}
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
        <span>{t("billing.confirm.checkbox")}</span>
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
            ? t("billing.confirm.submitBusy")
            : isAnnual
              ? t("billing.confirm.submitAnnual")
              : t("billing.confirm.submitMonthly")}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={busy}
            style={{ ...btnSecondary, width: "100%" }}
            onClick={onCancel}
          >
            {t("billing.confirm.back")}
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

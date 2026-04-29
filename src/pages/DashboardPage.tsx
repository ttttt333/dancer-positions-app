import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { billingApi, isDemoSessionToken, projectApi } from "../api/client";
import { ChoreoCoreLogo } from "../components/ChoreoCoreLogo";
import { btnAccent, btnSecondary } from "../components/stageButtonStyles";
import { panelCard, shell } from "../theme/choreoShell";

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function DashboardPage() {
  const { t } = useI18n();
  const { ready, me, logout, refresh } = useAuth();
  const [projects, setProjects] = useState<
    { id: number; name: string; updated_at: string }[]
  >([]);
  const [error, setError] = useState("");
  const [accountNotice, setAccountNotice] = useState("");

  useEffect(() => {
    if (!me) {
      setProjects([]);
      return;
    }
    let c = false;
    (async () => {
      try {
        const list = await projectApi.list();
        if (!c) setProjects(list);
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : t("dashboard.listError"));
      }
    })();
    return () => {
      c = true;
    };
  }, [me, t]);

  const devPurchase = async () => {
    try {
      const r = await billingApi.placeholderPurchase();
      setAccountNotice(r.message ?? t("dashboard.devPurchaseOk"));
      await refresh();
    } catch (e) {
      setAccountNotice(e instanceof Error ? e.message : "失敗しました");
    }
  };

  const startStripeSubscription = async () => {
    setAccountNotice("");
    try {
      const { url } = await billingApi.createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setAccountNotice(e instanceof Error ? e.message : t("dashboard.checkoutFail"));
    }
  };

  const del = async (id: number) => {
    if (!confirm(t("dashboard.deleteConfirm"))) return;
    try {
      await projectApi.remove(id);
      setProjects((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : t("dashboard.deleteFail"));
    }
  };

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: shell.bgDeep,
          color: shell.textMuted,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {t("common.loading")}
      </div>
    );
  }

  if (!me) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: shell.bgDeep,
        color: shell.text,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <header
        style={{
          borderBottom: `1px solid ${shell.border}`,
          background: shell.bgChrome,
          padding:
            "max(14px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) 14px max(20px, env(safe-area-inset-left, 0px))",
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px 16px",
            justifyContent: "space-between",
          }}
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: shell.text,
            }}
          >
            <ChoreoCoreLogo height={36} title="ChoreoCore" />
          </Link>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: shell.textMuted }}>{me.user.email}</span>
            {me.user.subscription_status ? (
              <span style={{ fontSize: "11px", color: "#86efac" }}>
                {t("dashboard.subscription")}: {me.user.subscription_status}
              </span>
            ) : null}
            <button
              type="button"
              style={{ ...btnSecondary, padding: "6px 12px", fontSize: "12px" }}
              title="Stripe でサブスクリプション（要 STRIPE_PRICE_ID）"
              onClick={() => void startStripeSubscription()}
            >
              {t("dashboard.subscriptionStripe")}
            </button>
            <Link
              to="/video"
              style={{ ...btnSecondary, padding: "6px 12px", fontSize: "12px", textDecoration: "none" }}
            >
              {t("dashboard.videoModule")}
            </Link>
            {import.meta.env.DEV && (
              <button type="button" style={{ ...btnSecondary, padding: "6px 12px", fontSize: "12px" }} onClick={() => void devPurchase()}>
                {t("dashboard.devLifetime")}
              </button>
            )}
            <button type="button" style={{ ...btnSecondary, padding: "6px 12px", fontSize: "12px" }} onClick={logout}>
              {t("dashboard.logout")}
            </button>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding:
            "28px max(20px, env(safe-area-inset-right, 0px)) 48px max(20px, env(safe-area-inset-left, 0px))",
        }}
      >
        {isDemoSessionToken() ? (
          <div
            style={{
              ...panelCard,
              padding: "12px 14px",
              marginBottom: 20,
              border: "1px solid rgba(234, 179, 8, 0.45)",
              background: "rgba(234, 179, 8, 0.08)",
              color: "#fef3c7",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {t("dashboard.demoSessionBanner")}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "16px 24px",
            marginBottom: "28px",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 240px" }}>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.03em" }}>
              {t("dashboard.libraryHeading")}
            </h1>
            <p style={{ margin: "10px 0 0", fontSize: "14px", lineHeight: 1.55, color: shell.textMuted }}>
              {t("dashboard.subtitle")}
            </p>
          </div>
          <Link
            to="/editor/new"
            style={{
              ...btnAccent,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 22px",
              fontSize: "14px",
              flexShrink: 0,
            }}
          >
            {t("dashboard.newProject")}
          </Link>
        </div>

        {accountNotice ? (
          <p style={{ fontSize: "13px", color: shell.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
            {accountNotice}
          </p>
        ) : null}

        <h2 style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.12em", color: shell.textSubtle }}>
          {t("dashboard.cloudWorks")}
        </h2>
        {error ? <p style={{ color: "#fca5a5", marginBottom: 16 }}>{error}</p> : null}

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {projects.map((p) => (
            <li key={p.id} style={{ ...panelCard, padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "stretch",
                  gap: 0,
                }}
              >
                <Link
                  to={`/editor/${p.id}`}
                  style={{
                    flex: "1 1 200px",
                    padding: "18px 20px",
                    textDecoration: "none",
                    color: shell.text,
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: 6 }}>{p.name}</div>
                  <div style={{ fontSize: "12px", color: shell.textMuted }}>
                    {t("dashboard.updatedLabel")}: {formatUpdatedAt(p.updated_at)}
                  </div>
                </Link>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 16px",
                    borderLeft: `1px solid ${shell.border}`,
                    background: "rgba(0,0,0,0.15)",
                  }}
                >
                  <Link
                    to={`/editor/${p.id}?collab=1`}
                    style={{ ...btnSecondary, fontSize: "12px", padding: "6px 12px", textDecoration: "none" }}
                    title={t("dashboard.collabHint")}
                  >
                    {t("dashboard.collab")}
                  </Link>
                  <button type="button" style={{ ...btnSecondary, fontSize: "12px", padding: "6px 12px" }} onClick={() => void del(p.id)}>
                    {t("dashboard.delete")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {projects.length === 0 && !error ? (
          <div style={{ ...panelCard, padding: "36px 24px", textAlign: "center", marginTop: 8 }}>
            <p style={{ margin: 0, fontSize: "14px", color: shell.textMuted, lineHeight: 1.6 }}>{t("dashboard.emptyProjects")}</p>
            <Link
              to="/editor/new"
              style={{
                ...btnAccent,
                marginTop: 20,
                textDecoration: "none",
                display: "inline-flex",
                padding: "10px 20px",
              }}
            >
              {t("dashboard.newProject")}
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}

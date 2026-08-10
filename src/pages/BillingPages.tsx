import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { billingApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { btnSecondary } from "../components/stageButtonStyles";

const POLL_MS = 2500;
const MAX_POLLS = 24; // ~60s（PayPay 非同期確認待ち）

export function BillingSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { refresh } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState<"loading" | "pending" | "ok" | "error">(
    "loading"
  );

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const r = await billingApi.verifyCheckoutSession(sessionId);
        if (cancelled) return;
        if (r.ok) {
          await refresh();
          setStatus("ok");
          return;
        }
        if (r.pending) {
          setStatus("pending");
          polls += 1;
          if (polls >= MAX_POLLS) {
            setStatus("error");
            return;
          }
          timer = setTimeout(run, POLL_MS);
          return;
        }
        setStatus("error");
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus("error");
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, refresh]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        padding: 24,
        maxWidth: "560px",
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {(status === "loading" || status === "pending") && (
        <>
          <h1 style={{ fontSize: "20px" }}>
            {status === "pending"
              ? t("billing.success.pendingTitle")
              : t("billing.success.loadingTitle")}
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: 12 }}>
            {status === "pending"
              ? t("billing.success.pendingBody")
              : t("billing.success.loadingBody")}
          </p>
        </>
      )}
      {status === "ok" && (
        <>
          <h1 style={{ fontSize: "20px" }}>{t("billing.success.okTitle")}</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: 12 }}>
            {t("billing.success.okBody")}
          </p>
          <Link
            to="/"
            style={{
              ...btnSecondary,
              textDecoration: "none",
              display: "inline-block",
              marginTop: 16,
            }}
          >
            {t("billing.success.toLibrary")}
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <h1 style={{ fontSize: "20px" }}>{t("billing.success.errorTitle")}</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: 12 }}>
            {t("billing.success.errorBody")}
          </p>
          <Link
            to="/"
            style={{
              ...btnSecondary,
              textDecoration: "none",
              display: "inline-block",
              marginTop: 16,
            }}
          >
            {t("billing.success.toLibrary")}
          </Link>
        </>
      )}
    </div>
  );
}

export function BillingCanceledPage() {
  const { t } = useI18n();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        padding: 24,
        maxWidth: "560px",
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "20px" }}>{t("billing.canceled.title")}</h1>
      <Link
        to="/"
        style={{
          ...btnSecondary,
          textDecoration: "none",
          display: "inline-block",
          marginTop: 16,
        }}
      >
        {t("billing.success.toLibrary")}
      </Link>
    </div>
  );
}

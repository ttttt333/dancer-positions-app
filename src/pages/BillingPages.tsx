import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { billingApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { btnSecondary } from "../components/stageButtonStyles";

export function BillingSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { refresh } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }
    billingApi
      .verifyCheckoutSession(sessionId)
      .then(async (r) => {
        if (r.ok) {
          await refresh();
          setStatus("ok");
        } else {
          setStatus("error");
        }
      })
      .catch((e) => {
        console.error(e);
        setStatus("error");
      });
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
      {status === "loading" && (
        <>
          <h1 style={{ fontSize: "20px" }}>{t("billing.success.loadingTitle")}</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: 12 }}>
            {t("billing.success.loadingBody")}
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

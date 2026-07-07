import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { billingApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { btnSecondary } from "../components/stageButtonStyles";

export function BillingSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { refresh } = useAuth();
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
          <h1 style={{ fontSize: "20px" }}>確認中...</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: 12 }}>
            お支払いを確認しています。しばらくお待ちください。
          </p>
        </>
      )}
      {status === "ok" && (
        <>
          <h1 style={{ fontSize: "20px" }}>🎉 Proプランへようこそ！</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: 12 }}>
            お支払いが確認されました。作品を無制限に作成できます。
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
            作品一覧へ
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <h1 style={{ fontSize: "20px" }}>確認に失敗しました</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: 12 }}>
            お支払いは完了している可能性があります。数分後に再度ログインして確認してください。問題が続く場合はサポートまでご連絡ください。
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
            作品一覧へ
          </Link>
        </>
      )}
    </div>
  );
}

export function BillingCanceledPage() {
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
      <h1 style={{ fontSize: "20px" }}>チェックアウトをキャンセルしました</h1>
      <Link
        to="/"
        style={{
          ...btnSecondary,
          textDecoration: "none",
          display: "inline-block",
          marginTop: 16,
        }}
      >
        作品一覧へ
      </Link>
    </div>
  );
}

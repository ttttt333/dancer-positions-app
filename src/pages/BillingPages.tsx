import { Link } from "react-router-dom";
import { btnSecondary } from "../components/StageBoard";

export function BillingSuccessPage() {
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
      <h1 style={{ fontSize: "20px" }}>お支払いありがとうございます</h1>
      <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: 12 }}>
        Stripe の Webhook でアカウントにサブスクリプションが反映されます（数秒〜数分かかる場合があります）。
      </p>
      <Link to="/" style={{ ...btnSecondary, textDecoration: "none", display: "inline-block", marginTop: 16 }}>
        作品一覧へ
      </Link>
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
      <Link to="/" style={{ ...btnSecondary, textDecoration: "none", display: "inline-block", marginTop: 16 }}>
        作品一覧へ
      </Link>
    </div>
  );
}

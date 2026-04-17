import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export function ApproveMembershipPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [msg, setMsg] = useState("処理中…");
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setOk(false);
      setMsg("トークンがありません。");
      return;
    }
    let c = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/public/membership-approve?token=${encodeURIComponent(token)}`
        );
        const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
        if (c) return;
        if (res.ok && data.ok) {
          setOk(true);
          setMsg(data.message ?? "承認が完了しました。");
        } else {
          setOk(false);
          setMsg(data.error ?? "承認に失敗しました。");
        }
      } catch {
        if (!c) {
          setOk(false);
          setMsg("通信エラーが発生しました。");
        }
      }
    })();
    return () => {
      c = true;
    };
  }, [token]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
        padding: "32px",
        maxWidth: "520px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: "20px", marginBottom: "16px" }}>協会参加の承認</h1>
      <p style={{ color: ok === true ? "#86efac" : ok === false ? "#f87171" : "#94a3b8" }}>
        {msg}
      </p>
      <p style={{ fontSize: "13px", color: "#64748b", marginTop: "24px" }}>
        このページはメール内のリンクから開いてください。トークンは短期間で失効します。
      </p>
      <Link to="/" style={{ color: "#93c5fd", display: "inline-block", marginTop: "24px" }}>
        作品一覧へ
      </Link>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { billingApi, orgApi, projectApi } from "../api/client";
import { btnPrimary, btnSecondary } from "../components/StageBoard";

export function DashboardPage() {
  const { ready, me, logout, refresh } = useAuth();
  const [projects, setProjects] = useState<
    { id: number; name: string; updated_at: string }[]
  >([]);
  const [orgs, setOrgs] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [devApprovalUrl, setDevApprovalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!me) {
      setProjects([]);
      setOrgs([]);
      return;
    }
    let c = false;
    (async () => {
      try {
        const [list, olist] = await Promise.all([
          projectApi.list(),
          orgApi.list(),
        ]);
        if (!c) {
          setProjects(list);
          setOrgs(olist);
        }
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : "一覧取得失敗");
      }
    })();
    return () => {
      c = true;
    };
  }, [me]);

  const requestJoin = async (oid: number) => {
    setJoinMsg("");
    setDevApprovalUrl(null);
    try {
      const res = await orgApi.requestMembership(oid);
      setJoinMsg("申請を送信しました。管理者の承認をお待ちください。");
      if (import.meta.env.DEV && res.devApprovalUrl) {
        setDevApprovalUrl(res.devApprovalUrl);
      }
      await refresh();
    } catch (e) {
      setJoinMsg(e instanceof Error ? e.message : "申請に失敗しました");
    }
  };

  const devPurchase = async () => {
    try {
      const r = await billingApi.placeholderPurchase();
      setJoinMsg(r.message ?? "買い切りフラグを有効にしました（開発）");
      setDevApprovalUrl(null);
      await refresh();
    } catch (e) {
      setJoinMsg(e instanceof Error ? e.message : "失敗しました");
    }
  };

  const startStripeSubscription = async () => {
    setJoinMsg("");
    try {
      const { url } = await billingApi.createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setJoinMsg(e instanceof Error ? e.message : "Checkout を開始できませんでした");
    }
  };

  const del = async (id: number) => {
    if (!confirm("この作品を削除しますか？")) return;
    try {
      await projectApi.remove(id);
      setProjects((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除失敗");
    }
  };

  const topBar = (
    <div
      style={{
        width: "100%",
        padding: "12px 16px",
        borderBottom: "1px solid #1e293b",
        background: "#020617",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <Link
          to="/"
          style={{
            color: "#94a3b8",
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          ← 作品一覧
        </Link>
      </div>
    </div>
  );

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#94a3b8" }}>
        {topBar}
        <div style={{ padding: 24, maxWidth: "900px", margin: "0 auto" }}>読み込み中…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {topBar}
      <div
        style={{
          padding: "24px",
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "22px", flex: "1 1 auto" }}>
          ChoreoGrid
        </h1>
        {me ? (
          <>
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>{me.user.email}</span>
            {me.user.subscription_status ? (
              <span style={{ fontSize: "12px", color: "#86efac" }}>
                サブスク: {me.user.subscription_status}
              </span>
            ) : null}
            <button
              type="button"
              style={btnSecondary}
              title="Stripe でサブスクリプション（要 STRIPE_PRICE_ID）"
              onClick={() => void startStripeSubscription()}
            >
              サブスク登録（Stripe）
            </button>
            {me.adminOrganizations.length > 0 && (
              <Link to="/admin/membership" style={{ ...btnSecondary, textDecoration: "none" }}>
                協会・承認
              </Link>
            )}
            <Link to="/video" style={{ ...btnSecondary, textDecoration: "none" }}>
              動画モジュール
            </Link>
            {import.meta.env.DEV && (
              <button type="button" style={btnSecondary} onClick={() => void devPurchase()}>
                Dev: 買い切りフラグ
              </button>
            )}
            <button type="button" style={btnSecondary} onClick={logout}>
              ログアウト
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ ...btnSecondary, textDecoration: "none" }}>
              ログイン
            </Link>
            <Link to="/register" style={{ ...btnPrimary, textDecoration: "none" }}>
              新規登録
            </Link>
          </>
        )}
      </header>

      <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "20px" }}>
        デスクトップの広い画面での利用を想定しています。新規作品はブラウザのみでも編集できます。ログイン後はサーバに保存できます。
      </p>

      <div style={{ marginBottom: "20px" }}>
        <Link to="/editor/new" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
          新規作品を開く
        </Link>
      </div>

      {me && orgs.length > 0 && (
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "16px", color: "#94a3b8", marginBottom: "8px" }}>
            協会への参加
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
            所属:{" "}
            {me.memberOrganizations.length
              ? me.memberOrganizations.map((o) => o.name).join(", ")
              : "なし（未承認または未申請）"}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                style={btnSecondary}
                onClick={() => void requestJoin(o.id)}
              >
                「{o.name}」に参加申請
              </button>
            ))}
          </div>
          {joinMsg && (
            <p style={{ fontSize: "13px", color: "#86efac", marginTop: "8px" }}>{joinMsg}</p>
          )}
          {devApprovalUrl && (
            <p
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                marginTop: "8px",
                wordBreak: "break-all",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              開発用承認 URL: {devApprovalUrl}
            </p>
          )}
        </section>
      )}

      {me && (
        <>
          <h2 style={{ fontSize: "16px", color: "#94a3b8", marginBottom: "12px" }}>
            クラウドの作品
          </h2>
          {error && <p style={{ color: "#f87171" }}>{error}</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {projects.map((p) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                  <Link
                    to={`/editor/${p.id}`}
                    style={{ color: "#93c5fd", textDecoration: "none" }}
                  >
                    {p.name}
                  </Link>
                  <Link
                    to={`/editor/${p.id}?collab=1`}
                    style={{ fontSize: "11px", color: "#64748b", textDecoration: "none" }}
                    title="Yjs で共同編集（ログイン必須）"
                  >
                    共同編集
                  </Link>
                </div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{p.updated_at}</span>
                <button type="button" style={btnSecondary} onClick={() => void del(p.id)}>
                  削除
                </button>
              </li>
            ))}
          </ul>
          {projects.length === 0 && !error && (
            <p style={{ color: "#64748b", fontSize: "14px" }}>まだありません</p>
          )}
        </>
      )}
      </div>
    </div>
  );
}

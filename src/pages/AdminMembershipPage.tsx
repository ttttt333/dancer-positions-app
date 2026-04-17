import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { orgApi } from "../api/client";
import { btnSecondary } from "../components/StageBoard";

export function AdminMembershipPage() {
  const { me, refresh } = useAuth();
  const [orgId, setOrgId] = useState<number | null>(null);
  const [pending, setPending] = useState<
    { id: number; user_id: number; created_at: string; email: string }[]
  >([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (me?.adminOrganizations.length && orgId == null) {
      setOrgId(me.adminOrganizations[0].id);
    }
  }, [me, orgId]);

  const load = async () => {
    if (orgId == null) return;
    try {
      const rows = await orgApi.pendingRequests(orgId);
      setPending(rows);
      setMsg("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "取得失敗");
    }
  };

  useEffect(() => {
    void load();
  }, [orgId]);

  const approve = async (id: number) => {
    try {
      await orgApi.approve(id);
      await load();
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "失敗");
    }
  };

  const reject = async (id: number) => {
    try {
      await orgApi.reject(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "失敗");
    }
  };

  if (!me?.adminOrganizations.length) {
    return (
      <div style={{ padding: 24, color: "#f87171", background: "#0f172a", minHeight: "100vh" }}>
        管理者権限がありません。 <Link to="/">戻る</Link>
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
        padding: 24,
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      <Link to="/" style={{ color: "#94a3b8" }}>
        ← 戻る
      </Link>
      <h1 style={{ marginTop: 16 }}>協会への参加申請</h1>
      <p style={{ color: "#94a3b8", fontSize: "14px" }}>
        申請が入るとサーバログに管理者メールが出ます（本番ではメール送信を接続）。ここから承認／却下できます。
      </p>
      <label style={{ display: "block", margin: "16px 0", fontSize: "13px" }}>
        協会
        <select
          value={orgId ?? ""}
          onChange={(e) => setOrgId(Number(e.target.value))}
          style={{
            display: "block",
            marginTop: 8,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#020617",
            color: "#fff",
            width: "100%",
          }}
        >
          {me.adminOrganizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {msg && <p style={{ color: "#f87171" }}>{msg}</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {pending.map((r) => (
          <li
            key={r.id}
            style={{
              padding: "12px 0",
              borderBottom: "1px solid #334155",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>{r.email}</span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>{r.created_at}</span>
            <button type="button" style={btnSecondary} onClick={() => void approve(r.id)}>
              承認
            </button>
            <button
              type="button"
              style={{ ...btnSecondary, color: "#f87171" }}
              onClick={() => void reject(r.id)}
            >
              却下
            </button>
          </li>
        ))}
      </ul>
      {pending.length === 0 && <p style={{ color: "#64748b" }}>保留中の申請はありません</p>}
    </div>
  );
}

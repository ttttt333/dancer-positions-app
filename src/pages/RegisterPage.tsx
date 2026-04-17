import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { btnPrimary } from "../components/StageBoard";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { token } = await authApi.register(email, password);
      localStorage.setItem("auth_token", token);
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 16,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: "360px",
          background: "#020617",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid #334155",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: "20px" }}>新規登録</h1>
        <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
          最初に登録したユーザーは「サンプル協会」の管理者になります。
        </p>
        <label style={{ display: "block", marginBottom: "12px", fontSize: "13px" }}>
          メール
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: "4px",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#fff",
            }}
          />
        </label>
        <label style={{ display: "block", marginBottom: "16px", fontSize: "13px" }}>
          パスワード（6文字以上）
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: "4px",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#fff",
            }}
          />
        </label>
        {error && (
          <p style={{ color: "#f87171", fontSize: "13px", margin: "0 0 12px" }}>{error}</p>
        )}
        <button type="submit" style={{ ...btnPrimary, width: "100%" }}>
          登録
        </button>
        <p style={{ marginTop: "16px", fontSize: "13px" }}>
          <Link to="/login" style={{ color: "#93c5fd" }}>
            ログインへ
          </Link>
        </p>
      </form>
    </div>
  );
}

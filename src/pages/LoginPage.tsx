import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi, setToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { btnAccent, inputField } from "../components/stageButtonStyles";
import { shell } from "../theme/choreoShell";

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "14px",
  fontSize: "12px",
  fontWeight: 600,
  color: shell.textMuted,
  letterSpacing: "0.04em",
};

const inputStyle: CSSProperties = {
  ...inputField,
  display: "block",
  width: "100%",
  marginTop: "6px",
  padding: "12px 14px",
  boxSizing: "border-box",
};

export function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { me, ready, setAuth, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && me) navigate("/", { replace: true });
  }, [ready, me, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { token } = await authApi.login(email, password);
      setToken(token);
      try {
        const m = await authApi.me();
        setAuth(token, m);
        navigate("/", { replace: true });
      } catch {
        logout();
        setError(t("auth.postLoginMeFailed"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    }
  };

  return (
    <AuthScreenLayout title={t("auth.loginTitle")} subtitle={t("auth.loginTagline")}>
      <form onSubmit={submit}>
        <label style={labelStyle}>
          {t("auth.email")}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          {t("auth.password")}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        {error ? (
          <p style={{ color: "#fca5a5", fontSize: "13px", margin: "0 0 14px", lineHeight: 1.45 }}>
            {error}
          </p>
        ) : null}
        <button type="submit" style={{ ...btnAccent, width: "100%", padding: "12px 18px" }}>
          {t("auth.submitLogin")}
        </button>
        <p
          style={{
            marginTop: "22px",
            fontSize: "13px",
            textAlign: "center",
            color: shell.textMuted,
            lineHeight: 1.6,
          }}
        >
          <Link to="/register" style={{ color: shell.text, fontWeight: 600, textDecoration: "none" }}>
            {t("auth.registerLink")}
          </Link>
          <br />
          <span style={{ fontSize: "12px", color: shell.textSubtle }}>{t("auth.loginFooterHint")}</span>
        </p>
      </form>
    </AuthScreenLayout>
  );
}

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi, setToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { btnAccent, btnSecondary, inputField } from "../components/stageButtonStyles";
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

export function RegisterPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { me, ready, setAuth, logout, skipLoginForNow } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && me) navigate("/", { replace: true });
  }, [ready, me, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { token } = await authApi.register(email, password);
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
    <AuthScreenLayout title={t("auth.registerTitle")} subtitle={t("auth.registerBlurb")}>
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
          {t("auth.passwordMin")}
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
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
          {t("auth.registerSubmit")}
        </button>
        <button
          type="button"
          style={{
            ...btnSecondary,
            width: "100%",
            marginTop: 12,
            padding: "10px 16px",
            fontSize: "13px",
          }}
          onClick={() => {
            skipLoginForNow();
            navigate("/", { replace: true });
          }}
        >
          {t("auth.skipLoginButton")}
        </button>
        <p
          style={{
            marginTop: 10,
            fontSize: "11px",
            lineHeight: 1.45,
            color: shell.textSubtle,
            textAlign: "center",
          }}
        >
          {t("auth.skipLoginNote")}
        </p>
        <p style={{ marginTop: "22px", fontSize: "13px", textAlign: "center" }}>
          <Link to="/login" style={{ color: shell.textMuted, fontWeight: 500, textDecoration: "none" }}>
            {t("auth.loginInsteadLink")}
          </Link>
        </p>
      </form>
    </AuthScreenLayout>
  );
}

import type { CSSProperties } from "react";
import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi, setToken, CLOUD_AUTH_CONFIG_MISSING_MESSAGE, isProdBuildMissingCloudAuth } from "../api/client";
import { getSupabase, isSupabaseBackend } from "../lib/supabaseClient";
import { useAuth, mapApiMeToContextMe } from "../context/AuthContext";
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
  const { me, ready, setAuth, logout, skipLoginForNow, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && me) navigate("/", { replace: true });
  }, [ready, me, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isProdBuildMissingCloudAuth()) {
      setError(CLOUD_AUTH_CONFIG_MISSING_MESSAGE);
      return;
    }
    try {
      if (isSupabaseBackend()) {
        const { data, error } = await getSupabase().auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          setError(error.message);
          return;
        }
        if (data.session) {
          await refresh();
          navigate("/", { replace: true });
        } else {
          setError("確認用メールを送りました。メール内のリンクを開き、その後「ログイン」からサインインしてください。");
        }
        return;
      }
      const { token } = await authApi.register(email, password);
      setToken(token);
      try {
        const m = await authApi.me();
        setAuth(token, mapApiMeToContextMe(m));
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
      <Fragment>
      {isProdBuildMissingCloudAuth() ? (
        <p
          style={{
            color: "#fbbf24",
            fontSize: "13px",
            lineHeight: 1.55,
            margin: "0 0 16px",
            padding: "12px 14px",
            background: "rgba(120, 80, 0, 0.2)",
            border: "1px solid rgba(251, 191, 36, 0.45)",
            borderRadius: 8,
          }}
        >
          {CLOUD_AUTH_CONFIG_MISSING_MESSAGE}
        </p>
      ) : null}
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
      <Link
        to="/library"
        style={{
          ...btnAccent,
          width: "100%",
          marginTop: 20,
          padding: "12px 18px",
          fontSize: "14px",
          fontWeight: 700,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        {t("auth.toLibrary")}
      </Link>
      </Fragment>
    </AuthScreenLayout>
  );
}

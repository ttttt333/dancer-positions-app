import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import {
  clearAuthCallbackParams,
  parseAuthCallbackError,
  sendPhoneOtp,
  signInWithSocialProvider,
  SOCIAL_AUTH_PROVIDERS,
  type SocialAuthProvider,
  verifyPhoneOtp,
} from "../../lib/supabaseAuth";
import { btnAccent, btnSecondary, inputField } from "../stageButtonStyles";
import { shell } from "../../theme/choreoShell";

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

const socialBtnStyle: CSSProperties = {
  ...btnSecondary,
  width: "100%",
  padding: "11px 14px",
  fontSize: "13px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

type Props = {
  onError: (message: string) => void;
};

export function AuthAlternativeMethods({ onError }: Props) {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [socialLoading, setSocialLoading] = useState<SocialAuthProvider | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // OAuth 失敗時の URL エラーはマウント時に一度だけ表示（onError を deps に入れると再レンダーループの原因になる）
  useEffect(() => {
    const callbackError = parseAuthCallbackError();
    if (callbackError) {
      onErrorRef.current(callbackError);
      clearAuthCallbackParams();
    }
  }, []);

  const handleSocial = async (provider: SocialAuthProvider) => {
    onError("");
    setSocialLoading(provider);
    try {
      await signInWithSocialProvider(provider);
    } catch (err) {
      setSocialLoading(null);
      onError(err instanceof Error ? err.message : t("auth.socialLoginFailed"));
    }
  };

  const handleSendOtp = async () => {
    onError("");
    if (!phone.trim()) {
      onError(t("auth.phoneRequired"));
      return;
    }
    setPhoneLoading(true);
    try {
      await sendPhoneOtp(phone);
      setOtpSent(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : t("auth.phoneOtpSendFailed"));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    onError("");
    if (!otp.trim()) {
      onError(t("auth.otpRequired"));
      return;
    }
    setPhoneLoading(true);
    try {
      await verifyPhoneOtp(phone, otp);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      onError(err instanceof Error ? err.message : t("auth.phoneOtpVerifyFailed"));
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: "12px",
          fontWeight: 600,
          color: shell.textMuted,
          letterSpacing: "0.04em",
        }}
      >
        {t("auth.quickSignInHeading")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SOCIAL_AUTH_PROVIDERS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            disabled={socialLoading !== null || phoneLoading}
            style={{
              ...socialBtnStyle,
              opacity: socialLoading && socialLoading !== id ? 0.55 : 1,
            }}
            onClick={() => handleSocial(id)}
          >
            {socialLoading === id ? t("auth.redirecting") : t(labelKey)}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "12px",
            fontWeight: 600,
            color: shell.textMuted,
            letterSpacing: "0.04em",
          }}
        >
          {t("auth.phoneHeading")}
        </p>
        <label style={labelStyle}>
          {t("auth.phoneLabel")}
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder={t("auth.phonePlaceholder")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
            disabled={phoneLoading}
          />
        </label>
        {otpSent ? (
          <label style={labelStyle}>
            {t("auth.otpLabel")}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("auth.otpPlaceholder")}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={inputStyle}
              disabled={phoneLoading}
            />
          </label>
        ) : null}
        <button
          type="button"
          disabled={phoneLoading || socialLoading !== null}
          style={{ ...btnAccent, width: "100%", padding: "11px 18px", marginTop: 4 }}
          onClick={otpSent ? handleVerifyOtp : handleSendOtp}
        >
          {phoneLoading
            ? t("auth.phoneWorking")
            : otpSent
              ? t("auth.verifyOtp")
              : t("auth.sendOtp")}
        </button>
        {otpSent ? (
          <button
            type="button"
            disabled={phoneLoading}
            style={{
              ...btnSecondary,
              width: "100%",
              marginTop: 8,
              padding: "8px 14px",
              fontSize: "12px",
            }}
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              onError("");
            }}
          >
            {t("auth.changePhone")}
          </button>
        ) : null}
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "11px",
            lineHeight: 1.45,
            color: shell.textSubtle,
          }}
        >
          {t("auth.phoneHint")}
        </p>
      </div>
    </div>
  );
}

export function AuthMethodDivider() {
  const { t } = useI18n();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "0 0 20px",
      }}
      aria-hidden
    >
      <div style={{ flex: 1, height: 1, background: shell.borderStrong }} />
      <span style={{ fontSize: "11px", color: shell.textSubtle, letterSpacing: "0.06em" }}>
        {t("auth.orEmailDivider")}
      </span>
      <div style={{ flex: 1, height: 1, background: shell.borderStrong }} />
    </div>
  );
}

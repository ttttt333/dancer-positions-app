import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import {
  clearAuthCallbackParams,
  parseAuthCallbackError,
  signInWithGoogle,
} from "../../lib/supabaseAuth";
import { useI18n } from "../../i18n/I18nContext";
import { btnSecondary } from "../stageButtonStyles";
import { shell } from "../../theme/choreoShell";

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const callbackError = parseAuthCallbackError();
    if (callbackError) {
      onErrorRef.current(callbackError);
      clearAuthCallbackParams();
    }
  }, []);

  const handleGoogle = async () => {
    onError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setGoogleLoading(false);
      onError(err instanceof Error ? err.message : t("auth.socialLoginFailed"));
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
      <button
        type="button"
        disabled={googleLoading}
        style={socialBtnStyle}
        onClick={handleGoogle}
      >
        {googleLoading ? t("auth.redirecting") : t("auth.continueGoogle")}
      </button>
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

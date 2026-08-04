import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PortableBackupSection } from "../../components/dashboard/PortableBackupSection";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { shell } from "../../theme/choreoShell";
import {
  displayNameFromEmail,
  homeDivider,
  homeIconBtn,
  homeMenuRow,
  initialsFromEmail,
} from "./homeChrome";

type Props = {
  email: string;
  isPro: boolean;
  appVersion: string;
  notice: string;
  labels: {
    title: string;
    back: string;
    manageSub: string;
    changeName: string;
    changeEmail: string;
    darkMode: string;
    manageStorage: string;
    sendData: string;
    logout: string;
    deleteAccount: string;
    version: string;
    proBadge: string;
    freeBadge: string;
    faq: string;
    help: string;
    renamePrompt: string;
    deleteConfirm: string;
  };
  onBack: () => void;
  onManageSubscription: () => void;
  onOpenStorage: () => void;
  onLogout: () => void;
  storageOpen: boolean;
};

function displayNameStorageKey(email: string): string {
  return `choreocore.displayName:${email.trim().toLowerCase()}`;
}

function SettingsRow({
  icon,
  label,
  onClick,
  danger,
  trailing,
  href,
  to,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: ReactNode;
  href?: string;
  to?: string;
}) {
  const content = (
    <>
      <span aria-hidden style={{ width: 22, textAlign: "center", opacity: 0.95 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {trailing}
    </>
  );
  const style = {
    ...homeMenuRow,
    color: danger ? "#f87171" : shell.text,
    textDecoration: "none" as const,
  };
  if (href) {
    return (
      <a href={href} style={style} onClick={onClick}>
        {content}
      </a>
    );
  }
  if (to) {
    return (
      <Link to={to} style={style} onClick={onClick}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      style={style}
      onClick={onClick}
      disabled={!onClick && !trailing}
    >
      {content}
    </button>
  );
}

function BackChevron() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M15 5L8 12l7 7"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * ライブラリのメニュー＝設定を1画面にまとめたビュー。
 */
export function HomeSettingsView({
  email,
  isPro,
  appVersion,
  notice,
  labels,
  onBack,
  onManageSubscription,
  onOpenStorage,
  onLogout,
  storageOpen,
}: Props) {
  const fallbackName = displayNameFromEmail(email);
  const [displayName, setDisplayName] = useState(fallbackName);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(displayNameStorageKey(email));
      setDisplayName(saved?.trim() || fallbackName);
    } catch {
      setDisplayName(fallbackName);
    }
  }, [email, fallbackName]);

  const initials = initialsFromEmail(email);

  const onChangeName = () => {
    const next = window.prompt(labels.renamePrompt, displayName);
    if (next == null) return;
    const name = next.trim();
    if (!name) return;
    try {
      localStorage.setItem(displayNameStorageKey(email), name);
    } catch {
      /* ignore */
    }
    setDisplayName(name);
  };

  const onChangeEmail = () => {
    window.location.href = `mailto:interush.info@gmail.com?subject=${encodeURIComponent(
      "ChoreoCore email change"
    )}&body=${encodeURIComponent(
      `Current email: ${email}\nRequested new email:\n`
    )}`;
  };

  const onDeleteAccount = () => {
    if (!window.confirm(labels.deleteConfirm)) return;
    window.location.href = `mailto:interush.info@gmail.com?subject=${encodeURIComponent(
      "ChoreoCore account deletion"
    )}&body=${encodeURIComponent(`Please delete my account.\nEmail: ${email}\n`)}`;
  };

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        background: shell.bgDeep,
      }}
    >
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "52px 1fr 52px",
          alignItems: "center",
          padding: "max(10px, env(safe-area-inset-top, 0px)) 8px 10px",
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
        }}
      >
        <button
          type="button"
          aria-label={labels.back}
          style={{ ...homeIconBtn, width: 52, height: 52 }}
          onClick={onBack}
        >
          <BackChevron />
        </button>
        <h1
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          {labels.title}
        </h1>
        <span />
      </header>

      <div
        style={{
          padding: "20px 18px 12px",
          display: "flex",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "linear-gradient(145deg, #8a7020, #d4af37)",
            color: "#1a1408",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{displayName}</div>
          <div
            style={{
              fontSize: 13,
              color: shell.textMuted,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {email}
          </div>
          <div
            style={{
              marginTop: 6,
              display: "inline-block",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "2px 8px",
              borderRadius: 4,
              background: isPro
                ? "rgba(255,255,255,0.12)"
                : "rgba(255,255,255,0.06)",
              color: shell.textMuted,
            }}
          >
            {isPro ? labels.proBadge : labels.freeBadge}
          </div>
        </div>
      </div>

      <div style={homeDivider} />

      <SettingsRow
        icon="★"
        label={labels.manageSub}
        onClick={onManageSubscription}
      />
      <SettingsRow
        icon="👤"
        label={labels.changeName}
        onClick={onChangeName}
      />
      <SettingsRow
        icon="✉"
        label={labels.changeEmail}
        onClick={onChangeEmail}
      />
      <SettingsRow
        icon="☀"
        label={labels.darkMode}
        trailing={
          <span
            aria-hidden
            style={{
              width: 46,
              height: 28,
              borderRadius: 999,
              background: "#2563eb",
              position: "relative",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                right: 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#fff",
              }}
            />
          </span>
        }
      />
      <SettingsRow
        icon="⬇"
        label={labels.manageStorage}
        onClick={onOpenStorage}
      />

      <div style={homeDivider} />

      <SettingsRow icon="?" label={labels.faq} to="/update-log" />
      <SettingsRow
        icon="✉"
        label={labels.help}
        href="mailto:interush.info@gmail.com?subject=ChoreoCore%20help"
      />
      <SettingsRow
        icon="↗"
        label={labels.sendData}
        onClick={() => {
          window.location.href = `mailto:interush.info@gmail.com?subject=${encodeURIComponent(
            "ChoreoCore app data"
          )}&body=${encodeURIComponent(`Account: ${email}\nVersion: ${appVersion}`)}`;
        }}
      />

      <div style={homeDivider} />

      <SettingsRow icon="⎋" label={labels.logout} onClick={onLogout} />

      <div style={homeDivider} />

      <SettingsRow
        icon="⊖"
        label={labels.deleteAccount}
        danger
        onClick={onDeleteAccount}
      />

      {notice ? (
        <p style={{ padding: "12px 18px", color: shell.textMuted, fontSize: 13 }}>
          {notice}
        </p>
      ) : null}

      {storageOpen ? (
        <div style={{ padding: "8px 12px 24px" }}>
          <PortableBackupSection loggedIn />
        </div>
      ) : null}

      <div style={{ padding: "16px 18px 8px" }}>
        <LanguageSwitcher variant="inline" />
      </div>

      <p
        style={{
          marginTop: "auto",
          padding: "16px 18px max(24px, env(safe-area-inset-bottom, 0px))",
          fontSize: 12,
          color: shell.textSubtle,
        }}
      >
        {labels.version} {appVersion}
      </p>
    </div>
  );
}

import type { ReactNode } from "react";
import { PortableBackupSection } from "../../components/dashboard/PortableBackupSection";
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
  hasStripeCustomer: boolean;
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
    comingSoon: string;
    proBadge: string;
    freeBadge: string;
  };
  onBack: () => void;
  onManageSubscription: () => void;
  onOpenStorage: () => void;
  onLogout: () => void;
  storageOpen: boolean;
};

function SettingsRow({
  icon,
  label,
  onClick,
  danger,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      style={{
        ...homeMenuRow,
        color: danger ? "#f87171" : shell.text,
      }}
      onClick={onClick}
      disabled={!onClick && !trailing}
    >
      <span aria-hidden style={{ width: 22, textAlign: "center", opacity: 0.95 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {trailing}
    </button>
  );
}

/** 設定画面（添付メニュー構成） */
export function HomeSettingsView({
  email,
  isPro,
  hasStripeCustomer,
  appVersion,
  notice,
  labels,
  onBack,
  onManageSubscription,
  onOpenStorage,
  onLogout,
  storageOpen,
}: Props) {
  const name = displayNameFromEmail(email);
  const initials = initialsFromEmail(email);

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
          gridTemplateColumns: "44px 1fr 44px",
          alignItems: "center",
          padding:
            "max(10px, env(safe-area-inset-top, 0px)) 8px 10px",
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
        }}
      >
        <button
          type="button"
          aria-label={labels.back}
          style={homeIconBtn}
          onClick={onBack}
        >
          ‹
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

      <div style={{ padding: "20px 18px 12px", display: "flex", gap: 14, alignItems: "center" }}>
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
          <div style={{ fontWeight: 700, fontSize: 17 }}>{name}</div>
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
          <div style={{ marginTop: 6, fontSize: 11, color: shell.textSubtle }}>
            {isPro ? labels.proBadge : labels.freeBadge}
          </div>
        </div>
      </div>

      <div style={homeDivider} />

      <SettingsRow
        icon="★"
        label={labels.manageSub}
        onClick={
          hasStripeCustomer || !isPro
            ? onManageSubscription
            : () => window.alert(labels.comingSoon)
        }
      />
      <SettingsRow
        icon="👤"
        label={labels.changeName}
        onClick={() => window.alert(labels.comingSoon)}
      />
      <SettingsRow
        icon="✉"
        label={labels.changeEmail}
        onClick={() => window.alert(labels.comingSoon)}
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
        onClick={() => window.alert(labels.comingSoon)}
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

      <p
        style={{
          marginTop: "auto",
          padding: "24px 18px max(24px, env(safe-area-inset-bottom, 0px))",
          fontSize: 12,
          color: shell.textSubtle,
        }}
      >
        {labels.version} {appVersion}
      </p>
    </div>
  );
}

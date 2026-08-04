import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { shell } from "../../theme/choreoShell";
import {
  displayNameFromEmail,
  homeDivider,
  homeMenuRow,
  initialsFromEmail,
} from "./homeChrome";

type Props = {
  open: boolean;
  email: string;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenStorage: () => void;
  labels: {
    settings: string;
    offline: string;
    faq: string;
    help: string;
    recentlyDeleted: string;
    close: string;
    comingSoon: string;
  };
};

function DrawerItem({
  icon,
  label,
  onClick,
  to,
  href,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  to?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        style={{
          width: 22,
          display: "inline-flex",
          justifyContent: "center",
          opacity: 0.9,
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} onClick={onClick} style={{ ...homeMenuRow, textDecoration: "none" }}>
        {inner}
      </a>
    );
  }
  if (to) {
    return (
      <Link
        to={to}
        onClick={onClick}
        style={{ ...homeMenuRow, textDecoration: "none" }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" style={homeMenuRow} onClick={onClick}>
      {inner}
    </button>
  );
}

/** ログイン後サイドドロワー（設定・ヘルプ導線） */
export function HomeSideDrawer({
  open,
  email,
  onClose,
  onOpenSettings,
  onOpenStorage,
  labels,
}: Props) {
  if (!open) return null;
  const name = displayNameFromEmail(email);
  const initials = initialsFromEmail(email);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.settings}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
      }}
    >
      <aside
        style={{
          width: "min(82vw, 320px)",
          maxWidth: "100%",
          height: "100%",
          background: "#0b0b0b",
          borderRight: `1px solid ${shell.border}`,
          boxShadow: "12px 0 40px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "18px 18px 14px",
          }}
        >
          <ChoreoCoreLogo height={28} title="ChoreoCore" />
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>
            ChoreoCore
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 18px 16px",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "linear-gradient(145deg, #8a7020, #d4af37)",
              color: "#1a1408",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: shell.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {email}
            </div>
          </div>
        </div>

        <div style={homeDivider} />

        <nav style={{ display: "flex", flexDirection: "column", padding: "6px 0" }}>
          <DrawerItem
            icon="⚙"
            label={labels.settings}
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
          />
          <DrawerItem
            icon="☁"
            label={labels.offline}
            onClick={() => {
              onOpenStorage();
              onClose();
            }}
          />
          <DrawerItem
            icon="?"
            label={labels.faq}
            to="/update-log"
            onClick={onClose}
          />
          <DrawerItem
            icon="✉"
            label={labels.help}
            href="mailto:interush.info@gmail.com?subject=ChoreoCore%20help"
            onClick={onClose}
          />
        </nav>

        <div style={homeDivider} />

        <DrawerItem
          icon="🗑"
          label={labels.recentlyDeleted}
          onClick={() => {
            window.alert(labels.comingSoon);
          }}
        />

        <div style={{ marginTop: "auto", padding: "16px 18px" }}>
          <LanguageSwitcher variant="inline" />
        </div>
      </aside>
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        style={{
          flex: 1,
          border: "none",
          background: "rgba(0,0,0,0.55)",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

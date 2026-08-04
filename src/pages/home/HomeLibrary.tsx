import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  billingApi,
  isDemoSessionToken,
  projectApi,
  type ProjectListItem,
} from "../../api/client";
import { ProjectFormationThumb } from "../../components/dashboard/ProjectFormationThumb";
import { PortableBackupSection } from "../../components/dashboard/PortableBackupSection";
import { btnAccent } from "../../components/stageButtonStyles";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import { isCollabFeatureAvailable } from "../../lib/collabAvailability";
import {
  copyTextToClipboard,
  projectShareLinks,
} from "../../lib/shareProjectLinks";
import { hasStripeCustomerId, isProMe } from "../../lib/supabaseBilling";
import { tryMigrateFromLocalStorage } from "../../lib/projectDefaults";
import { shell } from "../../theme/choreoShell";
import { HOME_DISPLAY, homeIconBtn, homeRootStyle } from "./homeChrome";
import { HomeSettingsView } from "./HomeSettingsView";
import { HomeSideDrawer } from "./HomeSideDrawer";
import {
  ProjectActionSheet,
  type ProjectSheetAction,
} from "./ProjectActionSheet";

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type Panel = "library" | "settings" | "storage";

const APP_VERSION = "β";

/** ログイン後ホーム: ライブラリ + サイドメニュー + 設定 + 作品メニュー */
export function HomeLibrary() {
  const { t } = useI18n();
  const { me, logout } = useAuth();
  const email = me?.user.email ?? "";
  const isPro = isProMe(me);
  const hasStripeCustomer = hasStripeCustomerId(me);

  const [panel, setPanel] = useState<Panel>("library");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionProject, setActionProject] = useState<ProjectListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsStorageOpen, setSettingsStorageOpen] = useState(false);

  const legacyProject = useMemo(() => tryMigrateFromLocalStorage(), []);
  const projectLimit = isPro ? Infinity : 3;
  const atProjectLimit = !isPro && projects.length >= projectLimit;

  const reload = useCallback(async () => {
    try {
      const list = await projectApi.list();
      setProjects(list);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard.listError"));
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startStripeSubscription = async () => {
    setNotice("");
    try {
      const { url } = await billingApi.createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("dashboard.checkoutFail"));
    }
  };

  const openCustomerPortal = async () => {
    setNotice("");
    try {
      const { url } = await billingApi.openCustomerPortal();
      window.location.href = url;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("dashboard.portalFail"));
    }
  };

  const onManageSubscription = () => {
    if (hasStripeCustomer) void openCustomerPortal();
    else void startStripeSubscription();
  };

  const handleSheetAction = async (action: ProjectSheetAction) => {
    if (action === "close") {
      setActionProject(null);
      return;
    }
    const p = actionProject;
    if (!p) return;

    if (action === "rename") {
      const next = window.prompt(t("home.sheet.renamePrompt"), p.name);
      if (next == null) return;
      const name = next.trim();
      if (!name || name === p.name) {
        setActionProject(null);
        return;
      }
      setBusy(true);
      try {
        const row = await projectApi.get(p.id);
        await projectApi.update(p.id, name, row.json);
        await reload();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : t("home.sheet.renameFail"));
      } finally {
        setBusy(false);
        setActionProject(null);
      }
      return;
    }

    if (action === "duplicate") {
      if (atProjectLimit) {
        window.alert(t("home.sheet.limitReached"));
        setActionProject(null);
        return;
      }
      setBusy(true);
      try {
        const row = await projectApi.get(p.id);
        const copyName = `${p.name} ${t("home.sheet.copySuffix")}`;
        await projectApi.create(copyName, row.json);
        await reload();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : t("home.sheet.duplicateFail"));
      } finally {
        setBusy(false);
        setActionProject(null);
      }
      return;
    }

    if (action === "copyLink" || action === "share") {
      const links = projectShareLinks(p.id, p.share_token);
      const ok = await copyTextToClipboard(links.view);
      window.alert(ok ? t("home.sheet.linkCopied") : links.view);
      setActionProject(null);
      return;
    }

    if (action === "collab") {
      const links = projectShareLinks(p.id, p.share_token);
      const ok = await copyTextToClipboard(links.collab);
      window.alert(ok ? t("home.sheet.collabCopied") : links.collab);
      setActionProject(null);
      return;
    }

    if (action === "delete") {
      if (!window.confirm(t("dashboard.deleteConfirm"))) return;
      setBusy(true);
      try {
        await projectApi.remove(p.id);
        setProjects((prev) => prev.filter((x) => x.id !== p.id));
      } catch (e) {
        window.alert(e instanceof Error ? e.message : t("dashboard.deleteFail"));
      } finally {
        setBusy(false);
        setActionProject(null);
      }
    }
  };

  if (panel === "settings") {
    return (
      <div style={homeRootStyle}>
        <HomeSettingsView
          email={email}
          isPro={isPro}
          hasStripeCustomer={hasStripeCustomer}
          appVersion={APP_VERSION}
          notice={notice}
          storageOpen={settingsStorageOpen}
          labels={{
            title: t("home.settings.title"),
            back: t("home.settings.back"),
            manageSub: t("home.settings.manageSub"),
            changeName: t("home.settings.changeName"),
            changeEmail: t("home.settings.changeEmail"),
            darkMode: t("home.settings.darkMode"),
            manageStorage: t("home.settings.manageStorage"),
            sendData: t("home.settings.sendData"),
            logout: t("dashboard.logout"),
            deleteAccount: t("home.settings.deleteAccount"),
            version: t("home.settings.version"),
            comingSoon: t("home.comingSoon"),
            proBadge: "PRO",
            freeBadge: `FREE ${projects.length}/3`,
          }}
          onBack={() => {
            setSettingsStorageOpen(false);
            setPanel("library");
          }}
          onManageSubscription={onManageSubscription}
          onOpenStorage={() => setSettingsStorageOpen((v) => !v)}
          onLogout={() => logout()}
        />
      </div>
    );
  }

  if (panel === "storage") {
    return (
      <div style={homeRootStyle}>
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 44px",
            alignItems: "center",
            padding: "max(10px, env(safe-area-inset-top, 0px)) 8px 10px",
            borderBottom: `1px solid rgba(255,255,255,0.08)`,
          }}
        >
          <button
            type="button"
            aria-label={t("home.settings.back")}
            style={homeIconBtn}
            onClick={() => setPanel("library")}
          >
            ‹
          </button>
          <h1 style={{ margin: 0, textAlign: "center", fontSize: 17, fontWeight: 700 }}>
            {t("home.settings.manageStorage")}
          </h1>
          <span />
        </header>
        <div style={{ padding: 16 }}>
          <PortableBackupSection loggedIn />
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...homeRootStyle, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding:
            "max(10px, env(safe-area-inset-top, 0px)) 10px 8px max(6px, env(safe-area-inset-left, 0px))",
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
        }}
      >
        <button
          type="button"
          aria-label={t("home.menu.open")}
          style={homeIconBtn}
          onClick={() => setDrawerOpen(true)}
        >
          <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
            ☰
          </span>
        </button>
        <h1
          style={{
            margin: 0,
            flex: 1,
            fontFamily: HOME_DISPLAY,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {t("home.libraryTitle")}
        </h1>
        {!isPro ? (
          <button
            type="button"
            onClick={() => void startStripeSubscription()}
            style={{
              border: "none",
              background: shell.accentSoft,
              color: shell.accent,
              fontWeight: 700,
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 999,
              cursor: "pointer",
              marginRight: 8,
            }}
          >
            Pro
          </button>
        ) : null}
      </header>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding:
            "16px max(16px, env(safe-area-inset-right, 0px)) 100px max(16px, env(safe-area-inset-left, 0px))",
        }}
      >
        {isDemoSessionToken() ? (
          <p
            style={{
              margin: "0 0 16px",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(234, 179, 8, 0.45)",
              background: "rgba(234, 179, 8, 0.08)",
              color: "#fef3c7",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {t("dashboard.demoSessionBanner")}
          </p>
        ) : null}

        {legacyProject ? (
          <section
            style={{
              marginBottom: 18,
              padding: "14px 16px",
              borderRadius: 14,
              border: `1px solid ${shell.border}`,
              background: shell.surface,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {t("library.browserDataTitle")}
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: shell.textMuted }}>
              {t("library.browserDataDesc")}
            </p>
            <Link to="/editor/new" style={{ color: shell.accent, fontSize: 13 }}>
              {t("library.openBrowserData")}
            </Link>
          </section>
        ) : null}

        {notice ? (
          <p style={{ color: shell.textMuted, fontSize: 13, marginBottom: 12 }}>{notice}</p>
        ) : null}
        {error ? (
          <p style={{ color: "#fca5a5", marginBottom: 12 }}>{error}</p>
        ) : null}

        <h2
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: shell.textSubtle,
          }}
        >
          {t("home.myLibrary")}
        </h2>

        {projects.length === 0 && !error ? (
          <div
            style={{
              padding: "36px 20px",
              textAlign: "center",
              borderRadius: 16,
              border: `1px solid ${shell.border}`,
              background: shell.surface,
            }}
          >
            <p style={{ margin: 0, color: shell.textMuted, lineHeight: 1.6 }}>
              {t("dashboard.emptyProjects")}
            </p>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            {projects.map((p) => (
              <li
                key={p.id}
                style={{
                  borderRadius: 14,
                  border: `1px solid ${shell.border}`,
                  background: shell.surface,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Link
                  to={`/editor/${p.id}`}
                  style={{
                    textDecoration: "none",
                    color: shell.text,
                    padding: 10,
                    display: "block",
                  }}
                >
                  <ProjectFormationThumb
                    dancers={p.previewDancers}
                    size={140}
                    style={{ width: "100%", height: "auto", borderRadius: 10 }}
                  />
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: shell.textMuted }}>
                    {t("editor.headcount")}: {p.dancerCount} · {t("dashboard.cueCount")}:{" "}
                    {p.cueCount}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 10, color: shell.textSubtle }}>
                    {formatUpdatedAt(p.updated_at)}
                  </div>
                </Link>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    padding: "0 4px 6px",
                  }}
                >
                  <button
                    type="button"
                    aria-label={t("home.sheet.open")}
                    style={{ ...homeIconBtn, width: 36, height: 36 }}
                    onClick={() => setActionProject(p)}
                  >
                    ···
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <nav
        aria-label={t("home.bottomNav")}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0,
          padding: "8px 12px max(10px, env(safe-area-inset-bottom, 0px))",
          background: "rgba(8,8,8,0.94)",
          borderTop: `1px solid rgba(255,255,255,0.08)`,
          backdropFilter: "blur(10px)",
        }}
      >
        <span
          style={{
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: shell.accent,
            padding: "6px 0",
          }}
        >
          ▦ {t("home.tabLibrary")}
        </span>
        <Link
          to="/update-log"
          style={{
            textAlign: "center",
            fontSize: 11,
            fontWeight: 600,
            color: shell.textMuted,
            textDecoration: "none",
            padding: "6px 0",
          }}
        >
          ✦ {t("home.tabExplore")}
        </Link>
      </nav>

      {atProjectLimit ? (
        <button
          type="button"
          aria-label={t("home.fabPro")}
          onClick={() => void startStripeSubscription()}
          style={{
            position: "fixed",
            right: "max(18px, env(safe-area-inset-right))",
            bottom: "max(72px, calc(env(safe-area-inset-bottom, 0px) + 64px))",
            zIndex: 45,
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "none",
            background: shell.accent,
            color: "#1a1408",
            fontSize: 28,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
          }}
        >
          +
        </button>
      ) : (
        <Link
          to="/editor/new"
          aria-label={t("dashboard.newProject")}
          style={{
            position: "fixed",
            right: "max(18px, env(safe-area-inset-right))",
            bottom: "max(72px, calc(env(safe-area-inset-bottom, 0px) + 64px))",
            zIndex: 45,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#f5f5f4",
            color: "#111",
            fontSize: 32,
            fontWeight: 600,
            textDecoration: "none",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
            lineHeight: 1,
          }}
        >
          +
        </Link>
      )}

      {atProjectLimit ? (
        <div
          style={{
            position: "fixed",
            left: 16,
            right: 80,
            bottom: "max(72px, calc(env(safe-area-inset-bottom, 0px) + 64px))",
            zIndex: 44,
          }}
        >
          <button
            type="button"
            style={{
              ...btnAccent,
              width: "100%",
              padding: "12px 14px",
              fontSize: 13,
              background: shell.accent,
              color: "#1a1408",
              border: "none",
            }}
            onClick={() => void startStripeSubscription()}
          >
            {t("home.limitCta")}
          </button>
        </div>
      ) : null}

      <HomeSideDrawer
        open={drawerOpen}
        email={email}
        onClose={() => setDrawerOpen(false)}
        onOpenSettings={() => {
          setSettingsStorageOpen(false);
          setPanel("settings");
        }}
        onOpenStorage={() => setPanel("storage")}
        labels={{
          settings: t("home.settings.title"),
          offline: t("home.drawer.offline"),
          faq: t("home.drawer.faq"),
          help: t("home.drawer.help"),
          recentlyDeleted: t("home.drawer.recentlyDeleted"),
          close: t("home.menu.close"),
          comingSoon: t("home.comingSoon"),
        }}
      />

      <ProjectActionSheet
        open={Boolean(actionProject)}
        projectName={actionProject?.name ?? ""}
        showCollab={isCollabFeatureAvailable()}
        busy={busy}
        labels={{
          rename: t("home.sheet.rename"),
          duplicate: t("home.sheet.duplicate"),
          share: t("home.sheet.share"),
          manageAccess: t("home.sheet.manageAccess"),
          copyLink: t("home.sheet.copyLink"),
          delete: t("dashboard.delete"),
          close: t("home.menu.close"),
        }}
        onAction={(a) => void handleSheetAction(a)}
      />
    </div>
  );
}

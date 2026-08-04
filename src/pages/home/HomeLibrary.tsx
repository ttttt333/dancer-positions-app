import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  billingApi,
  isDemoSessionToken,
  projectApi,
  type ProjectListItem,
} from "../../api/client";
import { AppLegalFooter } from "../../components/AppLegalFooter";
import { ProjectFormationThumb } from "../../components/dashboard/ProjectFormationThumb";
import { btnAccent } from "../../components/stageButtonStyles";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import { isCollabFeatureAvailable } from "../../lib/collabAvailability";
import { PLAN_CONFIRM_PATH } from "../../lib/commercialDisclosure";
import {
  copyTextToClipboard,
  projectShareLinks,
} from "../../lib/shareProjectLinks";
import { exportChoreographyPdf } from "../../lib/exportChoreographyPdf";
import { normalizeProject } from "../../lib/normalizeProject";
import { hasStripeCustomerId, isProMe } from "../../lib/supabaseBilling";
import { tryMigrateFromLocalStorage } from "../../lib/projectDefaults";
import { shell } from "../../theme/choreoShell";
import { homeIconBtn } from "./homeChrome";
import { HomeSettingsView } from "./HomeSettingsView";
import {
  ProjectActionSheet,
  type ProjectSheetAction,
} from "./ProjectActionSheet";
import "./home.css";

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type Panel = "library" | "settings";

const APP_VERSION = "β";

/** ログイン後ホーム: ライブラリ + 設定（メニューは設定に1画面で統合） */
export function HomeLibrary() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { me, logout } = useAuth();
  const email = me?.user.email ?? "";
  const isPro = isProMe(me);
  const hasStripeCustomer = hasStripeCustomerId(me);

  const [panel, setPanel] = useState<Panel>("library");
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

  const startStripeSubscription = () => {
    setNotice("");
    navigate(PLAN_CONFIRM_PATH);
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
    else startStripeSubscription();
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

    if (action === "exportPdf") {
      setBusy(true);
      try {
        const row = await projectApi.get(p.id);
        const project = normalizeProject(row.json);
        await exportChoreographyPdf({
          project,
          projectName: row.name || p.name,
        });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : t("home.sheet.exportPdfFail"));
      } finally {
        setBusy(false);
        setActionProject(null);
      }
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
      <div className="home-page">
        <HomeSettingsView
          email={email}
          isPro={isPro}
          appVersion={APP_VERSION}
          notice={notice}
          storageOpen={settingsStorageOpen}
          labels={{
            title: t("home.settings.title"),
            back: t("home.settings.back"),
            manageSub: t("home.settings.manageSub"),
            legalTokushoho: t("home.settings.legalTokushoho"),
            changeName: t("home.settings.changeName"),
            changeEmail: t("home.settings.changeEmail"),
            darkMode: t("home.settings.darkMode"),
            manageStorage: t("home.settings.manageStorage"),
            sendData: t("home.settings.sendData"),
            logout: t("dashboard.logout"),
            deleteAccount: t("home.settings.deleteAccount"),
            version: t("home.settings.version"),
            proBadge: "PRO",
            freeBadge: `FREE ${projects.length}/3`,
            faq: t("home.drawer.faq"),
            help: t("home.drawer.help"),
            renamePrompt: t("home.settings.renamePrompt"),
            deleteConfirm: t("home.settings.deleteConfirm"),
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

  return (
    <div className="home-page home-library">
      <header className="home-library-header">
        <button
          type="button"
          aria-label={t("home.settings.title")}
          style={homeIconBtn}
          onClick={() => {
            setSettingsStorageOpen(false);
            setPanel("settings");
          }}
        >
          <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
            ☰
          </span>
        </button>
        <h1 className="home-display home-library-title">{t("home.libraryTitle")}</h1>
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
            }}
          >
            Pro
          </button>
        ) : null}
        {atProjectLimit ? (
          <button
            type="button"
            className="home-desktop-new"
            onClick={() => void startStripeSubscription()}
          >
            {t("home.limitCta")}
          </button>
        ) : (
          <Link to="/editor/new" className="home-desktop-new">
            {t("dashboard.newProject")}
          </Link>
        )}
      </header>

      <main className="home-library-main">
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

        <h2 className="home-library-section-label">{t("home.myLibrary")}</h2>

        {projects.length === 0 && !error ? (
          <div className="home-empty">
            <p style={{ margin: 0 }}>{t("dashboard.emptyProjects")}</p>
            {!atProjectLimit ? (
              <Link
                to="/editor/new"
                style={{
                  ...btnAccent,
                  marginTop: 20,
                  textDecoration: "none",
                  display: "inline-flex",
                  padding: "10px 20px",
                }}
              >
                {t("dashboard.newProject")}
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="home-project-grid">
            {projects.map((p) => (
              <li key={p.id} className="home-project-card">
                <Link to={`/editor/${p.id}`} className="home-project-link">
                  <ProjectFormationThumb dancers={p.previewDancers} size={200} fluid />
                  <div className="home-project-name">{p.name}</div>
                  <div className="home-project-meta">
                    <div className="home-project-meta-line">
                      {t("editor.headcount")}: {p.dancerCount}
                    </div>
                    <div className="home-project-meta-line">
                      {t("dashboard.cueCount")}: {p.cueCount}
                    </div>
                  </div>
                  <div className="home-project-updated">{formatUpdatedAt(p.updated_at)}</div>
                </Link>
                <div className="home-project-actions">
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

      <nav className="home-bottom-nav" aria-label={t("home.bottomNav")}>
        <span className="home-bottom-nav-item is-active">{t("home.tabLibrary")}</span>
        <Link to="/update-log" className="home-bottom-nav-item">
          {t("home.tabExplore")}
        </Link>
      </nav>

      {atProjectLimit ? (
        <button
          type="button"
          className="home-fab is-pro"
          aria-label={t("home.fabPro")}
          onClick={() => void startStripeSubscription()}
        >
          +
        </button>
      ) : (
        <Link to="/editor/new" className="home-fab" aria-label={t("dashboard.newProject")}>
          +
        </Link>
      )}

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
          exportPdf: t("home.sheet.exportPdf"),
          delete: t("dashboard.delete"),
          close: t("home.menu.close"),
        }}
        onAction={(a) => void handleSheetAction(a)}
      />
    </div>
  );
}

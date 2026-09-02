import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  billingApi,
  isDemoSessionToken,
  projectApi,
  type ProjectListItem,
} from "../../api/client";
import { FreePlanComplianceModal } from "../../components/FreePlanComplianceModal";
import { ProjectFormationThumb } from "../../components/dashboard/ProjectFormationThumb";
import { btnAccent } from "../../components/stageButtonStyles";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import { isCollabFeatureAvailable } from "../../lib/collabAvailability";
import { PLAN_CONFIRM_PATH } from "../../lib/commercialDisclosure";
import {
  analyzeFreePlanExcessFromList,
  trimProjectToFreeLimits,
  type FreePlanExcessReport,
} from "../../lib/freePlanCompliance";
import {
  copyTextToClipboard,
  projectShareLinks,
} from "../../lib/shareProjectLinks";
import { exportChoreographyPdf } from "../../lib/exportChoreographyPdf";
import { normalizeProject } from "../../lib/normalizeProject";
import { FREE_CLOUD_PROJECT_LIMIT, hasStripeCustomerId, isProMe } from "../../lib/supabaseBilling";
import { getEntitlements } from "../../lib/entitlements";
import { tryMigrateFromLocalStorage } from "../../lib/projectDefaults";
import {
  FLOW_LIBRARY_CHANGE_EVENT,
  getFlowLibraryFirstFormation,
  listFlowLibraryItems,
  resolveFlowLibraryDancerCount,
  resolveFlowLibraryDurationSec,
  type FlowLibraryItem,
} from "../../lib/flowLibrary";
import { formatMmSsFloor } from "../../lib/timeFormat";
import type { ProjectThumbDancer } from "../../lib/projectListSummary";
import { shell } from "../../theme/choreoShell";
import { homeIconBtn } from "./homeChrome";
import { HomeSettingsView } from "./HomeSettingsView";
import {
  ProjectActionSheet,
  type ProjectSheetAction,
} from "./ProjectActionSheet";
import { NewProjectNameDialog } from "../../components/NewProjectNameDialog";
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

function formatFlowUpdatedAt(ms: number): string {
  try {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

function flowPreviewDancers(item: FlowLibraryItem): ProjectThumbDancer[] {
  const formation = getFlowLibraryFirstFormation(item);
  return (formation?.dancers ?? []).map((d, i) => ({
    xPct: d.xPct,
    yPct: d.yPct,
    colorIndex:
      typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
        ? d.colorIndex
        : i,
  }));
}

function flowDurationLabel(item: FlowLibraryItem): string {
  const sec = resolveFlowLibraryDurationSec(item);
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  return formatMmSsFloor(sec);
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
  const [renameProject, setRenameProject] = useState<ProjectListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [complianceBusy, setComplianceBusy] = useState(false);
  const [complianceReport, setComplianceReport] =
    useState<FreePlanExcessReport | null>(null);
  const [flowItems, setFlowItems] = useState<FlowLibraryItem[]>(() =>
    typeof window === "undefined" ? [] : listFlowLibraryItems()
  );

  useEffect(() => {
    const refresh = () => setFlowItems(listFlowLibraryItems());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.includes("flow_library")) refresh();
    };
    window.addEventListener(FLOW_LIBRARY_CHANGE_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(FLOW_LIBRARY_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const legacyProject = useMemo(() => tryMigrateFromLocalStorage(), []);
  const projectLimit = isPro ? Infinity : FREE_CLOUD_PROJECT_LIMIT;
  const atProjectLimit = !isPro && projects.length >= projectLimit;

  const reload = useCallback(async () => {
    try {
      const list = await projectApi.list();
      setProjects(list);
      setError("");
      if (!isProMe(me) && !isDemoSessionToken()) {
        // 一覧要約に加え、残す候補作品は本文を読んで人数超過を正確に判定する
        const sorted = [...list].sort((a, b) => {
          const ta = Date.parse(a.updated_at) || 0;
          const tb = Date.parse(b.updated_at) || 0;
          return tb - ta;
        });
        const keep = sorted.slice(0, FREE_CLOUD_PROJECT_LIMIT);
        const refs = await Promise.all(
          list.map(async (p) => {
            const base = {
              id: p.id,
              name: p.name,
              updated_at: p.updated_at,
              cueCount: p.cueCount,
              dancerCount: p.dancerCount,
            };
            if (!keep.some((k) => k.id === p.id)) return base;
            try {
              const row = await projectApi.get(p.id);
              const project = normalizeProject(row.json);
              const maxDancers = project.formations.reduce(
                (m, f) => Math.max(m, f.dancers?.length ?? 0),
                0
              );
              return {
                ...base,
                cueCount: project.cues.length,
                dancerCount: maxDancers,
              };
            } catch {
              return base;
            }
          })
        );
        const report = analyzeFreePlanExcessFromList(refs);
        setComplianceReport(report.hasExcess ? report : null);
      } else {
        setComplianceReport(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard.listError"));
    }
  }, [t, me]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const applyFreePlanCompliance = async () => {
    if (!complianceReport) return;
    setComplianceBusy(true);
    setNotice("");
    try {
      for (const p of complianceReport.projectsToDelete) {
        await projectApi.remove(p.id);
      }
      const keepIds = new Set(complianceReport.projectsToKeep.map((p) => p.id));
      const trimTargets = [
        ...complianceReport.projectsNeedingContentTrim.map((p) => p.id),
        ...complianceReport.projectsToKeep.map((p) => p.id),
      ].filter((id, i, arr) => keepIds.has(id) && arr.indexOf(id) === i);

      for (const id of trimTargets) {
        const row = await projectApi.get(id);
        const project = normalizeProject(row.json);
        const trimmed = trimProjectToFreeLimits(project);
        if (trimmed.changed) {
          await projectApi.update(id, row.name, trimmed.project);
        }
      }
      setComplianceReport(null);
      setNotice(t("free.compliance.done"));
      await reload();
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : t("free.compliance.fail")
      );
    } finally {
      setComplianceBusy(false);
    }
  };
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
      setRenameProject(p);
      setActionProject(null);
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
          labels: {
            playbackTime: t("pdf.playbackTime"),
            untitled: t("pdf.untitled"),
            cueN: (n) => t("pdf.cueN", { n }),
            formationN: (n) => t("pdf.formationN", { n }),
            formationFallback: t("pdf.formation"),
            backstage: t("pdf.backstage"),
            side: t("pdf.side"),
            audience: t("pdf.audience"),
            emptyError: t("pdf.emptyError"),
          },
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

  const applyRename = async (nextName: string) => {
    const p = renameProject;
    if (!p) return;
    const name = nextName.trim();
    if (!name || name === p.name) {
      setRenameProject(null);
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
      setRenameProject(null);
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
          labels={{
            title: t("home.settings.title"),
            back: t("home.settings.back"),
            manageSub: t("home.settings.manageSub"),
            legalTokushoho: t("home.settings.legalTokushoho"),
            changeName: t("home.settings.changeName"),
            changeEmail: t("home.settings.changeEmail"),
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
          onBack={() => setPanel("library")}
          onManageSubscription={onManageSubscription}
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
          onClick={() => setPanel("settings")}
        >
          <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
            ☰
          </span>
        </button>
        <h1 className="home-display home-library-title">{t("home.libraryTitle")}</h1>
        {getEntitlements(me).releaseCampaign ? (
          <span
            style={{
              border: "1px solid rgba(212,175,55,0.45)",
              background: "rgba(212,175,55,0.12)",
              color: "#e8c547",
              fontWeight: 700,
              fontSize: 11,
              padding: "6px 10px",
              borderRadius: 999,
              letterSpacing: "0.04em",
            }}
          >
            {t("landing.campaign.eyebrow")}
          </span>
        ) : !isPro ? (
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

        {flowItems.length > 0 ? (
          <>
            <h2 className="home-library-section-label">{t("home.myLibrary")}</h2>
            <p className="home-library-section-hint">{t("home.flowLibraryHint")}</p>
            <ul className="home-project-grid">
              {flowItems.map((it) => {
                const href = `/editor/new?flow=${encodeURIComponent(it.id)}`;
                const dancerCount = resolveFlowLibraryDancerCount(it);
                return (
                  <li key={it.id} className="home-project-card">
                    <Link to={href} className="home-project-link">
                      <ProjectFormationThumb
                        dancers={flowPreviewDancers(it)}
                        size={200}
                        fluid
                      />
                    </Link>
                    <div className="home-project-body">
                      <Link to={href} className="home-project-title-row">
                        <span className="home-project-name">{it.name}</span>
                        <span className="home-project-headcount">
                          {t("editor.headcount")} {dancerCount}
                        </span>
                      </Link>
                      <div className="home-project-meta">
                        <span>
                          {t("home.flowLibraryMeta", {
                            cues: it.cueCount,
                            dancers: dancerCount,
                            dur: flowDurationLabel(it),
                          })}
                        </span>
                      </div>
                      <div className="home-project-meta">
                        <span className="home-project-updated">
                          {t("home.flowLibraryUpdated", {
                            date: formatFlowUpdatedAt(it.updatedAt),
                          })}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {projects.length > 0 ? (
              <h2 className="home-library-section-label home-library-section-label--next">
                {t("home.cloudLibrary")}
              </h2>
            ) : null}
          </>
        ) : (
          <h2 className="home-library-section-label">{t("home.myLibrary")}</h2>
        )}

        {projects.length === 0 && !error ? (
          flowItems.length > 0 ? null : (
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
          )
        ) : (
          <ul className="home-project-grid">
            {projects.map((p) => (
              <li key={p.id} className="home-project-card">
                <Link to={`/editor/${p.id}`} className="home-project-link">
                  <ProjectFormationThumb dancers={p.previewDancers} size={200} fluid />
                </Link>
                <div className="home-project-body">
                  <Link to={`/editor/${p.id}`} className="home-project-title-row">
                    <span className="home-project-name">{p.name}</span>
                    <span className="home-project-headcount">
                      {t("editor.headcount")} {p.dancerCount}
                    </span>
                  </Link>
                  <div className="home-project-meta">
                    <span>
                      {t("dashboard.cueCount")} {p.cueCount}
                    </span>
                    <span className="home-project-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span className="home-project-updated">
                      {formatUpdatedAt(p.updated_at)}
                    </span>
                  </div>
                  <div className="home-project-actions">
                    <button
                      type="button"
                      className="home-project-text-btn"
                      disabled={busy}
                      onClick={() => setRenameProject(p)}
                    >
                      {t("home.card.rename")}
                    </button>
                    <button
                      type="button"
                      className="home-project-text-btn is-menu"
                      disabled={busy}
                      aria-label={t("home.sheet.open")}
                      onClick={() => setActionProject(p)}
                    >
                      {t("home.card.menu")}
                    </button>
                  </div>
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

      {renameProject ? (
        <NewProjectNameDialog
          title={t("home.sheet.rename")}
          label={t("home.sheet.renamePrompt")}
          placeholder={t("home.sheet.renamePrompt")}
          confirmLabel={t("home.card.renameSave")}
          cancelLabel={t("home.menu.close")}
          initialValue={renameProject.name}
          onCancel={() => setRenameProject(null)}
          onConfirm={(name) => void applyRename(name)}
        />
      ) : null}

      <FreePlanComplianceModal
        open={Boolean(complianceReport?.hasExcess)}
        report={complianceReport}
        busy={complianceBusy}
        onConfirmTrim={() => void applyFreePlanCompliance()}
        onGoPro={() => {
          navigate(PLAN_CONFIRM_PATH);
        }}
      />
    </div>
  );
}

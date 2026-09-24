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
  ensureFlowLibraryReady,
  getFlowLibraryFirstFormation,
  getFlowLibraryItemAsync,
  listFlowLibraryItems,
  materializeFlowLibraryItemAsProject,
  renameFlowItem,
  deleteFlowItem,
  resolveFlowLibraryDancerCount,
  resolveFlowLibraryDurationSec,
  saveFlowFromProjectAsync,
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

/** ホームライブラリの統合カード（クラウド / 端末） */
type LibraryEntry =
  | {
      key: string;
      kind: "cloud";
      name: string;
      updatedAtMs: number;
      href: string;
      cueCount: number;
      dancerCount: number;
      metaLine: string;
      previewDancers: ProjectThumbDancer[];
      project: ProjectListItem;
    }
  | {
      key: string;
      kind: "local";
      name: string;
      updatedAtMs: number;
      href: string;
      cueCount: number;
      dancerCount: number;
      metaLine: string;
      previewDancers: ProjectThumbDancer[];
      flowItem: FlowLibraryItem;
      linkedCloudId: number | null;
    };

type Panel = "library" | "settings";

const APP_VERSION = `β · ${import.meta.env.VITE_APP_BUILD || "dev"}`;

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
  const [actionEntry, setActionEntry] = useState<LibraryEntry | null>(null);
  const [renameEntry, setRenameEntry] = useState<LibraryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [complianceBusy, setComplianceBusy] = useState(false);
  const [complianceReport, setComplianceReport] =
    useState<FreePlanExcessReport | null>(null);
  const [flowItems, setFlowItems] = useState<FlowLibraryItem[]>(() =>
    typeof window === "undefined" ? [] : listFlowLibraryItems()
  );

  useEffect(() => {
    const refresh = () => setFlowItems(listFlowLibraryItems());
    void ensureFlowLibraryReady().then(refresh);
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

  const libraryEntries = useMemo((): LibraryEntry[] => {
    const cloudIds = new Set(projects.map((p) => p.id));
    const cloud: LibraryEntry[] = projects.map((p) => ({
      key: `cloud-${p.id}`,
      kind: "cloud" as const,
      name: p.name,
      updatedAtMs: Date.parse(p.updated_at) || 0,
      href: `/editor/${p.id}`,
      cueCount: p.cueCount,
      dancerCount: p.dancerCount,
      metaLine: `${t("dashboard.cueCount")} ${p.cueCount}`,
      previewDancers: p.previewDancers,
      project: p,
    }));

    const local: LibraryEntry[] = [];
    for (const it of flowItems) {
      const linkId =
        typeof it.linkedServerProjectId === "number" &&
        Number.isFinite(it.linkedServerProjectId) &&
        it.linkedServerProjectId > 0
          ? Math.floor(it.linkedServerProjectId)
          : null;
      // クラウドに同じ作品がある端末コピーは重複表示しない
      if (linkId != null && cloudIds.has(linkId)) continue;
      const dancerCount = resolveFlowLibraryDancerCount(it);
      local.push({
        key: `local-${it.id}`,
        kind: "local",
        name: it.name,
        updatedAtMs: it.updatedAt || 0,
        href: `/editor/new?flow=${encodeURIComponent(it.id)}`,
        cueCount: it.cueCount,
        dancerCount,
        metaLine: t("home.flowLibraryMeta", {
          cues: it.cueCount,
          dancers: dancerCount,
          dur: flowDurationLabel(it),
        }),
        previewDancers: flowPreviewDancers(it),
        flowItem: it,
        linkedCloudId: linkId,
      });
    }

    return [...cloud, ...local].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [projects, flowItems, t]);

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
      setActionEntry(null);
      return;
    }
    const entry = actionEntry;
    if (!entry) return;

    if (action === "rename") {
      setRenameEntry(entry);
      setActionEntry(null);
      return;
    }

    if (entry.kind === "cloud") {
      const p = entry.project;
      if (action === "duplicate") {
        if (atProjectLimit) {
          window.alert(t("home.sheet.limitReached"));
          setActionEntry(null);
          return;
        }
        setBusy(true);
        try {
          const row = await projectApi.get(p.id);
          const copyName = `${p.name} ${t("home.sheet.copySuffix")}`;
          await projectApi.create(copyName, row.json);
          await reload();
        } catch (e) {
          window.alert(
            e instanceof Error ? e.message : t("home.sheet.duplicateFail")
          );
        } finally {
          setBusy(false);
          setActionEntry(null);
        }
        return;
      }

      if (action === "copyLink" || action === "share") {
        const links = projectShareLinks(p.id, p.share_token);
        const ok = await copyTextToClipboard(links.view);
        window.alert(ok ? t("home.sheet.linkCopied") : links.view);
        setActionEntry(null);
        return;
      }

      if (action === "collab") {
        const links = projectShareLinks(p.id, p.share_token);
        const ok = await copyTextToClipboard(links.collab);
        window.alert(ok ? t("home.sheet.collabCopied") : links.collab);
        setActionEntry(null);
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
          window.alert(
            e instanceof Error ? e.message : t("home.sheet.exportPdfFail")
          );
        } finally {
          setBusy(false);
          setActionEntry(null);
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
          window.alert(
            e instanceof Error ? e.message : t("dashboard.deleteFail")
          );
        } finally {
          setBusy(false);
          setActionEntry(null);
        }
      }
      return;
    }

    // local
    const it = entry.flowItem;
    if (action === "duplicate") {
      setBusy(true);
      try {
        const full = (await getFlowLibraryItemAsync(it.id)) ?? it;
        const project = materializeFlowLibraryItemAsProject(full);
        const copyName = `${it.name} ${t("home.sheet.copySuffix")}`;
        const r = await saveFlowFromProjectAsync(copyName, project, {
          includeTiming: true,
        });
        if (!r.ok) {
          window.alert(r.message || t("home.sheet.duplicateFail"));
        } else {
          setFlowItems(listFlowLibraryItems());
        }
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : t("home.sheet.duplicateFail")
        );
      } finally {
        setBusy(false);
        setActionEntry(null);
      }
      return;
    }

    if (action === "copyLink" || action === "share" || action === "collab") {
      const linkId = entry.linkedCloudId;
      if (linkId == null) {
        window.alert(t("home.sheet.localNeedCloud"));
        setActionEntry(null);
        return;
      }
      const cloud = projects.find((p) => p.id === linkId);
      if (!cloud) {
        window.alert(t("home.sheet.localNeedCloud"));
        setActionEntry(null);
        return;
      }
      const links = projectShareLinks(cloud.id, cloud.share_token);
      const url = action === "collab" ? links.collab : links.view;
      const ok = await copyTextToClipboard(url);
      window.alert(
        ok
          ? action === "collab"
            ? t("home.sheet.collabCopied")
            : t("home.sheet.linkCopied")
          : url
      );
      setActionEntry(null);
      return;
    }

    if (action === "exportPdf") {
      setBusy(true);
      try {
        const full = (await getFlowLibraryItemAsync(it.id)) ?? it;
        const project = materializeFlowLibraryItemAsProject(full);
        await exportChoreographyPdf({
          project,
          projectName: it.name,
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
        window.alert(
          e instanceof Error ? e.message : t("home.sheet.exportPdfFail")
        );
      } finally {
        setBusy(false);
        setActionEntry(null);
      }
      return;
    }

    if (action === "delete") {
      if (!window.confirm(t("dashboard.deleteConfirm"))) return;
      setBusy(true);
      try {
        await deleteFlowItem(it.id);
        setFlowItems(listFlowLibraryItems());
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : t("dashboard.deleteFail")
        );
      } finally {
        setBusy(false);
        setActionEntry(null);
      }
    }
  };

  const applyRename = async (nextName: string) => {
    const entry = renameEntry;
    if (!entry) return;
    const name = nextName.trim();
    if (!name || name === entry.name) {
      setRenameEntry(null);
      return;
    }
    setBusy(true);
    try {
      if (entry.kind === "cloud") {
        const row = await projectApi.get(entry.project.id);
        await projectApi.update(entry.project.id, name, row.json);
        await reload();
      } else {
        const ok = await renameFlowItem(entry.flowItem.id, name);
        if (!ok) throw new Error(t("home.sheet.renameFail"));
        setFlowItems(listFlowLibraryItems());
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : t("home.sheet.renameFail"));
    } finally {
      setBusy(false);
      setRenameEntry(null);
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
            appeal: t("home.tabAppeal"),
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
        <Link to="/appeal" className="home-desktop-new home-desktop-appeal">
          {t("home.tabAppeal")}
        </Link>
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

        {libraryEntries.length === 0 && !error ? (
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
        ) : libraryEntries.length > 0 ? (
          <>
            <h2 className="home-library-section-label">{t("home.libraryTitle")}</h2>
            <p className="home-library-section-hint">{t("home.unifiedLibraryHint")}</p>
            <ul className="home-project-grid">
              {libraryEntries.map((entry) => (
                <li key={entry.key} className="home-project-card">
                  <Link to={entry.href} className="home-project-link">
                    <ProjectFormationThumb
                      dancers={entry.previewDancers}
                      size={200}
                      fluid
                    />
                  </Link>
                  <div className="home-project-body">
                    <Link to={entry.href} className="home-project-title-row">
                      <span className="home-project-name">{entry.name}</span>
                      <span className="home-project-headcount">
                        {t("editor.headcount")} {entry.dancerCount}
                      </span>
                    </Link>
                    <div className="home-project-meta">
                      <span
                        className={
                          entry.kind === "cloud"
                            ? "home-project-badge home-project-badge--cloud"
                            : "home-project-badge home-project-badge--local"
                        }
                      >
                        {entry.kind === "cloud"
                          ? t("home.badge.cloud")
                          : t("home.badge.local")}
                      </span>
                      <span className="home-project-meta-sep" aria-hidden>
                        ·
                      </span>
                      <span>{entry.metaLine}</span>
                    </div>
                    <div className="home-project-meta">
                      <span className="home-project-updated">
                        {entry.kind === "cloud"
                          ? formatUpdatedAt(entry.project.updated_at)
                          : t("home.flowLibraryUpdated", {
                              date: formatFlowUpdatedAt(entry.updatedAtMs),
                            })}
                      </span>
                    </div>
                    <div className="home-project-actions">
                      <button
                        type="button"
                        className="home-project-text-btn"
                        disabled={busy}
                        onClick={() => setRenameEntry(entry)}
                      >
                        {t("home.card.rename")}
                      </button>
                      <button
                        type="button"
                        className="home-project-text-btn is-menu"
                        disabled={busy}
                        aria-label={t("home.sheet.open")}
                        onClick={() => setActionEntry(entry)}
                      >
                        {t("home.card.menu")}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>

      <nav className="home-bottom-nav" aria-label={t("home.bottomNav")}>
        <span className="home-bottom-nav-item is-active">{t("home.tabLibrary")}</span>
        <Link to="/appeal" className="home-bottom-nav-item">
          {t("home.tabAppeal")}
        </Link>
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
        open={Boolean(actionEntry)}
        projectName={actionEntry?.name ?? ""}
        showCollab={isCollabFeatureAvailable()}
        showShareActions={
          actionEntry?.kind === "cloud" ||
          (actionEntry?.kind === "local" && actionEntry.linkedCloudId != null)
        }
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

      {renameEntry ? (
        <NewProjectNameDialog
          title={t("home.sheet.rename")}
          label={t("home.sheet.renamePrompt")}
          placeholder={t("home.sheet.renamePrompt")}
          confirmLabel={t("home.card.renameSave")}
          cancelLabel={t("home.menu.close")}
          initialValue={renameEntry.name}
          onCancel={() => setRenameEntry(null)}
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

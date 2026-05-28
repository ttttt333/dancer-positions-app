import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { billingApi, isDemoSessionToken, projectApi, type ProjectListItem } from "../api/client";
import { isCollabFeatureAvailable } from "../lib/collabAvailability";
import { ChoreoCoreLogo } from "../components/ChoreoCoreLogo";
import { ProjectFormationThumb } from "../components/dashboard/ProjectFormationThumb";
import { btnAccent, btnSecondary } from "../components/stageButtonStyles";
import { panelCard, shell } from "../theme/choreoShell";
import { tryMigrateFromLocalStorage } from "../lib/projectDefaults";

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const proBtnStyle = {
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 700,
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  color: "#fff",
  letterSpacing: "0.03em",
  whiteSpace: "nowrap" as const,
};

/** トップ `/` — 保存作品へすぐ飛べるホーム */
export function DashboardPage() {
  const { t } = useI18n();
  const { ready, me, logout, refresh } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [error, setError] = useState("");
  const [accountNotice, setAccountNotice] = useState("");

  const legacyProject = useMemo(() => tryMigrateFromLocalStorage(), []);

  useEffect(() => {
    if (!me) {
      setProjects([]);
      setError("");
      return;
    }
    let c = false;
    (async () => {
      try {
        const list = await projectApi.list();
        if (!c) setProjects(list);
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : t("dashboard.listError"));
      }
    })();
    return () => {
      c = true;
    };
  }, [me, t]);

  const startStripeSubscription = async () => {
    setAccountNotice("");
    try {
      const { url } = await billingApi.createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setAccountNotice(e instanceof Error ? e.message : t("dashboard.checkoutFail"));
    }
  };

  const isPro =
    me?.user?.entitlement_lifetime === 1 ||
    me?.user?.subscription_status === "active";
  const projectLimit = isPro ? Infinity : 3;
  const atProjectLimit = Boolean(me) && !isPro && projects.length >= projectLimit;

  const del = async (id: number) => {
    if (!confirm(t("dashboard.deleteConfirm"))) return;
    try {
      await projectApi.remove(id);
      setProjects((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : t("dashboard.deleteFail"));
    }
  };

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: shell.bgDeep,
          color: shell.textMuted,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {t("common.loading")}
      </div>
    );
  }

  const accountLabel = me?.user.email ?? t("dashboard.guestLabel");

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: shell.bgDeep,
        color: shell.text,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <header
        style={{
          borderBottom: `1px solid ${shell.border}`,
          background: shell.bgChrome,
          padding:
            "max(14px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) 14px max(20px, env(safe-area-inset-left, 0px))",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px 16px",
            justifyContent: "space-between",
          }}
          className="app-page-header"
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: shell.text,
            }}
          >
            <ChoreoCoreLogo height={48} title="ChoreoCore" />
          </Link>
          <div
            className="app-page-header-actions"
            style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
          >
            {me ? (
              <>
                {!isPro ? (
                  <button
                    type="button"
                    style={{ ...proBtnStyle, padding: "6px 14px", fontSize: "12px" }}
                    onClick={() => void startStripeSubscription()}
                  >
                    Pro にアップグレード
                  </button>
                ) : null}
                <button
                  type="button"
                  style={{ ...btnSecondary, padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => logout()}
                >
                  {t("dashboard.logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    ...btnSecondary,
                    padding: "6px 14px",
                    fontSize: "12px",
                    textDecoration: "none",
                  }}
                >
                  {t("dashboard.login")}
                </Link>
                <Link
                  to="/register"
                  style={{
                    ...btnAccent,
                    padding: "6px 14px",
                    fontSize: "12px",
                    textDecoration: "none",
                  }}
                >
                  {t("dashboard.register")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding:
            "24px max(20px, env(safe-area-inset-right, 0px)) 48px max(20px, env(safe-area-inset-left, 0px))",
        }}
      >
        {isDemoSessionToken() ? (
          <div
            style={{
              ...panelCard,
              padding: "12px 14px",
              marginBottom: 20,
              border: "1px solid rgba(234, 179, 8, 0.45)",
              background: "rgba(234, 179, 8, 0.08)",
              color: "#fef3c7",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {t("dashboard.demoSessionBanner")}
          </div>
        ) : null}

        {/* アカウント名 */}
        <section style={{ ...panelCard, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: shell.textSubtle, marginBottom: 6 }}>
            {t("dashboard.accountLabel")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 12px" }}>
            <span style={{ fontSize: "17px", fontWeight: 700, wordBreak: "break-all" }}>
              {accountLabel}
            </span>
            {me ? (
              isPro ? (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#fff",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    padding: "3px 9px",
                    borderRadius: 20,
                    letterSpacing: "0.05em",
                  }}
                >
                  ✦ PRO
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "11px",
                    color: shell.textMuted,
                    padding: "3px 9px",
                    border: `1px solid ${shell.border}`,
                    borderRadius: 20,
                  }}
                >
                  FREE {projects.length}/3
                </span>
              )
            ) : null}
          </div>
        </section>

        {/* 新規作成・Pro（メイン操作） */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {atProjectLimit ? (
            <button
              type="button"
              style={{
                ...btnAccent,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 22px",
                fontSize: "15px",
                width: "100%",
                boxSizing: "border-box",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => void startStripeSubscription()}
            >
              Pro で作品を追加 →
            </button>
          ) : (
            <Link
              to="/editor/new"
              style={{
                ...btnAccent,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 22px",
                fontSize: "15px",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {t("dashboard.newProject")}
            </Link>
          )}
          {me && !isPro ? (
            <button
              type="button"
              style={{ ...proBtnStyle, width: "100%", padding: "12px 18px", fontSize: "14px" }}
              onClick={() => void startStripeSubscription()}
            >
              Pro にアップグレード
            </button>
          ) : null}
          {!me ? (
            <Link
              to="/login"
              style={{
                ...btnSecondary,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 18px",
                fontSize: "14px",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {t("dashboard.login")}
            </Link>
          ) : null}
        </section>

        {accountNotice ? (
          <p style={{ fontSize: "13px", color: shell.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
            {accountNotice}
          </p>
        ) : null}

        {legacyProject ? (
          <section style={{ ...panelCard, padding: "16px 18px", marginBottom: 24 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
              {t("library.browserDataTitle")}
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: shell.textMuted, lineHeight: 1.55 }}>
              {t("library.browserDataDesc")}
            </p>
            <Link
              to="/editor/new"
              style={{
                ...btnSecondary,
                textDecoration: "none",
                display: "inline-flex",
                padding: "8px 14px",
                fontSize: "13px",
              }}
            >
              {t("library.openBrowserData")}
            </Link>
          </section>
        ) : null}

        {/* 保存した作品 */}
        <h2
          style={{
            margin: "0 0 14px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: shell.textSubtle,
          }}
        >
          {t("dashboard.cloudWorks")}
        </h2>

        {!me ? (
          <div style={{ ...panelCard, padding: "24px 20px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: shell.textMuted, lineHeight: 1.6 }}>
              {t("library.needLoginForCloud")}
            </p>
            <Link
              to="/login"
              style={{
                ...btnAccent,
                marginTop: 16,
                textDecoration: "none",
                display: "inline-flex",
                padding: "10px 18px",
                fontSize: "13px",
              }}
            >
              {t("dashboard.login")}
            </Link>
          </div>
        ) : null}

        {me && error ? (
          <p style={{ color: "#fca5a5", marginBottom: 16 }}>{error}</p>
        ) : null}

        {me ? (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {projects.map((p) => (
              <li key={p.id} style={{ ...panelCard, padding: 0, overflow: "hidden" }}>
                <div
                  className="app-dashboard-project-row"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "stretch",
                    gap: 0,
                  }}
                >
                  <Link
                    to={`/editor/${p.id}`}
                    style={{
                      flex: "1 1 200px",
                      padding: "14px 16px",
                      textDecoration: "none",
                      color: shell.text,
                      minWidth: 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <ProjectFormationThumb dancers={p.previewDancers} size={64} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: 6 }}>
                          {p.name}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: shell.textMuted,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px 14px",
                          }}
                        >
                          <span>
                            {t("editor.headcount")}: {p.dancerCount}
                          </span>
                          <span>
                            {t("dashboard.cueCount")}: {p.cueCount}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: shell.textMuted, marginTop: 4 }}>
                          {t("dashboard.updatedLabel")}: {formatUpdatedAt(p.updated_at)}
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div
                    className="app-dashboard-project-actions"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 16px",
                      borderLeft: `1px solid ${shell.border}`,
                      background: "rgba(0,0,0,0.15)",
                    }}
                  >
                    {isCollabFeatureAvailable() ? (
                      <Link
                        to={`/editor/${p.id}?collab=1`}
                        style={{
                          ...btnSecondary,
                          fontSize: "12px",
                          padding: "6px 12px",
                          textDecoration: "none",
                        }}
                        title={t("dashboard.collabHint")}
                      >
                        {t("dashboard.collab")}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      style={{ ...btnSecondary, fontSize: "12px", padding: "6px 12px" }}
                      onClick={() => void del(p.id)}
                    >
                      {t("dashboard.delete")}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {me && projects.length === 0 && !error ? (
          <div style={{ ...panelCard, padding: "32px 24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "14px", color: shell.textMuted, lineHeight: 1.6 }}>
              {t("dashboard.emptyProjects")}
            </p>
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
        ) : null}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { isDemoSessionToken, projectApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ChoreoGridLogo } from "../components/ChoreoGridLogo";
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

/**
 * `/editor/new` や既存 ID の編集に進む前の「作品を選ぶ」画面。
 * 未ログインでも新規・ブラウザ内データに進める。
 */
export function LibraryPage() {
  const { t } = useI18n();
  const { ready, me, logout } = useAuth();
  const [projects, setProjects] = useState<
    { id: number; name: string; updated_at: string }[]
  >([]);
  const [error, setError] = useState("");

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
        if (!c) setError(e instanceof Error ? e.message : t("library.listError"));
      }
    })();
    return () => {
      c = true;
    };
  }, [me, t]);

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
          padding: "14px 20px",
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
        >
          <Link
            to="/library"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: shell.text,
            }}
          >
            <ChoreoGridLogo size={40} title="ChoreoGrid" />
            <span>
              <span
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  color: shell.accent,
                  textTransform: "uppercase",
                }}
              >
                ChoreoGrid
              </span>
              <span style={{ fontSize: "15px", fontWeight: 700 }}>{t("library.pageTitle")}</span>
            </span>
          </Link>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {me ? (
              <>
                <span style={{ fontSize: "12px", color: shell.textMuted }}>{me.user.email}</span>
                <Link
                  to="/"
                  style={{ ...btnSecondary, padding: "6px 12px", fontSize: "12px", textDecoration: "none" }}
                >
                  {t("library.fullDashboard")}
                </Link>
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
                  style={{ ...btnSecondary, padding: "6px 12px", fontSize: "12px", textDecoration: "none" }}
                >
                  {t("dashboard.login")}
                </Link>
                <Link
                  to="/register"
                  style={{ ...btnAccent, padding: "6px 12px", fontSize: "12px", textDecoration: "none" }}
                >
                  {t("dashboard.register")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 48px" }}>
        <p style={{ margin: "0 0 22px", fontSize: "14px", lineHeight: 1.55, color: shell.textMuted }}>
          {t("library.pageSubtitle")}
        </p>

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

        <section style={{ marginBottom: 28 }}>
          <Link
            to="/editor/new"
            style={{
              ...btnAccent,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 24px",
              fontSize: "15px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {t("library.newWork")}
          </Link>
        </section>

        {legacyProject ? (
          <section style={{ marginBottom: 28 }}>
            <h2
              style={{
                margin: "0 0 10px",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: shell.textSubtle,
              }}
            >
              {t("library.browserDataTitle")}
            </h2>
            <div style={{ ...panelCard, padding: "18px 20px" }}>
              <p style={{ margin: "0 0 14px", fontSize: "14px", color: shell.textMuted, lineHeight: 1.55 }}>
                {t("library.browserDataDesc")}
              </p>
              <Link
                to="/editor/new"
                style={{
                  ...btnSecondary,
                  textDecoration: "none",
                  display: "inline-flex",
                  padding: "10px 18px",
                  fontSize: "13px",
                }}
              >
                {t("library.openBrowserData")}
              </Link>
            </div>
          </section>
        ) : null}

        <section>
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: shell.textSubtle,
            }}
          >
            {t("library.cloudSection")}
          </h2>

          {!me ? (
            <div style={{ ...panelCard, padding: "22px 20px" }}>
              <p style={{ margin: 0, fontSize: "14px", color: shell.textMuted, lineHeight: 1.55 }}>
                {t("library.needLoginForCloud")}
              </p>
            </div>
          ) : null}

          {me && error ? <p style={{ color: "#fca5a5", marginBottom: 16 }}>{error}</p> : null}

          {me ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {projects.map((p) => (
                <li key={p.id} style={{ ...panelCard, padding: 0, overflow: "hidden" }}>
                  <Link
                    to={`/editor/${p.id}`}
                    style={{
                      display: "block",
                      padding: "18px 20px",
                      textDecoration: "none",
                      color: shell.text,
                    }}
                  >
                    <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: 6 }}>{p.name}</div>
                    <div style={{ fontSize: "12px", color: shell.textMuted }}>
                      {t("dashboard.updatedLabel")}: {formatUpdatedAt(p.updated_at)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {me && projects.length === 0 && !error ? (
            <div style={{ ...panelCard, padding: "28px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "14px", color: shell.textMuted, lineHeight: 1.6 }}>
                {t("library.emptyCloud")}
              </p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

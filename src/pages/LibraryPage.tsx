import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { isDemoSessionToken, projectApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ChoreoCoreLogo } from "../components/ChoreoCoreLogo";
import { btnAccent, btnSecondary } from "../components/stageButtonStyles";
import { shell } from "../theme/choreoShell";
import { tryMigrateFromLocalStorage } from "../lib/projectDefaults";
import { copyTextToClipboard, projectShareLinks } from "../lib/shareProjectLinks";

/** 左カラムとヘッダの水平インセット */
const LIBRARY_GUTTER = "clamp(16px, 4vw, 44px)";

/** 奥行き:エディタの床のような薄いグリッド＋ライト（ルートでは裏にエディタは積めないため演出） */
const libraryBackdropLayer: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  background: `
    radial-gradient(ellipse 70% 52% at 76% 46%, rgba(212, 175, 55, 0.1), transparent 54%),
    linear-gradient(118deg, rgba(5, 5, 6, 0.2) 0%, rgba(6, 6, 8, 0.72) 36%, rgba(8, 7, 10, 0.35) 100%),
    repeating-linear-gradient(90deg, rgba(212, 175, 55, 0.05) 0 1px, transparent 1px 52px),
    repeating-linear-gradient(0deg, rgba(212, 175, 55, 0.04) 0 1px, transparent 1px 52px),
    ${shell.bgDeep}
  `,
};

/** 右側に薄い「ステージ枠」で次ページを連想させる */
const libraryStagePeekLayer: CSSProperties = {
  position: "absolute",
  top: "7%",
  right: "4%",
  bottom: "9%",
  left: "44%",
  zIndex: 0,
  pointerEvents: "none",
  borderRadius: "20px",
  border: "1px solid rgba(212, 175, 55, 0.14)",
  background:
    "linear-gradient(168deg, rgba(24, 22, 18, 0.18) 0%, rgba(8, 8, 10, 0.42) 100%)",
  boxShadow: "inset 0 0 100px rgba(0,0,0,0.45)",
  opacity: 0.9,
};

const libraryGlassHeader: CSSProperties = {
  background: "rgba(10, 9, 8, 0.62)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  borderBottom: `1px solid ${shell.border}`,
};

const libraryGlassPanel: CSSProperties = {
  background: "rgba(14, 13, 11, 0.55)",
  border: `1px solid ${shell.borderStrong}`,
  borderRadius: "14px",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

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
  const [shareCopyHint, setShareCopyHint] = useState("");

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

  useEffect(() => {
    if (!shareCopyHint) return;
    const t = window.setTimeout(() => setShareCopyHint(""), 2500);
    return () => window.clearTimeout(t);
  }, [shareCopyHint]);

  if (!ready) {
    return (
      <div
        style={{
          position: "relative",
          minHeight: "100dvh",
          overflow: "hidden",
          color: shell.textMuted,
          fontFamily: "system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div style={libraryBackdropLayer} aria-hidden />
        <div style={libraryStagePeekLayer} aria-hidden />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingLeft: `max(${LIBRARY_GUTTER}, env(safe-area-inset-left, 0px))`,
          }}
        >
          {t("common.loading")}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        overflow: "hidden",
        color: shell.text,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div style={libraryBackdropLayer} aria-hidden />
      <div style={libraryStagePeekLayer} aria-hidden />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
        }}
      >
      <header
        style={{
          ...libraryGlassHeader,
          padding: `max(14px, env(safe-area-inset-top, 0px)) max(${LIBRARY_GUTTER}, env(safe-area-inset-right, 0px)) 14px max(${LIBRARY_GUTTER}, env(safe-area-inset-left, 0px))`,
        }}
      >
        <div
          style={{
            width: "100%",
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
            <ChoreoCoreLogo height={40} title="ChoreoCore" />
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
                ChoreoCore
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

      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "stretch",
          padding: `28px max(${LIBRARY_GUTTER}, env(safe-area-inset-right, 0px)) max(56px, env(safe-area-inset-bottom, 0px)) max(${LIBRARY_GUTTER}, env(safe-area-inset-left, 0px))`,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "min(100%, 520px)",
            maxWidth: 520,
            marginRight: "auto",
          }}
        >
          <p
            style={{
              margin: "0 0 22px",
              fontSize: "14px",
              lineHeight: 1.55,
              color: shell.textMuted,
              textAlign: "left",
            }}
          >
            {t("library.pageSubtitle")}
          </p>

          {isDemoSessionToken() ? (
            <div
              style={{
                ...libraryGlassPanel,
                padding: "12px 14px",
                marginBottom: 20,
                border: "1px solid rgba(234, 179, 8, 0.42)",
                background: "rgba(234, 179, 8, 0.12)",
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
                  textAlign: "left",
                }}
              >
                {t("library.browserDataTitle")}
              </h2>
              <div style={{ ...libraryGlassPanel, padding: "18px 20px" }}>
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
                textAlign: "left",
              }}
            >
              {t("library.cloudSection")}
            </h2>

            {!me ? (
              <div style={{ ...libraryGlassPanel, padding: "22px 20px" }}>
                <p style={{ margin: 0, fontSize: "14px", color: shell.textMuted, lineHeight: 1.55 }}>
                  {t("library.needLoginForCloud")}
                </p>
              </div>
            ) : null}

            {me && error ? <p style={{ color: "#fca5a5", marginBottom: 16 }}>{error}</p> : null}

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
                {projects.map((p) => {
                  const sp = projectShareLinks(p.id);
                  return (
                  <li key={p.id} style={{ ...libraryGlassPanel, padding: 0, overflow: "hidden" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                      }}
                    >
                      <Link
                        to={`/editor/${p.id}`}
                        style={{
                          display: "block",
                          padding: "18px 20px 10px",
                          textDecoration: "none",
                          color: shell.text,
                        }}
                      >
                        <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: 6 }}>{p.name}</div>
                        <div style={{ fontSize: "12px", color: shell.textMuted }}>
                          {t("dashboard.updatedLabel")}: {formatUpdatedAt(p.updated_at)}
                        </div>
                      </Link>
                      <ul
                        style={{
                          listStyle: "none",
                          margin: 0,
                          padding: "0 20px 16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <li
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 8,
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(5, 46, 22, 0.25)",
                            border: "1px solid rgba(20, 83, 45, 0.5)",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: "1 1 120px" }}>
                            <div style={{ fontSize: "10px", fontWeight: 600, color: "#86efac", marginBottom: 2 }}>
                              共同編集（振り付けし・チーム用）
                            </div>
                            <div
                              style={{
                                fontSize: "9px",
                                color: "#94a3b8",
                                wordBreak: "break-all",
                                fontFamily: "ui-monospace,monospace",
                              }}
                            >
                              {sp.collab}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void copyTextToClipboard(sp.collab).then((ok) => {
                              if (ok) setShareCopyHint("共同編集用の URL をコピーしました。");
                            })}
                            style={{ ...btnAccent, padding: "4px 10px", fontSize: "11px", flexShrink: 0 }}
                          >
                            コピー
                          </button>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 8,
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(2, 32, 71, 0.35)",
                            border: "1px solid rgba(12, 74, 110, 0.55)",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: "1 1 120px" }}>
                            <div style={{ fontSize: "10px", fontWeight: 600, color: "#7dd3fc", marginBottom: 2 }}>
                              生徒用（閲覧だけ）
                            </div>
                            <div
                              style={{
                                fontSize: "9px",
                                color: "#94a3b8",
                                wordBreak: "break-all",
                                fontFamily: "ui-monospace,monospace",
                              }}
                            >
                              {sp.view}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void copyTextToClipboard(sp.view).then((ok) => {
                              if (ok) setShareCopyHint("閲覧用の URL をコピーしました。");
                            })}
                            style={{ ...btnSecondary, padding: "4px 10px", fontSize: "11px", flexShrink: 0 }}
                          >
                            コピー
                          </button>
                        </li>
                      </ul>
                    </div>
                  </li>
                );
                })}
              </ul>
            ) : null}

            {me && shareCopyHint ? (
              <p
                role="status"
                style={{
                  margin: "0 0 12px",
                  fontSize: "13px",
                  color: "#86efac",
                }}
              >
                {shareCopyHint}
              </p>
            ) : null}

            {me && projects.length === 0 && !error ? (
              <div style={{ ...libraryGlassPanel, padding: "28px 20px", textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: "14px", color: shell.textMuted, lineHeight: 1.6 }}>
                  {t("library.emptyCloud")}
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </main>
      </div>
    </div>
  );
}

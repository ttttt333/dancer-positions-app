import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoGridLogo";
import { inputField } from "../../components/stageButtonStyles";
import { shell } from "../../theme/choreoShell";
import type { EditorLayoutProps } from "./editorLayoutProps";

export function EditorPageHeader(props: EditorLayoutProps) {
  const mobileStackEditor = props.mobileStackEditor as boolean;
  const editorMobileLandscape = props.editorMobileLandscape as boolean;
  const project = props.project as EditorLayoutProps["project"];
  const setProjectSafe = props.setProjectSafe as EditorLayoutProps["setProjectSafe"];
  const t = props.t as (key: string) => string;

  return (
    <header
      className={mobileStackEditor ? "editor-page-header--mobile" : undefined}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: mobileStackEditor ? "4px" : "8px",
        alignItems: "center",
        padding: mobileStackEditor
          ? editorMobileLandscape
            ? "max(2px, env(safe-area-inset-top, 0px)) max(4px, env(safe-area-inset-right, 0px)) 1px max(4px, env(safe-area-inset-left, 0px))"
            : "max(2px, env(safe-area-inset-top, 0px)) max(6px, env(safe-area-inset-right, 0px)) 2px max(6px, env(safe-area-inset-left, 0px))"
          : "max(4px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px)) 4px max(8px, env(safe-area-inset-left, 0px))",
        borderBottom: `1px solid ${shell.border}`,
        background: shell.bgChrome,
        minHeight: 0,
        flexShrink: 0,
      }}
    >
      <Link
        to="/library"
        title={t("editor.backTitle")}
        aria-label={t("editor.backTitle")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: mobileStackEditor
            ? editorMobileLandscape
              ? 34
              : 38
            : 32,
          height: mobileStackEditor
            ? editorMobileLandscape
              ? 34
              : 38
            : 32,
          flexShrink: 0,
          textDecoration: "none",
          borderRadius: 8,
          color: shell.textMuted,
          touchAction: "manipulation",
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: mobileStackEditor
              ? editorMobileLandscape
                ? "18px"
                : "20px"
              : "22px",
            fontWeight: 500,
            lineHeight: 1,
            fontFamily: "ui-serif, 'Hiragino Mincho ProN', serif",
            letterSpacing: "-0.12em",
          }}
        >
          〉
        </span>
      </Link>
      <ChoreoCoreLogo
        height={
          mobileStackEditor
            ? editorMobileLandscape
              ? 26
              : 30
            : 40
        }
        title="ChoreoCore"
        style={{ flexShrink: 0, marginLeft: mobileStackEditor ? 2 : 4 }}
      />
      <div style={{ flex: "1 1 auto", minWidth: 8 }} aria-hidden />
      {!mobileStackEditor ? (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            color: shell.textMuted,
            flexShrink: 0,
          }}
          title={t("editor.headcount")}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            aria-hidden
            style={{ display: "block", opacity: 0.75 }}
          >
            <circle cx="12" cy="9" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M6 20c0-4 3.5-6 6-6s6 2 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="number"
            min={1}
            max={200}
            step={1}
            placeholder="—"
            title={t("editor.layout.pieceDancerCountTitle")}
            disabled={project.viewMode === "view"}
            value={project.pieceDancerCount ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                setProjectSafe((p) => ({ ...p, pieceDancerCount: null }));
                return;
              }
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              setProjectSafe((p) => ({
                ...p,
                pieceDancerCount: Math.max(1, Math.min(200, Math.floor(n))),
              }));
            }}
            style={{
              ...inputField,
              width: "56px",
              padding: "6px 8px",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </label>
      ) : null}
    </header>
  );
}

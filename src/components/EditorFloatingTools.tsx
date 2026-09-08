/**
 * FODI 風・縦型フローティングツール（Glass）。
 * PC: 左端中央の縦ピル / モバイル: FAB → 展開。
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { shell } from "../theme/choreoShell";
import { editorGlass, glassPillStyle } from "../theme/editorGlass";
import { flushEditorAutoSaveBeforeLeave } from "../lib/editorAutoSaveBridge";
import { useI18n } from "../i18n/I18nContext";

export type EditorFloatingToolsProps = {
  disabled?: boolean;
  onAddDancer?: () => void;
  onOpenFormationPresets?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  undoDisabled?: boolean;
  redoDisabled?: boolean;
  onSave?: () => void;
  onOpenLibrary?: () => void;
  onOpenExport?: () => void;
  onOpenShareLinks?: () => void;
  onOpenAISuggest?: () => void;
  onOpenCueSettings?: () => void;
  onOpenAudioImport?: () => void;
  onOpenMore?: () => void;
  /** desktop = 縦レール / mobile = FAB */
  variant?: "desktop" | "mobile";
};

const btnBase: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: `1px solid ${shell.border}`,
  background: "rgba(255,255,255,0.04)",
  color: shell.text,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};

function ToolBtn({
  title,
  disabled,
  onClick,
  children,
  active,
}: {
  title: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...btnBase,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        background: active
          ? "rgba(212,175,55,0.22)"
          : "rgba(255,255,255,0.04)",
        borderColor: active ? shell.accent : shell.border,
        color: active ? shell.accent : shell.text,
      }}
    >
      {children}
    </button>
  );
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconFormation() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="6" r="2.2" fill="currentColor" />
      <circle cx="6" cy="16" r="2.2" fill="currentColor" />
      <circle cx="18" cy="16" r="2.2" fill="currentColor" />
    </svg>
  );
}
function IconUndo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M9 14 4 9l5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconRedo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <g transform="translate(24 0) scale(-1 1)">
        <path
          d="M9 14 4 9l5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
function IconSave() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 3h11l3 3v15H5V3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 3v6h8V3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect x="8" y="13" width="8" height="5" rx="1" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 7h14M5 12h14M5 17h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ToolsCluster({
  props,
  orientation,
}: {
  props: EditorFloatingToolsProps;
  orientation: "vertical" | "horizontal";
}) {
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const disabled = props.disabled;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: orientation === "vertical" ? "column" : "row",
        alignItems: "center",
        gap: 6,
        position: "relative",
      }}
    >
      <ToolBtn
        title={t("editor.comp.k001")}
        disabled={disabled}
        onClick={props.onAddDancer}
      >
        <IconPlus />
      </ToolBtn>
      <ToolBtn
        title="隊形プリセット"
        disabled={disabled}
        onClick={props.onOpenFormationPresets}
      >
        <IconFormation />
      </ToolBtn>
      <ToolBtn
        title={t("editor.comp.k056")}
        disabled={props.undoDisabled ?? disabled}
        onClick={props.onUndo}
      >
        <IconUndo />
      </ToolBtn>
      <ToolBtn
        title={t("editor.comp.k014")}
        disabled={props.redoDisabled ?? disabled}
        onClick={props.onRedo}
      >
        <IconRedo />
      </ToolBtn>
      <ToolBtn
        title={t("editor.comp.k096")}
        disabled={disabled}
        onClick={props.onSave}
      >
        <IconSave />
      </ToolBtn>
      <ToolBtn
        title="その他"
        disabled={disabled}
        active={moreOpen}
        onClick={() => setMoreOpen((v) => !v)}
      >
        <IconMore />
      </ToolBtn>

      {moreOpen ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            ...(orientation === "vertical"
              ? { left: "calc(100% + 10px)", top: 0 }
              : { bottom: "calc(100% + 10px)", left: 0 }),
            minWidth: 168,
            padding: 8,
            borderRadius: 14,
            background: editorGlass.bgStrong,
            border: editorGlass.border,
            boxShadow: editorGlass.shadow,
            backdropFilter: editorGlass.blur,
            WebkitBackdropFilter: editorGlass.blur,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            zIndex: 50,
          }}
        >
          {[
            { label: t("editor.comp.k039"), fn: props.onOpenLibrary },
            { label: t("editor.comp.k021"), fn: props.onOpenCueSettings },
            { label: "音源", fn: props.onOpenAudioImport },
            { label: t("editor.comp.k006"), fn: props.onOpenAISuggest },
            { label: t("editor.comp.k059"), fn: props.onOpenShareLinks },
            { label: t("editor.comp.k016"), fn: props.onOpenExport },
            { label: "詳細ツール…", fn: props.onOpenMore },
          ].map((item) =>
            item.fn ? (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => {
                  setMoreOpen(false);
                  item.fn?.();
                }}
                style={{
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  color: shell.text,
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 650,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                {item.label}
              </button>
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 左上の独立ホームボタン */
export function EditorFloatingHomeButton() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Link
      to="/"
      title={t("editor.homeTitle")}
      aria-label={t("editor.homeTitle")}
      onClick={(e) => {
        e.preventDefault();
        void flushEditorAutoSaveBeforeLeave().finally(() => navigate("/"));
      }}
      style={{
        position: "fixed",
        top: `max(12px, env(safe-area-inset-top, 0px))`,
        left: editorGlass.safeLeft,
        zIndex: 45,
        ...glassPillStyle,
        padding: "8px 12px",
        gap: 6,
        textDecoration: "none",
        fontSize: 12,
        fontWeight: 700,
        color: shell.text,
      }}
    >
      ← ホーム
    </Link>
  );
}

export function EditorFloatingTools(props: EditorFloatingToolsProps) {
  const variant = props.variant ?? "desktop";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (variant !== "mobile") setMobileOpen(false);
  }, [variant]);

  if (variant === "mobile") {
    return (
      <div
        style={{
          position: "fixed",
          right: editorGlass.safeRight,
          bottom: `calc(96px + ${editorGlass.safeBottom})`,
          zIndex: 42,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
          pointerEvents: "auto",
        }}
      >
        {mobileOpen ? (
          <div
            style={{
              ...glassPillStyle,
              borderRadius: editorGlass.radiusPanel,
              padding: 10,
              maxWidth: "min(92vw, 420px)",
              overflowX: "auto",
            }}
          >
            <ToolsCluster props={props} orientation="horizontal" />
          </div>
        ) : null}
        <button
          type="button"
          title="ツール"
          aria-label="ツールを開く"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            border: editorGlass.borderGold,
            background: "linear-gradient(180deg, rgba(232,212,139,0.95), #d4af37)",
            color: "#0a0908",
            boxShadow: editorGlass.shadow,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <IconMenu />
        </button>
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="編集ツール"
      style={{
        position: "fixed",
        left: editorGlass.safeLeft,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 42,
        ...glassPillStyle,
        flexDirection: "column",
        borderRadius: editorGlass.radiusPanel,
        padding: "10px 8px",
        gap: 6,
        pointerEvents: "auto",
      }}
    >
      <ToolsCluster props={props} orientation="vertical" />
    </div>
  );
}

/**
 * 画面上部・常時視認の横並び Glass ツールバー。
 * 左縦ピルより「プロツールの速さ」を優先する。
 */

import type { CSSProperties, ReactNode } from "react";
import { shell } from "../../theme/choreoShell";
import { editorGlass, glassPillStyle } from "../../theme/editorGlass";
import { EditorFloatingHomeButton } from "../EditorFloatingTools";
import { useI18n } from "../../i18n/I18nContext";

export type FloatingHeaderToolbarProps = {
  disabled?: boolean;
  onAddDancer?: () => void;
  onOpenFormationPresets?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  undoDisabled?: boolean;
  redoDisabled?: boolean;
  onSave?: () => void;
  onOpenMore?: () => void;
  /** ホームを内蔵するか（false なら別置き） */
  showHome?: boolean;
};

const btn: CSSProperties = {
  height: 36,
  minWidth: 36,
  padding: "0 10px",
  borderRadius: 999,
  border: `1px solid ${shell.border}`,
  background: "rgba(255,255,255,0.05)",
  color: shell.text,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  flexShrink: 0,
};

function Btn({
  title,
  label,
  disabled,
  onClick,
  children,
}: {
  title: string;
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...btn,
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
      {label ? <span>{label}</span> : null}
    </button>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
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
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="6" r="2" fill="currentColor" />
      <circle cx="5.5" cy="16" r="2" fill="currentColor" />
      <circle cx="18.5" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}
function IconUndo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
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
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
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
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 3h11l3 3v15H5V3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 3v6h8V3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function FloatingHeaderToolbar({
  disabled,
  onAddDancer,
  onOpenFormationPresets,
  onUndo,
  onRedo,
  undoDisabled,
  redoDisabled,
  onSave,
  onOpenMore,
  showHome = true,
}: FloatingHeaderToolbarProps) {
  const { t } = useI18n();

  // Home chip sits top-left; nudge header slightly right of it on narrow screens
  return (
    <>
      {showHome ? <EditorFloatingHomeButton /> : null}
      <div
        role="toolbar"
        aria-label="編集ツール"
        style={{
          position: "fixed",
          top: `max(12px, env(safe-area-inset-top, 0px))`,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 44,
          ...glassPillStyle,
          gap: 6,
          padding: "6px 10px",
          maxWidth: "min(720px, calc(100vw - 140px))",
          overflowX: "auto",
          pointerEvents: "auto",
        }}
      >
        <Btn
          title={t("editor.comp.k001")}
          label="追加"
          disabled={disabled}
          onClick={onAddDancer}
        >
          <IconPlus />
        </Btn>
        <Btn
          title="隊形プリセット"
          label="隊形"
          disabled={disabled}
          onClick={onOpenFormationPresets}
        >
          <IconFormation />
        </Btn>
        <div
          aria-hidden
          style={{
            width: 1,
            height: 22,
            background: "rgba(255,255,255,0.12)",
            margin: "0 2px",
            flexShrink: 0,
          }}
        />
        <Btn
          title={t("editor.comp.k056")}
          disabled={undoDisabled ?? disabled}
          onClick={onUndo}
        >
          <IconUndo />
        </Btn>
        <Btn
          title={t("editor.comp.k014")}
          disabled={redoDisabled ?? disabled}
          onClick={onRedo}
        >
          <IconRedo />
        </Btn>
        <Btn
          title={t("editor.comp.k096")}
          label="保存"
          disabled={disabled}
          onClick={onSave}
        >
          <IconSave />
        </Btn>
        <Btn title="その他" disabled={disabled} onClick={onOpenMore}>
          <IconMore />
        </Btn>
      </div>
    </>
  );
}

/** モバイル: 再生バー左に常時表示（Add / 隊形） */
export function MobilePrimaryFloatingTools({
  disabled,
  onAddDancer,
  onOpenFormationPresets,
}: {
  disabled?: boolean;
  onAddDancer?: () => void;
  onOpenFormationPresets?: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(calc(-50% - min(42vw, 200px)))",
        bottom: `calc(96px + ${editorGlass.safeBottom})`,
        zIndex: 42,
        display: "flex",
        flexDirection: "row",
        gap: 8,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        title="ダンサー追加"
        aria-label="ダンサー追加"
        disabled={disabled}
        onClick={onAddDancer}
        style={{
          ...btn,
          width: 48,
          height: 48,
          borderRadius: 999,
          background: "linear-gradient(180deg, rgba(232,212,139,0.95), #d4af37)",
          color: "#0a0908",
          border: editorGlass.borderGold,
          boxShadow: editorGlass.shadow,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <IconPlus />
      </button>
      <button
        type="button"
        title="隊形プリセット"
        aria-label="隊形プリセット"
        disabled={disabled}
        onClick={onOpenFormationPresets}
        style={{
          ...btn,
          width: 48,
          height: 48,
          borderRadius: 999,
          background: editorGlass.bg,
          border: editorGlass.border,
          boxShadow: editorGlass.shadow,
          backdropFilter: editorGlass.blur,
          WebkitBackdropFilter: editorGlass.blur,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <IconFormation />
      </button>
    </div>
  );
}

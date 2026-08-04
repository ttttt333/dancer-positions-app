import type { ReactNode } from "react";
import { shell } from "../../theme/choreoShell";
import { homeDivider, homeMenuRow } from "./homeChrome";

export type ProjectSheetAction =
  | "rename"
  | "duplicate"
  | "copyLink"
  | "share"
  | "collab"
  | "exportPdf"
  | "delete"
  | "close";

type Props = {
  open: boolean;
  projectName: string;
  showCollab: boolean;
  busy: boolean;
  labels: {
    rename: string;
    duplicate: string;
    share: string;
    manageAccess: string;
    copyLink: string;
    exportPdf: string;
    delete: string;
    close: string;
  };
  onAction: (action: ProjectSheetAction) => void;
};

function SheetRow({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...homeMenuRow,
        color: danger ? "#f87171" : shell.text,
        opacity: disabled ? 0.45 : 1,
      }}
      onClick={onClick}
    >
      <span aria-hidden style={{ width: 22, textAlign: "center" }}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

/** 作品の … メニュー（添付のアクションシート風） */
export function ProjectActionSheet({
  open,
  projectName,
  showCollab,
  busy,
  labels,
  onAction,
}: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={projectName}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        padding: "16px max(12px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
      }}
      onClick={() => onAction("close")}
    >
      <div
        style={{
          width: "min(100%, 420px)",
          background: "#161616",
          borderRadius: 18,
          border: `1px solid rgba(255,255,255,0.08)`,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            background: "rgba(255,255,255,0.2)",
            margin: "10px auto 6px",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 18px 12px",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          <span aria-hidden>▦</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {projectName}
          </span>
        </div>

        <SheetRow
          icon="✎"
          label={labels.rename}
          disabled={busy}
          onClick={() => onAction("rename")}
        />
        <SheetRow
          icon="⊕"
          label={labels.duplicate}
          disabled={busy}
          onClick={() => onAction("duplicate")}
        />

        <div style={homeDivider} />

        <SheetRow
          icon="＋"
          label={labels.share}
          disabled={busy}
          onClick={() => onAction("share")}
        />
        {showCollab ? (
          <SheetRow
            icon="👥"
            label={labels.manageAccess}
            disabled={busy}
            onClick={() => onAction("collab")}
          />
        ) : null}
        <SheetRow
          icon="⛓"
          label={labels.copyLink}
          disabled={busy}
          onClick={() => onAction("copyLink")}
        />
        <SheetRow
          icon="⇪"
          label={labels.exportPdf}
          disabled={busy}
          onClick={() => onAction("exportPdf")}
        />

        <div style={homeDivider} />

        <SheetRow
          icon="🗑"
          label={labels.delete}
          danger
          disabled={busy}
          onClick={() => onAction("delete")}
        />

        <button
          type="button"
          style={{
            ...homeMenuRow,
            justifyContent: "center",
            color: shell.textMuted,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
          onClick={() => onAction("close")}
        >
          {labels.close}
        </button>
      </div>
    </div>
  );
}

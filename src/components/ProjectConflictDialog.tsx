import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import { useI18n } from "../i18n/I18nContext";

export type ProjectConflictKind = "load-draft" | "save-stale";

export type ProjectConflictDialogProps = {
  open: boolean;
  kind: ProjectConflictKind;
  serverUpdatedAt?: string | null;
  localSavedAt?: string | null;
  onKeepLocal: () => void;
  onTakeServer: () => void;
  onCancel?: () => void;
};

/**
 * 共同編集／オフライン復帰時の上書き警告。
 * 「気づかないうちに上書き」を防ぐための必須ダイアログ。
 */
export function ProjectConflictDialog({
  open,
  kind,
  serverUpdatedAt,
  localSavedAt,
  onKeepLocal,
  onTakeServer,
  onCancel,
}: ProjectConflictDialogProps) {
  const { t } = useI18n();
  if (!open) return null;

  const title =
    kind === "load-draft"
      ? t("conflict.load.title")
      : t("conflict.save.title");
  const body =
    kind === "load-draft" ? t("conflict.load.body") : t("conflict.save.body");
  const keepLabel =
    kind === "load-draft"
      ? t("conflict.load.keepLocal")
      : t("conflict.save.forceOverwrite");
  const takeLabel =
    kind === "load-draft"
      ? t("conflict.load.takeServer")
      : t("conflict.save.takeServer");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="choreo-conflict-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(2, 6, 23, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          borderRadius: 14,
          border: `1px solid ${shell.borderStrong}`,
          background: shell.bgDeep,
          color: shell.text,
          padding: "18px 18px 16px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
        }}
      >
        <h2
          id="choreo-conflict-title"
          style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 750 }}
        >
          {title}
        </h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55, color: "#94a3b8" }}>
          {body}
        </p>
        {(serverUpdatedAt || localSavedAt) && (
          <p style={{ margin: "0 0 14px", fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>
            {localSavedAt
              ? `${t("conflict.localAt")}: ${localSavedAt}`
              : null}
            {localSavedAt && serverUpdatedAt ? <br /> : null}
            {serverUpdatedAt
              ? `${t("conflict.serverAt")}: ${serverUpdatedAt}`
              : null}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={onTakeServer}
            style={{ ...btnAccent, minHeight: 44, fontSize: 14 }}
          >
            {takeLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              if (kind === "save-stale") {
                const ok = window.confirm(t("conflict.save.forceConfirm"));
                if (!ok) return;
              }
              onKeepLocal();
            }}
            style={{ ...btnSecondary, minHeight: 44, fontSize: 14 }}
          >
            {keepLabel}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              style={{
                ...btnSecondary,
                minHeight: 40,
                fontSize: 13,
                opacity: 0.85,
              }}
            >
              {t("conflict.cancel")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

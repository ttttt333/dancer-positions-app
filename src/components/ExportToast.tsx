import { createPortal } from "react-dom";
import type { ExportToastPayload } from "../hooks/useExportToast";

type Props = {
  toast: ExportToastPayload | null;
  onDismiss: () => void;
};

function kindIcon(kind: ExportToastPayload["kind"]): string {
  if (kind === "success") return "✓";
  if (kind === "error") return "!";
  return "i";
}

export function ExportToast({ toast, onDismiss }: Props) {
  if (!toast || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`export-toast export-toast--${toast.kind}`}
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
    >
      <div className="export-toast-icon" aria-hidden>
        {kindIcon(toast.kind)}
      </div>
      <div className="export-toast-body">
        <p className="export-toast-title">{toast.title}</p>
        {toast.description ? (
          <p className="export-toast-description">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="export-toast-close"
        aria-label="閉じる"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>,
    document.body
  );
}

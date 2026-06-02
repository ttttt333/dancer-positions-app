import { useCallback, useEffect, useRef, useState } from "react";

export type ExportToastKind = "success" | "error" | "info";

export type ExportToastPayload = {
  kind: ExportToastKind;
  title: string;
  description?: string;
};

const DEFAULT_DURATION_MS = 3200;

export function useExportToast(durationMs = DEFAULT_DURATION_MS) {
  const [toast, setToast] = useState<ExportToastPayload | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const showToast = useCallback(
    (payload: ExportToastPayload) => {
      clearTimer();
      setToast(payload);
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    [clearTimer, durationMs]
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { toast, showToast, dismiss };
}

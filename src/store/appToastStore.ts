import { create } from "zustand";
import type { ExportToastPayload } from "../hooks/useExportToast";

type AppToastState = {
  toast: ExportToastPayload | null;
  show: (payload: ExportToastPayload) => void;
  dismiss: () => void;
};

let timer: number | null = null;

export const useAppToastStore = create<AppToastState>((set) => ({
  toast: null,
  show: (payload) => {
    if (timer != null) window.clearTimeout(timer);
    set({ toast: payload });
    timer = window.setTimeout(() => {
      set({ toast: null });
      timer = null;
    }, 3600);
  },
  dismiss: () => {
    if (timer != null) window.clearTimeout(timer);
    timer = null;
    set({ toast: null });
  },
}));

/** フック外（解析ジョブ等）から静かにトースト */
export function showAppToast(payload: ExportToastPayload): void {
  useAppToastStore.getState().show(payload);
}

import { create } from "zustand";

export type ExportPhase = "recording" | "converting" | "done" | null;
export type ExportEncodeSubphase = "load" | "mux" | null;

type VideoExportRunState = {
  isExporting: boolean;
  progress: number;
  progressMessage: string;
  phase: ExportPhase;
  encodeSubphase: ExportEncodeSubphase | null;
};

type VideoExportRunActions = {
  setProgressValue: (n: number) => void;
  patch: (partial: Partial<VideoExportRunState>) => void;
  resetRun: () => void;
};

/** useVideoExport から参照（モジュール単位で書き出し中断フラグ） */
export const videoExportCancelRef = { current: false };
export const videoExportProgressRef = { current: 0 };

function clampExportProgress(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

const initialRunState: VideoExportRunState = {
  isExporting: false,
  progress: 0,
  progressMessage: "",
  phase: null,
  encodeSubphase: null,
};

export const useVideoExportRunStore = create<
  VideoExportRunState & VideoExportRunActions
>((set) => ({
  ...initialRunState,
  setProgressValue: (n) => {
    const v = clampExportProgress(n);
    videoExportProgressRef.current = v;
    set({ progress: v });
  },
  patch: (partial) => set(partial),
  resetRun: () => {
    videoExportProgressRef.current = 0;
    set(initialRunState);
  },
}));

export function cancelVideoExportRun(): void {
  videoExportCancelRef.current = true;
  useVideoExportRunStore.getState().patch({
    progressMessage: "キャンセル中…",
  });
}

export function isVideoExportRunning(): boolean {
  return useVideoExportRunStore.getState().isExporting;
}

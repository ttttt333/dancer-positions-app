import { create } from "zustand";
import { resetFFmpegWasm } from "../lib/ffmpegWasm";
import type { VideoExportProgressPhase } from "../lib/videoExportProgress";

export type ExportPhase = "recording" | "converting" | "saving" | "done" | null;
export type ExportEncodeSubphase = "load" | "mux" | null;

type VideoExportRunState = {
  isExporting: boolean;
  progress: number;
  progressMessage: string;
  phase: ExportPhase;
  encodeSubphase: ExportEncodeSubphase | null;
  phaseLabel: string;
  qualityHint: string;
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
  phaseLabel: "",
  qualityHint: "",
};

export const useVideoExportRunStore = create<
  VideoExportRunState & VideoExportRunActions
>((set, get) => ({
  ...initialRunState,
  setProgressValue: (n) => {
    const v = clampExportProgress(n);
    const mono = Math.max(videoExportProgressRef.current, v);
    videoExportProgressRef.current = mono;
    if (mono !== get().progress) {
      set({ progress: mono });
    }
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
  // FFmpeg.exec はキャンセルフラグを見ないため Worker を止めて即中断する
  try {
    resetFFmpegWasm();
  } catch {
    /* ignore */
  }
}

export function isVideoExportRunning(): boolean {
  return useVideoExportRunStore.getState().isExporting;
}

export function exportPhaseToProgressPhase(
  phase: ExportPhase
): VideoExportProgressPhase | null {
  if (phase === "recording") return "capture";
  if (phase === "converting") return "encode";
  if (phase === "saving") return "save";
  return null;
}

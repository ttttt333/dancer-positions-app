import { create } from "zustand";
import { isVideoExportRunning } from "./videoExportRunStore";

/** エディタの動画書き出しシート（モバイルメニュー・右アイコンから開く） */
export const useVideoExportUiStore = create<{
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}>((set) => ({
  open: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => {
    if (isVideoExportRunning()) return;
    set({ open: false });
  },
}));

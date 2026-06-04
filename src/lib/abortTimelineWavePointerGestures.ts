import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";

/** 波形のキュー／空きドラッグを破棄（レイアウト畳み・リサイズ時の誤コミット防止） */
export function abortTimelineWavePointerGestures(): void {
  useTimelineWaveBridgeStore.getState().abortPointerGestures?.();
}

import type { RefObject } from "react";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";

/** 縦画面ポートレート Canvas が有効なときはそちらを、それ以外はデスクトップ波形 Canvas を返す */
export function resolveActiveWaveCanvas(
  desktopRef: RefObject<HTMLCanvasElement | null>
): HTMLCanvasElement | null {
  const bridge = useTimelineWaveBridgeStore.getState();
  if (bridge.portraitActive && bridge.portraitCanvasRef?.current) {
    return bridge.portraitCanvasRef.current;
  }
  return desktopRef.current;
}

/** pointerdown の currentTarget、またはデスクトップ ref から Canvas を解決（長押し委譲後の stale event 対策） */
export function resolveWavePointerCanvas(
  desktopRef: RefObject<HTMLCanvasElement | null>,
  eventTarget: EventTarget | null | undefined
): HTMLCanvasElement | null {
  if (eventTarget instanceof HTMLCanvasElement) {
    return eventTarget;
  }
  return resolveActiveWaveCanvas(desktopRef);
}

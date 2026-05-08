import { useEffect, useState } from "react";
import type {
  GapRouteMenuState,
  WaveCueConfirmState,
  WaveCueMenuState,
} from "../components/TimelineWaveMenus";

/** 波形まわりのコンテキストメニュー・確認 UI の状態と Escape で閉じる挙動 */
export function useTimelineWaveMenuState() {
  const [waveCueMenu, setWaveCueMenu] = useState<WaveCueMenuState>(null);
  const [gapRouteMenu, setGapRouteMenu] = useState<GapRouteMenuState>(null);
  const [waveCueConfirm, setWaveCueConfirm] = useState<WaveCueConfirmState>(null);

  useEffect(() => {
    if (!waveCueMenu && !waveCueConfirm && !gapRouteMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setWaveCueConfirm(null);
      setWaveCueMenu(null);
      setGapRouteMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [waveCueMenu, waveCueConfirm, gapRouteMenu]);

  return {
    waveCueMenu,
    setWaveCueMenu,
    gapRouteMenu,
    setGapRouteMenu,
    waveCueConfirm,
    setWaveCueConfirm,
  };
}

/**
 * スマホ再生中に次キューへ入ったときの微振動。
 * PC や非対応環境（iOS Safari など Vibration API 非対応）では何もしない。
 */
export function vibrateOnCueAdvance(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  if (!shouldUseCueAdvanceHaptic()) return;
  try {
    /** 短い2段タップで「キュー切替」を感じやすくする */
    navigator.vibrate([10, 24, 14]);
  } catch {
    /* ignore */
  }
}

function shouldUseCueAdvanceHaptic(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  /** 横画面スマホは幅が広くても高さは低い */
  const shortLandscape = window.matchMedia(
    "(max-height: 520px) and (orientation: landscape)"
  ).matches;
  return coarse || noHover || narrow || shortLandscape;
}

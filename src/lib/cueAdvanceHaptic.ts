/**
 * スマホ再生中に次キューへ入ったときの微振動。
 * PC や非対応環境では何もしない。
 */
export function vibrateOnCueAdvance(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  const coarse =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const narrow =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 900px)").matches;
  if (!coarse && !narrow) return;
  try {
    navigator.vibrate(12);
  } catch {
    /* ignore */
  }
}

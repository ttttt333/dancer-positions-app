/** iOS / iPadOS や Safari 系: ユーザータップ外の `HTMLAudioElement.play()` が拒否されやすい */
export function playbackRequiresUserGestureToStart(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return true;
  const safari =
    /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPR/i.test(ua);
  return safari;
}

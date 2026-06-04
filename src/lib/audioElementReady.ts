/** HTMLMediaElement.error.code に対応するユーザー向けメッセージ */
export function mediaElementErrorMessage(el: HTMLMediaElement | null): string {
  const code = el?.error?.code;
  const messages: Record<number, string> = {
    1: "読み込みが中断されました",
    2: "ネットワークエラーが発生しました",
    3: "音声ファイルのデコードに失敗しました",
    4: "対応していない音声形式です",
  };
  return messages[code ?? 0] ?? "音声を読み込めませんでした";
}

/**
 * 再生可能になるまで待つ（canplaythrough → loadedmetadata フォールバック）。
 * CHOREO CORE 音声エンジン: src 設定後にブラウザのバッファリング完了を待つ。
 */
export function waitForAudioElementReady(
  el: HTMLAudioElement | null,
  timeoutMs = 90_000
): Promise<void> {
  if (!el) return Promise.resolve();
  if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      el.removeEventListener("canplaythrough", onReady);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("error", onError);
      fn();
    };

    const onReady = () => finish(resolve);
    const onMeta = () => {
      if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
        finish(resolve);
      }
    };
    const onError = () =>
      finish(() => reject(new Error(mediaElementErrorMessage(el))));

    const timer = window.setTimeout(
      () => finish(() => reject(new Error("音源の読み込みがタイムアウトしました"))),
      timeoutMs
    );

    el.addEventListener("canplaythrough", onReady, { once: true });
    el.addEventListener("loadedmetadata", onMeta, { once: true });
    el.addEventListener("error", onError, { once: true });
  });
}

/** iOS / CORS 向けの HTMLAudioElement 初期設定 */
export function configureHtmlAudioElement(el: HTMLAudioElement): void {
  el.crossOrigin = "anonymous";
  el.preload = "auto";
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
}

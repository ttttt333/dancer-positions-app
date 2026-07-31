/**
 * 生徒閲覧で端末のブラウザ UI を隠す（Android Chrome / 対応ブラウザ）。
 * iPhone Safari は Fullscreen API 非対応のため何もしない。
 */
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

export function isViewerFullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FullscreenElement;
  return (
    typeof el.requestFullscreen === "function" ||
    typeof el.webkitRequestFullscreen === "function"
  );
}

export function isViewerFullscreenActive(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/** ユーザー操作の直後に呼ぶ（再生・全画面ボタンなど）。失敗しても無視。 */
export function tryEnterViewerFullscreen(): void {
  if (typeof document === "undefined") return;
  if (isViewerFullscreenActive()) return;
  const el = document.documentElement as FullscreenElement;
  try {
    if (typeof el.requestFullscreen === "function") {
      // navigationUI: hide で上下のブラウザバーを隠す（対応ブラウザ）
      void el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
      return;
    }
    void el.webkitRequestFullscreen?.();
  } catch {
    try {
      void el.requestFullscreen?.();
    } catch {
      /* 非対応・拒否は無視 */
    }
  }
}

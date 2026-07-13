import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function isFullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FullscreenElement;
  return typeof el.requestFullscreen === "function" ||
    typeof el.webkitRequestFullscreen === "function";
}

function currentFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * 閲覧: ブラウザの URL バー・下部バーを隠す全画面ボタン。
 * iPhone の Safari は Fullscreen API 非対応のため、その場合は表示しない。
 */
export function ViewerFullscreenButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const [supported] = useState(isFullscreenSupported);
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && currentFullscreenElement() != null
  );

  useEffect(() => {
    if (!supported) return;
    const sync = () => setIsFullscreen(currentFullscreenElement() != null);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [supported]);

  const toggle = useCallback(() => {
    const doc = document as FullscreenDocument;
    if (currentFullscreenElement()) {
      void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    const el = document.documentElement as FullscreenElement;
    try {
      void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    } catch {
      // 全画面にできない環境では何もしない
    }
  }, []);

  if (!supported) return null;

  const label = isFullscreen
    ? t("editor.layout.viewerFullscreenExit")
    : t("editor.layout.viewerFullscreenEnter");

  return (
    <button
      type="button"
      className={["choreo-viewer-bars__video-btn", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={label}
      aria-pressed={isFullscreen}
      onClick={toggle}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ display: "block", margin: "0 auto" }}
      >
        {isFullscreen ? (
          <>
            <path d="M9 3v6H3" />
            <path d="M15 3v6h6" />
            <path d="M9 21v-6H3" />
            <path d="M15 21v-6h6" />
          </>
        ) : (
          <>
            <path d="M3 9V3h6" />
            <path d="M21 9V3h-6" />
            <path d="M3 15v6h6" />
            <path d="M21 15v6h-6" />
          </>
        )}
      </svg>
    </button>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import {
  isViewerFullscreenActive,
  isViewerFullscreenSupported,
  tryEnterViewerFullscreen,
} from "../lib/viewerFullscreen";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type Props = {
  className?: string;
  /** 横画面レールでは「全画面」文字を出して分かりやすくする */
  showLabel?: boolean;
};

/**
 * 閲覧: ブラウザの URL バー・下部バーを隠す全画面ボタン。
 * iPhone の Safari は Fullscreen API 非対応のため、その場合は表示しない。
 */
export function ViewerFullscreenButton({
  className,
  showLabel = false,
}: Props) {
  const { t } = useI18n();
  const [supported] = useState(isViewerFullscreenSupported);
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && isViewerFullscreenActive()
  );

  useEffect(() => {
    if (!supported) return;
    const sync = () => setIsFullscreen(isViewerFullscreenActive());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [supported]);

  const toggle = useCallback(() => {
    const doc = document as FullscreenDocument;
    if (isViewerFullscreenActive()) {
      void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    tryEnterViewerFullscreen();
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
      style={
        showLabel
          ? {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              minHeight: 40,
              padding: "6px 8px",
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.15,
            }
          : undefined
      }
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
        style={{ display: "block", margin: showLabel ? 0 : "0 auto" }}
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
      {showLabel ? (
        <span>{isFullscreen ? "解除" : "全画面"}</span>
      ) : null}
    </button>
  );
}

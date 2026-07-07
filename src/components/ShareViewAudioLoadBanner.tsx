import { useI18n } from "../i18n/I18nContext";
import { useShareViewAudioLoadStore } from "../store/shareViewAudioLoadStore";

/** 閲覧共有: 音源ダウンロード進捗と著作権注意 */
export function ShareViewAudioLoadBanner({
  tight,
  loadError,
  compact = false,
}: {
  tight?: boolean;
  loadError?: string | null;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const phase = useShareViewAudioLoadStore((s) => s.phase);
  const ratio = useShareViewAudioLoadStore((s) => s.ratio);
  const message = useShareViewAudioLoadStore((s) => s.message);

  if (phase === "idle" && !loadError) {
    if (compact) return null;
    return (
      <p className="choreo-viewer-copyright">{t("editor.layout.viewerCopyrightNotice")}</p>
    );
  }

  const labelStyle = { fontSize: tight ? 11 : 12 };

  return (
    <>
      {phase === "loading" ? (
        <div
          className="choreo-viewer-audio-load"
          role="status"
          aria-live="polite"
        >
          <div className="choreo-viewer-audio-load__label" style={labelStyle}>
            {message || t("editor.layout.viewerAudioLoading")}
          </div>
          <div
            className="choreo-viewer-audio-load__track"
            aria-hidden
          >
            <div
              className="choreo-viewer-audio-load__fill"
              style={{ width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      {phase === "ready" ? (
        <div
          className="choreo-viewer-audio-load choreo-viewer-audio-load--ready"
          role="status"
        >
          {message || t("editor.layout.viewerAudioReady")}
        </div>
      ) : null}
      {loadError || phase === "error" ? (
        <div
          className="choreo-viewer-audio-load choreo-viewer-audio-load--error"
          role="alert"
        >
          {loadError || message || t("editor.layout.viewerAudioLoadFailed")}
        </div>
      ) : null}
      {phase === "unconfigured" ? (
        <div
          className="choreo-viewer-audio-load choreo-viewer-audio-load--warn"
          role="status"
        >
          {t("editor.layout.viewerNoAudioConfigured")}
        </div>
      ) : null}
      {!compact ? (
        <p className="choreo-viewer-copyright">{t("editor.layout.viewerCopyrightNotice")}</p>
      ) : null}
    </>
  );
}

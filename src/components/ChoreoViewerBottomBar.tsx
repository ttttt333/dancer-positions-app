import { useEffect } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { shell } from "../theme/choreoShell";
import { useI18n } from "../i18n/I18nContext";
import { playbackEngine } from "../core/playbackEngine";
import { hasViewerPlayIntent } from "../lib/playbackViewerIntent";
import { useWaveformLoadProgressStore } from "../store/waveformLoadProgressStore";
import { useShareViewAudioLoadStore } from "../store/shareViewAudioLoadStore";
import { ShareViewAudioLoadBanner } from "./ShareViewAudioLoadBanner";

/** 閲覧共有ステージ上のダンサー印の表示倍率（従来比 2/3） */
export const PUBLIC_VIEWER_MARKER_DISPLAY_SCALE = 2 / 3;

function viewerBarHeightPx(tight: boolean, showAudioRow: boolean): number {
  if (!showAudioRow) return 0;
  return tight ? 36 : 40;
}

export type ChoreoViewerBottomBarProps = {
  project: ChoreographyProjectJson;
  isPlaying: boolean;
  tightHeight: boolean;
  onBarHeightChange?: (px: number) => void;
};

export function ChoreoViewerBottomBar({
  project,
  isPlaying,
  tightHeight,
  onBarHeightChange,
}: ChoreoViewerBottomBarProps) {
  const { t } = useI18n();
  const shareAudioPhase = useShareViewAudioLoadStore((s) => s.phase);
  const waveLoad = useWaveformLoadProgressStore((s) => s.progress);
  const audioLoadError =
    waveLoad?.error === true ? waveLoad.message?.trim() || null : null;
  const shareAudioPath =
    typeof project.audioSupabasePath === "string"
      ? project.audioSupabasePath.trim()
      : "";
  const noShareAudioConfigured =
    shareAudioPath.length === 0 &&
    (project.audioAssetId == null || project.audioAssetId <= 0);
  const awaitingAudioTap =
    !audioLoadError &&
    !noShareAudioConfigured &&
    isPlaying &&
    Boolean(playbackEngine.getMediaSourceUrl()) &&
    playbackEngine.isPaused() &&
    hasViewerPlayIntent();

  const showAudioRow =
    shareAudioPhase === "loading" ||
    shareAudioPhase === "error" ||
    shareAudioPhase === "unconfigured" ||
    Boolean(audioLoadError);
  const visible = showAudioRow || awaitingAudioTap;

  const barHeightPx = viewerBarHeightPx(tightHeight, showAudioRow || awaitingAudioTap);

  useEffect(() => {
    onBarHeightChange?.(!visible ? 0 : barHeightPx);
  }, [barHeightPx, onBarHeightChange, visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={[
        "choreo-viewer-bottom-bar",
        "choreo-viewer-bottom-bar--meta-closed",
        tightHeight ? "choreo-viewer-bottom-bar--tight" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        borderTop: `1px solid ${shell.border}`,
        background: "rgba(15, 23, 42, 0.98)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.35)",
        paddingBottom: "max(4px, env(safe-area-inset-bottom, 0px))",
        ["--choreo-viewer-bar-h" as string]: `${barHeightPx}px`,
      }}
    >
      {showAudioRow ? (
        <ShareViewAudioLoadBanner
          tight={tightHeight}
          loadError={audioLoadError}
          compact
        />
      ) : null}
      {awaitingAudioTap ? (
        <div className="choreo-viewer-audio-tap-hint" role="status">
          {t("editor.layout.viewerTapPlayForSound")}
        </div>
      ) : null}
    </div>
  );
}

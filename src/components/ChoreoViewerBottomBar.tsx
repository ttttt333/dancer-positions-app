import { useCallback, useEffect, useState, type RefObject } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { TimelinePanelHandle } from "./timelinePanelTypes";
import type { StudentPick } from "./ChoreoStudentViewGate";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import { formatMmSsFloor } from "../lib/timeFormat";
import {
  TransportIconPause,
  TransportIconPlay,
  TransportIconSkipBack,
  TransportIconSkipForward,
  TransportIconStop,
} from "./mobile/TransportIcons";
import { VideoExportButton } from "./VideoExportButton";
import { useI18n } from "../i18n/I18nContext";
import { playbackEngine } from "../core/playbackEngine";
import {
  seekPlaybackClampedAndSyncStore,
  stopPlaybackAtTrimStart,
  togglePlaybackRespectingTrimStart,
} from "../lib/playbackTransport";
import { primeAudioForUserGesture } from "../lib/playbackViewerIntent";
import { toggleViewerPlayback } from "../lib/viewerPlayback";

/** 閲覧共有ステージ上のダンサー印の表示倍率（従来比 2/3） */
export const PUBLIC_VIEWER_MARKER_DISPLAY_SCALE = 2 / 3;

function viewerBarHeightPx(
  tight: boolean,
  metaExpanded: boolean,
  transportInBar: boolean,
  chromeCollapsed: boolean
): number {
  if (chromeCollapsed) return 0;
  if (tight && !transportInBar) {
    if (!metaExpanded) return 44;
    return 88;
  }
  if (!metaExpanded) return tight ? 54 : 58;
  return tight ? 96 : 104;
}

type TransportProps = {
  project: ChoreographyProjectJson;
  timelineRef?: RefObject<TimelinePanelHandle | null>;
  trimStartSec: number;
  trimEndSec: number | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  compact?: boolean;
  onBeforeTransport?: () => void | Promise<void>;
};

export function ChoreoViewerTransportControls({
  project,
  timelineRef,
  trimStartSec,
  trimEndSec,
  isPlaying,
  currentTime,
  duration,
  compact = false,
  onBeforeTransport,
}: TransportProps) {
  const { t } = useI18n();
  const btnSize = compact ? 40 : 44;
  const iconPrimary = compact ? 22 : 24;
  const iconSecondary = compact ? 18 : 20;

  const transportBtn = {
    ...btnSecondary,
    minWidth: btnSize,
    minHeight: btnSize,
    padding: 0,
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexShrink: 0,
  };

  const seekBack = useCallback(() => {
    onBeforeTransport?.();
    if (playbackEngine.getMediaSourceUrl()) {
      seekPlaybackClampedAndSyncStore({
        t: playbackEngine.getCurrentTime() - 5,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
      });
      return;
    }
    timelineRef?.current?.seekBackward5Sec();
  }, [duration, onBeforeTransport, timelineRef, trimEndSec, trimStartSec]);

  const seekForward = useCallback(() => {
    onBeforeTransport?.();
    if (playbackEngine.getMediaSourceUrl()) {
      seekPlaybackClampedAndSyncStore({
        t: playbackEngine.getCurrentTime() + 5,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
      });
      return;
    }
    timelineRef?.current?.seekForward5Sec();
  }, [duration, onBeforeTransport, timelineRef, trimEndSec, trimStartSec]);

  const togglePlay = useCallback(() => {
    void onBeforeTransport?.();
    toggleViewerPlayback(project, trimStartSec);
  }, [onBeforeTransport, project, trimStartSec]);

  const stopPlayback = useCallback(() => {
    onBeforeTransport?.();
    if (playbackEngine.getMediaSourceUrl()) {
      stopPlaybackAtTrimStart(trimStartSec);
      return;
    }
    timelineRef?.current?.stopPlayback();
  }, [onBeforeTransport, timelineRef, trimStartSec]);

  return (
    <>
      <button
        type="button"
        aria-label={t("editor.comp.k002")}
        title={t("editor.comp.k002")}
        onClick={seekBack}
        disabled={duration <= 0}
        style={transportBtn}
      >
        <TransportIconSkipBack size={iconSecondary} />
      </button>
      <button
        type="button"
        aria-label={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
        title={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
        onPointerDown={primeAudioForUserGesture}
        onClick={togglePlay}
        style={{
          ...btnAccent,
          minWidth: btnSize + 4,
          minHeight: btnSize + 4,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isPlaying ? (
          <TransportIconPause size={iconPrimary} />
        ) : (
          <TransportIconPlay size={iconPrimary} />
        )}
      </button>
      <button
        type="button"
        aria-label={t("editor.layout.stop")}
        title={t("editor.comp.k060")}
        onClick={stopPlayback}
        style={transportBtn}
      >
        <TransportIconStop size={iconSecondary} />
      </button>
      <button
        type="button"
        aria-label={t("editor.comp.k003")}
        title={t("editor.comp.k003")}
        onClick={seekForward}
        disabled={duration <= 0}
        style={transportBtn}
      >
        <TransportIconSkipForward size={iconSecondary} />
      </button>
      <span
        className="choreo-viewer-time"
        aria-live="polite"
        aria-label={`${formatMmSsFloor(currentTime)} / ${formatMmSsFloor(duration)}`}
      >
        {formatMmSsFloor(currentTime)}
        <span className="choreo-viewer-timeSep">/</span>
        {formatMmSsFloor(duration)}
      </span>
    </>
  );
}

export type ChoreoViewerLandscapeRailProps = {
  project: ChoreographyProjectJson;
  timelineRef: RefObject<TimelinePanelHandle | null>;
  trimStartSec: number;
  trimEndSec: number | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  chromeCollapsed: boolean;
  onBeforeTransport?: () => void | Promise<void>;
};

/** 横画面閲覧: 左端の再生コントロール列（畳み可） */
export function ChoreoViewerLandscapeRail({
  project,
  timelineRef,
  trimStartSec,
  trimEndSec,
  isPlaying,
  currentTime,
  duration,
  chromeCollapsed,
  onBeforeTransport,
}: ChoreoViewerLandscapeRailProps) {
  const { t } = useI18n();
  const [railOpen, setRailOpen] = useState(true);

  if (chromeCollapsed) return null;

  return (
    <div
      className={[
        "choreo-viewer-landscape-rail",
        railOpen ? "choreo-viewer-landscape-rail--open" : "choreo-viewer-landscape-rail--collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="choreo-viewer-landscape-rail-toggle"
        aria-expanded={railOpen}
        aria-label={
          railOpen
            ? t("editor.layout.viewerRailCollapse")
            : t("editor.layout.viewerRailExpand")
        }
        title={
          railOpen
            ? t("editor.layout.viewerRailCollapse")
            : t("editor.layout.viewerRailExpand")
        }
        onClick={() => setRailOpen((v) => !v)}
      >
        {railOpen ? "‹" : "›"}
      </button>
      {railOpen ? (
        <div className="choreo-viewer-landscape-rail-controls">
          <ChoreoViewerTransportControls
            project={project}
            timelineRef={timelineRef}
            trimStartSec={trimStartSec}
            trimEndSec={trimEndSec}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            compact
            onBeforeTransport={onBeforeTransport}
          />
        </div>
      ) : (
        <button
          type="button"
          className="choreo-viewer-landscape-rail-play-mini"
          aria-label={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
          title={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
          onPointerDown={primeAudioForUserGesture}
          onClick={() => {
            void onBeforeTransport?.();
            toggleViewerPlayback(project, trimStartSec);
          }}
        >
          {isPlaying ? (
            <TransportIconPause size={22} />
          ) : (
            <TransportIconPlay size={22} />
          )}
        </button>
      )}
    </div>
  );
}

export type ChoreoViewerChromeRestoreFabProps = {
  onRestore: () => void;
};

/** コントロールを隠したあと、ワンタップで戻す FAB */
export function ChoreoViewerChromeRestoreFab({
  onRestore,
}: ChoreoViewerChromeRestoreFabProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="choreo-viewer-restore-fab"
      aria-label={t("editor.layout.viewerChromeExpand")}
      title={t("editor.layout.viewerChromeExpand")}
      onClick={onRestore}
    >
      {t("editor.layout.viewerChromeExpandShort")}
    </button>
  );
}

export type ChoreoViewerBottomBarProps = {
  timelineRef: RefObject<TimelinePanelHandle | null>;
  project: ChoreographyProjectJson;
  choreoStudentPick: StudentPick;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tightHeight: boolean;
  chromeCollapsed: boolean;
  onChromeCollapsedChange: (collapsed: boolean) => void;
  onBeforeTransport?: () => void;
  onOpenMemberSheet: () => void;
  onBarHeightChange?: (px: number) => void;
  fileName: string;
};

export function ChoreoViewerBottomBar({
  timelineRef,
  project,
  choreoStudentPick,
  isPlaying,
  currentTime,
  duration,
  tightHeight,
  chromeCollapsed,
  onChromeCollapsedChange,
  onBeforeTransport,
  onOpenMemberSheet,
  onBarHeightChange,
  fileName,
}: ChoreoViewerBottomBarProps) {
  const { t } = useI18n();
  const trimStartSec = project.trimStartSec ?? 0;
  const trimEndSec = project.trimEndSec ?? null;
  const [metaExpanded, setMetaExpanded] = useState(() => !tightHeight);

  useEffect(() => {
    setMetaExpanded(!tightHeight);
  }, [tightHeight]);

  const transportInBar = !tightHeight;
  const barHeightPx = viewerBarHeightPx(
    tightHeight,
    metaExpanded,
    transportInBar,
    chromeCollapsed
  );

  useEffect(() => {
    onBarHeightChange?.(chromeCollapsed ? 0 : barHeightPx);
  }, [barHeightPx, chromeCollapsed, onBarHeightChange]);

  if (chromeCollapsed) {
    return null;
  }

  return (
    <div
      className={[
        "choreo-viewer-bottom-bar",
        tightHeight ? "choreo-viewer-bottom-bar--tight" : "",
        metaExpanded ? "choreo-viewer-bottom-bar--meta-open" : "choreo-viewer-bottom-bar--meta-closed",
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
      <div className="choreo-viewer-playback-row">
        {transportInBar ? (
          <div className="choreo-viewer-transport-group">
            <ChoreoViewerTransportControls
              project={project}
              timelineRef={timelineRef}
              trimStartSec={trimStartSec}
              trimEndSec={trimEndSec}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              compact={tightHeight}
              onBeforeTransport={onBeforeTransport}
            />
          </div>
        ) : null}
        <button
          type="button"
          className="choreo-viewer-meta-toggle"
          aria-expanded={metaExpanded}
          aria-label={
            metaExpanded
              ? t("editor.layout.viewerMetaCollapse")
              : t("editor.layout.viewerMetaExpand")
          }
          title={
            metaExpanded
              ? t("editor.layout.viewerMetaCollapse")
              : t("editor.layout.viewerMetaExpand")
          }
          onClick={() => setMetaExpanded((v) => !v)}
          style={{
            ...btnSecondary,
            minWidth: tightHeight ? 36 : 40,
            minHeight: tightHeight ? 36 : 40,
            padding: tightHeight ? "4px 12px" : "6px 14px",
            fontSize: tightHeight ? 12 : 13,
            fontWeight: 600,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          {metaExpanded ? "▾" : "▴"}
          <span>{t("editor.layout.viewerMetaLabel")}</span>
        </button>
        {!metaExpanded ? (
          <button
            type="button"
            onClick={() => setMetaExpanded(true)}
            style={{
              ...btnAccent,
              fontSize: tightHeight ? 12 : 13,
              fontWeight: 700,
              minHeight: tightHeight ? 36 : 40,
              padding: tightHeight ? "4px 10px" : "6px 12px",
              flexShrink: 0,
            }}
          >
            動画
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onChromeCollapsedChange(true)}
          style={{
            ...btnSecondary,
            fontSize: tightHeight ? 12 : 13,
            fontWeight: 600,
            flexShrink: 0,
            minHeight: tightHeight ? 36 : 40,
            minWidth: 56,
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: tightHeight ? "4px 10px" : "6px 12px",
          }}
          aria-label={t("editor.layout.viewerChromeCollapse")}
          title={t("editor.layout.viewerChromeCollapse")}
        >
          {t("editor.layout.viewerChromeCollapseShort")}
        </button>
      </div>
      {metaExpanded ? (
        <div
          className="choreo-viewer-meta-row"
          style={{
            gap: tightHeight ? 6 : 8,
            padding: tightHeight ? "6px 10px 8px" : "8px 12px 10px",
          }}
        >
          <span className="choreo-viewer-piece-title">
            {(project.pieceTitle || t("editor.untitledProject")).trim()}
            {t("editor.layout.viewingSuffix")}
          </span>
          <span className="choreo-viewer-member">
            {choreoStudentPick.kind === "all"
              ? t("editor.layout.allMembers")
              : `${choreoStudentPick.label}${t("editor.layout.memberSuffix")}`}
            {t("editor.layout.partViewing")}
          </span>
          <button
            type="button"
            onClick={onOpenMemberSheet}
            style={{
              ...btnSecondary,
              marginLeft: "auto",
              fontSize: tightHeight ? 12 : 13,
              fontWeight: 600,
              minHeight: tightHeight ? 36 : 40,
              padding: tightHeight ? "4px 10px" : "6px 12px",
              touchAction: "manipulation",
              flexShrink: 0,
            }}
            title={t("editor.layout.selectPartTitle")}
          >
            {t("editor.layout.selectPart")}
          </button>
          <div
            style={{
              flex: "1 1 100%",
              paddingTop: 4,
            }}
          >
            <VideoExportButton
              project={project}
              durationSec={duration}
              fileName={fileName}
              compact={tightHeight}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { RefObject } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { TimelinePanelHandle } from "./timelinePanelTypes";
import type { StudentPick } from "./ChoreoStudentViewGate";
import {
  TransportIconPause,
  TransportIconPlay,
  TransportIconSkipBack,
  TransportIconSkipForward,
} from "./mobile/TransportIcons";
import { useI18n } from "../i18n/I18nContext";
import { formatMmSsFloor } from "../lib/timeFormat";
import { playbackEngine } from "../core/playbackEngine";
import { useShareViewAudioLoadStore } from "../store/shareViewAudioLoadStore";
import { useViewerChromeStore } from "../store/viewerChromeStore";
import { useViewerTransportActions } from "../hooks/useViewerTransportActions";
import { ViewerMemberModeSwitch } from "./ViewerMemberModeSwitch";
import { ChoreoViewerVideoSaveButton } from "./ChoreoViewerVideoSaveButton";
import { computeViewerCueNavState } from "../lib/viewerCueNavigation";
import { VIEWER_LEFT_RAIL_PX } from "../pages/editor/editorConstants";

export type ViewerChromeInsets = {
  topPx: number;
  bottomPx: number;
  leftPx: number;
};

type Props = {
  project: ChoreographyProjectJson;
  timelineRef: RefObject<TimelinePanelHandle | null>;
  choreoStudentPick: StudentPick;
  rosterMemberCount: number;
  selectedCueId: string | null | undefined;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  landscapeMode: boolean;
  fileName: string;
  onBeforeTransport?: () => void | Promise<void>;
  onOpenMemberSheet: () => void;
  onPickViewerAll: () => void;
  onPickViewerIndividual: () => void;
  onCuePrev: () => void;
  onCueNext: () => void;
  onInsetsChange?: (insets: ViewerChromeInsets) => void;
};

function ViewerTransportControls({
  showCueNav,
  cueNav,
  timeLabel,
  isPlaying,
  duration,
  playReadyGlow,
  onPlayPointerDown,
  togglePlay,
  seekBack,
  seekForward,
  onCuePrev,
  onCueNext,
}: {
  showCueNav: boolean;
  cueNav: ReturnType<typeof computeViewerCueNavState>;
  timeLabel: ReactNode;
  isPlaying: boolean;
  duration: number;
  playReadyGlow: boolean;
  onPlayPointerDown: () => void;
  togglePlay: () => void;
  seekBack: () => void;
  seekForward: () => void;
  onCuePrev: () => void;
  onCueNext: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="choreo-viewer-bars__transport-inner">
      <button
        type="button"
        className="choreo-viewer-bars__seek-btn"
        aria-label={t("editor.comp.k002")}
        title={t("editor.comp.k002")}
        disabled={duration <= 0}
        onClick={seekBack}
      >
        −5
      </button>
      {showCueNav ? (
        <>
          <button
            type="button"
            className="choreo-viewer-bars__cue-btn"
            aria-label={t("editor.layout.viewerCuePrev")}
            title={t("editor.layout.viewerCuePrev")}
            disabled={!cueNav.canPrev}
            onClick={onCuePrev}
          >
            <TransportIconSkipBack size={20} />
          </button>
          {timeLabel}
          <button
            type="button"
            className="choreo-viewer-bars__cue-btn"
            aria-label={t("editor.layout.viewerCueNext")}
            title={t("editor.layout.viewerCueNext")}
            disabled={!cueNav.canNext}
            onClick={onCueNext}
          >
            <TransportIconSkipForward size={20} />
          </button>
        </>
      ) : (
        timeLabel
      )}
      <button
        type="button"
        className="choreo-viewer-bars__seek-btn"
        aria-label={t("editor.comp.k003")}
        title={t("editor.comp.k003")}
        disabled={duration <= 0}
        onClick={seekForward}
      >
        +5
      </button>
      <button
        type="button"
        className={[
          "choreo-viewer-bars__play-btn",
          playReadyGlow && !isPlaying ? "choreo-viewer-play--ready" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
        title={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
        onPointerDown={onPlayPointerDown}
        onClick={togglePlay}
      >
        {isPlaying ? (
          <TransportIconPause size={24} />
        ) : (
          <TransportIconPlay size={24} />
        )}
      </button>
    </div>
  );
}

/** 生徒閲覧: 操作帯（縦=下部、横=左レール） */
export function ChoreoViewerControlBars({
  project,
  timelineRef,
  choreoStudentPick,
  rosterMemberCount,
  selectedCueId,
  isPlaying,
  currentTime,
  duration,
  landscapeMode,
  fileName,
  onBeforeTransport,
  onOpenMemberSheet,
  onPickViewerAll,
  onPickViewerIndividual,
  onCuePrev,
  onCueNext,
  onInsetsChange,
}: Props) {
  const { t } = useI18n();
  const trimStartSec = project.trimStartSec ?? 0;
  const trimEndSec = project.trimEndSec ?? null;
  const controlsVisible = useViewerChromeStore((s) => s.controlsVisible);
  const cuePagerVisible = useViewerChromeStore((s) => s.cuePagerVisible);

  const cueNav = useMemo(
    () => computeViewerCueNavState(project, selectedCueId),
    [project, selectedCueId]
  );

  const shareAudioPhase = useShareViewAudioLoadStore((s) => s.phase);
  const playReadyGlow =
    shareAudioPhase === "ready" &&
    !isPlaying &&
    Boolean(playbackEngine.getMediaSourceUrl());

  const { onPlayPointerDown, togglePlay, seekBack, seekForward } =
    useViewerTransportActions({
      project,
      timelineRef,
      trimStartSec,
      trimEndSec,
      duration,
      onBeforeTransport,
    });

  const showTransport = controlsVisible;
  const showCueNav = showTransport && cuePagerVisible && cueNav.cueCount > 0;

  const chromeRef = useRef<HTMLElement | null>(null);

  const reportInsets = useCallback(() => {
    const el = chromeRef.current;
    if (!el) {
      onInsetsChange?.({ topPx: 0, bottomPx: 0, leftPx: 0 });
      return;
    }
    const rect = el.getBoundingClientRect();
    if (landscapeMode) {
      onInsetsChange?.({
        topPx: 0,
        bottomPx: 0,
        leftPx: Math.ceil(rect.width),
      });
      return;
    }
    onInsetsChange?.({
      topPx: 0,
      bottomPx: Math.ceil(rect.height),
      leftPx: 0,
    });
  }, [landscapeMode, onInsetsChange]);

  useEffect(() => {
    const el = chromeRef.current;
    if (!el) {
      onInsetsChange?.({ topPx: 0, bottomPx: 0, leftPx: 0 });
      return;
    }
    reportInsets();
    const observer = new ResizeObserver(() => reportInsets());
    observer.observe(el);
    return () => observer.disconnect();
  }, [reportInsets, onInsetsChange, landscapeMode, showTransport, rosterMemberCount]);

  const timeLabel = (
    <span
      className="choreo-viewer-bars__time"
      aria-live="polite"
      aria-label={`${formatMmSsFloor(currentTime)} / ${formatMmSsFloor(duration)}`}
    >
      {formatMmSsFloor(currentTime)}
      <span className="choreo-viewer-timeSep">/</span>
      {formatMmSsFloor(duration)}
    </span>
  );

  const transportControls = showTransport ? (
    <ViewerTransportControls
      showCueNav={showCueNav}
      cueNav={cueNav}
      timeLabel={timeLabel}
      isPlaying={isPlaying}
      duration={duration}
      playReadyGlow={playReadyGlow}
      onPlayPointerDown={onPlayPointerDown}
      togglePlay={togglePlay}
      seekBack={seekBack}
      seekForward={seekForward}
      onCuePrev={onCuePrev}
      onCueNext={onCueNext}
    />
  ) : null;

  const modeSwitch =
    rosterMemberCount > 0 ? (
      <ViewerMemberModeSwitch
        pick={choreoStudentPick}
        memberCount={rosterMemberCount}
        layout={landscapeMode ? "stack" : "inline"}
        compact={!landscapeMode}
        onPickAll={onPickViewerAll}
        onPickIndividual={onPickViewerIndividual}
        onOpenMemberPicker={onOpenMemberSheet}
      />
    ) : null;

  const videoSave = (
    <ChoreoViewerVideoSaveButton
      project={project}
      durationSec={duration}
      fileName={fileName}
    />
  );

  if (landscapeMode) {
    return (
      <aside
        ref={chromeRef}
        className="choreo-viewer-bars choreo-viewer-bars--landscape"
        style={{ ["--choreo-viewer-left-rail-w" as string]: `${VIEWER_LEFT_RAIL_PX}px` }}
        aria-label={t("editor.layout.viewerControlBarsAria")}
      >
        <div className="choreo-viewer-bars__left-stack">
          {modeSwitch}
          {videoSave}
          {transportControls ? (
            <div className="choreo-viewer-bars__left-transport">
              {transportControls}
            </div>
          ) : null}
        </div>
      </aside>
    );
  }

  if (!showTransport && !modeSwitch) {
    return (
      <footer
        ref={chromeRef}
        className="choreo-viewer-bars choreo-viewer-bars--portrait"
        aria-label={t("editor.layout.viewerControlBarsAria")}
      >
        <div className="choreo-viewer-bars__bottom-panel">
          <div className="choreo-viewer-bars__bottom-meta">{videoSave}</div>
        </div>
      </footer>
    );
  }

  return (
    <footer
      ref={chromeRef}
      className="choreo-viewer-bars choreo-viewer-bars--portrait"
      aria-label={t("editor.layout.viewerControlBarsAria")}
    >
      <div className="choreo-viewer-bars__bottom-panel">
        {modeSwitch || videoSave ? (
          <div className="choreo-viewer-bars__bottom-meta">
            {modeSwitch}
            {videoSave}
          </div>
        ) : null}
        {transportControls}
      </div>
    </footer>
  );
}

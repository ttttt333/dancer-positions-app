import { useEffect, useMemo, type ReactNode } from "react";
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
  onBeforeTransport?: () => void | Promise<void>;
  onOpenMemberSheet: () => void;
  onPickViewerAll: () => void;
  onPickViewerIndividual: () => void;
  onCuePrev: () => void;
  onCueNext: () => void;
  onInsetsChange?: (insets: ViewerChromeInsets) => void;
};

function ViewerTopBarExtras() {
  const { t } = useI18n();
  const detailsVisible = useViewerChromeStore((s) => s.detailsVisible);
  const toggleDetails = useViewerChromeStore((s) => s.toggleDetails);
  const enterStageOnly = useViewerChromeStore((s) => s.enterStageOnly);

  return (
    <div className="choreo-viewer-bars__top-extras">
      <button
        type="button"
        className={[
          "choreo-viewer-bars__mini-btn",
          detailsVisible ? "choreo-viewer-bars__mini-btn--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={detailsVisible}
        title={t("editor.layout.viewerChromeDetailsToggle")}
        onClick={toggleDetails}
      >
        {t("editor.layout.viewerChromeDetailsShort")}
      </button>
      <button
        type="button"
        className="choreo-viewer-bars__mini-btn"
        title={t("editor.layout.viewerChromeCollapse")}
        onClick={enterStageOnly}
      >
        {t("editor.layout.viewerChromeStageShort")}
      </button>
    </div>
  );
}

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

/** 生徒閲覧: ステージ全面の上に浮かせる操作帯 */
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
  const stageOnly = useViewerChromeStore((s) => s.stageOnly);
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

  const showTopBar = !stageOnly;
  const showTransport = !stageOnly && controlsVisible;
  const showCueNav = showTransport && cuePagerVisible && cueNav.cueCount > 0;

  useEffect(() => {
    onInsetsChange?.({ topPx: 0, bottomPx: 0, leftPx: 0 });
  }, [onInsetsChange]);

  if (stageOnly) return null;

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

  const modeSwitch = (
    <ViewerMemberModeSwitch
      pick={choreoStudentPick}
      memberCount={rosterMemberCount}
      layout={landscapeMode ? "stack" : "inline"}
      onPickAll={onPickViewerAll}
      onPickIndividual={onPickViewerIndividual}
      onOpenMemberPicker={onOpenMemberSheet}
    />
  );

  if (landscapeMode) {
    return (
      <aside
        className="choreo-viewer-bars choreo-viewer-bars--landscape"
        style={{ ["--choreo-viewer-left-rail-w" as string]: `${VIEWER_LEFT_RAIL_PX}px` }}
        aria-label={t("editor.layout.viewerControlBarsAria")}
      >
        {showTopBar ? (
          <div className="choreo-viewer-bars__left-mode">
            {modeSwitch}
            <ViewerTopBarExtras />
          </div>
        ) : null}
        {transportControls ? (
          <div className="choreo-viewer-bars__left-transport">{transportControls}</div>
        ) : null}
      </aside>
    );
  }

  return (
    <div
      className="choreo-viewer-bars choreo-viewer-bars--portrait"
      aria-label={t("editor.layout.viewerControlBarsAria")}
    >
      {showTopBar ? (
        <header className="choreo-viewer-bars__top">
          {modeSwitch}
          <ViewerTopBarExtras />
        </header>
      ) : null}
      {transportControls ? (
        <footer className="choreo-viewer-bars__bottom">{transportControls}</footer>
      ) : null}
    </div>
  );
}

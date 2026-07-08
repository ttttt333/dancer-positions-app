import { useEffect, useMemo } from "react";
import type { RefObject } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { TimelinePanelHandle } from "./timelinePanelTypes";
import type { StudentPick } from "./ChoreoStudentViewGate";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import {
  TransportIconPause,
  TransportIconPlay,
  TransportIconSkipBack,
  TransportIconSkipForward,
} from "./mobile/TransportIcons";
import { useI18n } from "../i18n/I18nContext";
import { playbackEngine } from "../core/playbackEngine";
import { useShareViewAudioLoadStore } from "../store/shareViewAudioLoadStore";
import { useViewerChromeStore } from "../store/viewerChromeStore";
import { useViewerTransportActions } from "../hooks/useViewerTransportActions";
import { ViewerMemberModeSwitch } from "./ViewerMemberModeSwitch";
import { computeViewerCueNavState } from "../lib/viewerCueNavigation";
import {
  VIEWER_LEFT_RAIL_PX,
  VIEWER_TOP_BAR_PX,
  VIEWER_TRANSPORT_BAR_PX,
} from "../pages/editor/editorConstants";

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

/** 生徒閲覧: 固定帯（上部=全体/個人、下部=キュー送り+再生） */
export function ChoreoViewerControlBars({
  project,
  timelineRef,
  choreoStudentPick,
  rosterMemberCount,
  selectedCueId,
  isPlaying,
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

  const { onPlayPointerDown, togglePlay } = useViewerTransportActions({
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

  const insets: ViewerChromeInsets = useMemo(() => {
    if (stageOnly) return { topPx: 0, bottomPx: 0, leftPx: 0 };
    if (landscapeMode) {
      const leftPx = VIEWER_LEFT_RAIL_PX;
      return {
        topPx: 0,
        bottomPx: 0,
        leftPx: showTransport || showTopBar ? leftPx : 0,
      };
    }
    return {
      topPx: showTopBar ? VIEWER_TOP_BAR_PX : 0,
      bottomPx: showTransport ? VIEWER_TRANSPORT_BAR_PX : 0,
      leftPx: 0,
    };
  }, [landscapeMode, showTopBar, showTransport, stageOnly]);

  useEffect(() => {
    onInsetsChange?.(insets);
  }, [insets, onInsetsChange]);

  if (stageOnly) return null;

  const cueBtnStyle = (enabled: boolean) => ({
    ...btnSecondary,
    minWidth: 56,
    minHeight: 56,
    padding: 0,
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: enabled ? 1 : 0.35,
    flexShrink: 0,
  });

  const transportRow = showTransport ? (
    <div className="choreo-viewer-bars__transport-inner">
      {showCueNav ? (
        <>
          <button
            type="button"
            className="choreo-viewer-bars__cue-btn"
            aria-label={t("editor.layout.viewerCuePrev")}
            title={t("editor.layout.viewerCuePrev")}
            disabled={!cueNav.canPrev}
            onClick={onCuePrev}
            style={cueBtnStyle(cueNav.canPrev)}
          >
            <TransportIconSkipBack size={24} />
          </button>
          <span
            className="choreo-viewer-bars__cue-label"
            aria-live="polite"
            aria-label={t("editor.layout.viewerCuePositionAria", {
              current: cueNav.displayIndex,
              total: cueNav.cueCount,
            })}
          >
            {t("editor.layout.viewerCuePosition", {
              current: cueNav.displayIndex,
              total: cueNav.cueCount,
            })}
          </span>
          <button
            type="button"
            className="choreo-viewer-bars__cue-btn"
            aria-label={t("editor.layout.viewerCueNext")}
            title={t("editor.layout.viewerCueNext")}
            disabled={!cueNav.canNext}
            onClick={onCueNext}
            style={cueBtnStyle(cueNav.canNext)}
          >
            <TransportIconSkipForward size={24} />
          </button>
        </>
      ) : null}
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
        style={{
          ...btnAccent,
          minWidth: 72,
          minHeight: 72,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isPlaying ? (
          <TransportIconPause size={28} />
        ) : (
          <TransportIconPlay size={28} />
        )}
      </button>
    </div>
  ) : null;

  if (landscapeMode) {
    return (
      <aside
        className="choreo-viewer-bars choreo-viewer-bars--landscape"
        aria-label={t("editor.layout.viewerControlBarsAria")}
      >
        {showTopBar ? (
          <div className="choreo-viewer-bars__left-mode">
            <ViewerMemberModeSwitch
              pick={choreoStudentPick}
              memberCount={rosterMemberCount}
              layout="stack"
              onPickAll={onPickViewerAll}
              onPickIndividual={onPickViewerIndividual}
              onOpenMemberPicker={onOpenMemberSheet}
            />
          </div>
        ) : null}
        {transportRow ? (
          <div className="choreo-viewer-bars__left-transport">{transportRow}</div>
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
          <ViewerMemberModeSwitch
            pick={choreoStudentPick}
            memberCount={rosterMemberCount}
            onPickAll={onPickViewerAll}
            onPickIndividual={onPickViewerIndividual}
            onOpenMemberPicker={onOpenMemberSheet}
          />
        </header>
      ) : null}
      {transportRow ? (
        <footer className="choreo-viewer-bars__bottom">{transportRow}</footer>
      ) : null}
    </div>
  );
}

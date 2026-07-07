import type { RefObject } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { TimelinePanelHandle } from "./timelinePanelTypes";
import type { StudentPick } from "./ChoreoStudentViewGate";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { formatMmSsFloor } from "../lib/timeFormat";
import {
  TransportIconPause,
  TransportIconPlay,
  TransportIconSkipBack,
  TransportIconSkipForward,
  TransportIconStop,
} from "./mobile/TransportIcons";
import { useI18n } from "../i18n/I18nContext";
import { playbackEngine } from "../core/playbackEngine";
import { useShareViewAudioLoadStore } from "../store/shareViewAudioLoadStore";
import { useViewerTransportActions } from "../hooks/useViewerTransportActions";
import { ViewerMemberModeSwitch } from "./ViewerMemberModeSwitch";

type Props = {
  project: ChoreographyProjectJson;
  timelineRef: RefObject<TimelinePanelHandle | null>;
  choreoStudentPick: StudentPick;
  rosterMemberCount: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onBeforeTransport?: () => void | Promise<void>;
  onOpenMemberSheet: () => void;
  onPickViewerAll: () => void;
  onPickViewerIndividual: () => void;
};

/** 閲覧共有: 舞台を覆わない浮遊コントロール（左右にシーク、中央下に再生） */
export function ChoreoViewerStageControls({
  project,
  timelineRef,
  choreoStudentPick,
  rosterMemberCount,
  isPlaying,
  currentTime,
  duration,
  onBeforeTransport,
  onOpenMemberSheet,
  onPickViewerAll,
  onPickViewerIndividual,
}: Props) {
  const { t } = useI18n();
  const trimStartSec = project.trimStartSec ?? 0;
  const trimEndSec = project.trimEndSec ?? null;
  const shareAudioPhase = useShareViewAudioLoadStore((s) => s.phase);
  const playReadyGlow =
    shareAudioPhase === "ready" &&
    !isPlaying &&
    Boolean(playbackEngine.getMediaSourceUrl());

  const { seekBack, seekForward, onPlayPointerDown, togglePlay, stopPlayback } =
    useViewerTransportActions({
      project,
      timelineRef,
      trimStartSec,
      trimEndSec,
      duration,
      onBeforeTransport,
    });

  const seekDisabled = duration <= 0;
  const pillBtn = {
    ...btnSecondary,
    minWidth: 44,
    minHeight: 44,
    padding: 0,
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexShrink: 0,
  };

  return (
    <div className="choreo-viewer-stage-controls" data-playing={isPlaying || undefined}>
      <div className="choreo-viewer-stage-controls__top">
        <ViewerMemberModeSwitch
          pick={choreoStudentPick}
          memberCount={rosterMemberCount}
          compact
          onPickAll={onPickViewerAll}
          onPickIndividual={onPickViewerIndividual}
          onOpenMemberPicker={onOpenMemberSheet}
        />
        <span
          className="choreo-viewer-stage-controls__time"
          aria-live="polite"
          aria-label={`${currentTime} / ${duration}`}
        >
          {formatMmSsFloor(currentTime)}
          <span className="choreo-viewer-timeSep">/</span>
          {formatMmSsFloor(duration)}
        </span>
      </div>

      <button
        type="button"
        className="choreo-viewer-seek-edge choreo-viewer-seek-edge--back"
        aria-label={t("editor.comp.k002")}
        title={t("editor.comp.k002")}
        disabled={seekDisabled}
        onClick={seekBack}
      >
        <TransportIconSkipBack size={22} />
      </button>
      <button
        type="button"
        className="choreo-viewer-seek-edge choreo-viewer-seek-edge--fwd"
        aria-label={t("editor.comp.k003")}
        title={t("editor.comp.k003")}
        disabled={seekDisabled}
        onClick={seekForward}
      >
        <TransportIconSkipForward size={22} />
      </button>

      <div className="choreo-viewer-transport-pill">
        <button
          type="button"
          aria-label={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
          title={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
          onPointerDown={onPlayPointerDown}
          onClick={togglePlay}
          className={
            playReadyGlow && !isPlaying ? "choreo-viewer-play--ready" : undefined
          }
          style={{
            ...btnAccent,
            minWidth: 48,
            minHeight: 48,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isPlaying ? (
            <TransportIconPause size={24} />
          ) : (
            <TransportIconPlay size={24} />
          )}
        </button>
        <button
          type="button"
          aria-label={t("editor.layout.stop")}
          title={t("editor.comp.k060")}
          onClick={stopPlayback}
          style={pillBtn}
        >
          <TransportIconStop size={20} />
        </button>
      </div>
    </div>
  );
}

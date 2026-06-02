import { useEffect, useState, type RefObject } from "react";
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

function viewerBarHeightPx(
  tight: boolean,
  metaExpanded: boolean,
  transportInBar: boolean
): number {
  if (tight && !transportInBar) {
    if (!metaExpanded) return 44;
    return 88;
  }
  if (!metaExpanded) return tight ? 54 : 58;
  return tight ? 96 : 104;
}

type TransportProps = {
  timelineRef: RefObject<TimelinePanelHandle | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  compact?: boolean;
};

export function ChoreoViewerTransportControls({
  timelineRef,
  isPlaying,
  currentTime,
  duration,
  compact = false,
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

  return (
    <>
      <button
        type="button"
        aria-label={t("editor.comp.k002")}
        title={t("editor.comp.k002")}
        onClick={() => timelineRef.current?.seekBackward5Sec()}
        disabled={duration <= 0}
        style={transportBtn}
      >
        <TransportIconSkipBack size={iconSecondary} />
      </button>
      <button
        type="button"
        aria-label={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
        title={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
        onClick={() => timelineRef.current?.togglePlay()}
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
        onClick={() => timelineRef.current?.stopPlayback()}
        style={transportBtn}
      >
        <TransportIconStop size={iconSecondary} />
      </button>
      <button
        type="button"
        aria-label={t("editor.comp.k003")}
        title={t("editor.comp.k003")}
        onClick={() => timelineRef.current?.seekForward5Sec()}
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

export type ChoreoViewerBottomBarProps = {
  timelineRef: RefObject<TimelinePanelHandle | null>;
  project: ChoreographyProjectJson;
  choreoStudentPick: StudentPick;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tightHeight: boolean;
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
  onOpenMemberSheet,
  onBarHeightChange,
  fileName,
}: ChoreoViewerBottomBarProps) {
  const { t } = useI18n();
  const [metaExpanded, setMetaExpanded] = useState(() => !tightHeight);

  useEffect(() => {
    setMetaExpanded(!tightHeight);
  }, [tightHeight]);

  const transportInBar = !tightHeight;
  const barHeightPx = viewerBarHeightPx(tightHeight, metaExpanded, transportInBar);

  useEffect(() => {
    onBarHeightChange?.(barHeightPx);
  }, [barHeightPx, onBarHeightChange]);

  const closeViewer = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.close();
  };

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
          <ChoreoViewerTransportControls
            timelineRef={timelineRef}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            compact={tightHeight}
          />
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
          onClick={closeViewer}
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
        >
          {t("editor.layout.close")}
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

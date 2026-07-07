/**
 * LandscapeBottomWaveBar.tsx
 * 横画面: 画面下部に波形・タイムラインのみ表示（操作は左パネル）
 */

import React from "react";
import styles from "./LandscapeBottomWaveBar.module.css";
import {
  PortraitWaveTransport,
  type PortraitWaveTransportHandle,
} from "./PortraitWaveTransport";
import { LANDSCAPE_WAVE_CANVAS_HEIGHT_PX } from "./landscapeWaveLayout";
import { abortTimelineWavePointerGestures } from "../../lib/abortTimelineWavePointerGestures";

interface Props {
  waveRef: React.RefObject<PortraitWaveTransportHandle | null>;
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (sec: number) => void;
  onCollapse: () => void;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export const LandscapeBottomWaveBar: React.FC<Props> = ({
  waveRef,
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onStop,
  onSeek,
  onCollapse,
}) => {
  return (
    <div className={styles.dock}>
      <div className={styles.dockChrome}>
        <span className={styles.dockTitle}>タイムライン</span>
        <span className={styles.dockTime} aria-live="polite">
          {fmtTime(currentTime)}
          <span className={styles.dockTimeSep}>/</span>
          {fmtTime(duration)}
        </span>
        <button
          type="button"
          className={styles.collapseBtn}
          onPointerDown={(e) => {
            e.stopPropagation();
            abortTimelineWavePointerGestures();
          }}
          onClick={(e) => {
            e.stopPropagation();
            abortTimelineWavePointerGestures();
            onCollapse();
          }}
          aria-label="波形をたたむ"
          title="波形をたたむ"
        >
          <span className={styles.collapseChevron} aria-hidden>
            ▼
          </span>
          <span className={styles.collapseLabel}>たたむ</span>
        </button>
      </div>
      <PortraitWaveTransport
        ref={waveRef}
        audioUrl={audioUrl}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={onPlayPause}
        onStop={onStop}
        onSeek={onSeek}
        showTransportControls={false}
        waveHeightPx={LANDSCAPE_WAVE_CANVAS_HEIGHT_PX}
        compactLandscape
        hideRulerCollapseButton
      />
    </div>
  );
};

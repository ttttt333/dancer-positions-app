/**
 * LandscapeBottomWaveBar.tsx
 * 横画面: 展開時のみ画面下部に波形編集 UI を表示
 */

import React from "react";
import styles from "./LandscapeBottomWaveBar.module.css";
import { PortraitWaveTransport } from "./PortraitWaveTransport";
import { LANDSCAPE_WAVE_CANVAS_HEIGHT_PX } from "./landscapeWaveLayout";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

interface Props {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (sec: number) => void;
  onCollapse: () => void;
}

export const LandscapeBottomWaveBar: React.FC<Props> = ({
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
      <button
        type="button"
        className={styles.toggleRow}
        onClick={onCollapse}
        aria-expanded
        aria-label="波形を畳んで左メニューに移す"
      >
        <span className={styles.toggleChevron} aria-hidden>
          ▼
        </span>
        <span className={styles.toggleLabel}>波形</span>
        <span className={styles.toggleTime}>
          {fmt(currentTime)}
          <span className={styles.timeSep}>/</span>
          {fmt(duration)}
        </span>
      </button>
      <div className={styles.waveBody}>
        <PortraitWaveTransport
          audioUrl={audioUrl}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={onPlayPause}
          onStop={onStop}
          onSeek={onSeek}
          showTransportControls={false}
          waveHeightPx={LANDSCAPE_WAVE_CANVAS_HEIGHT_PX}
        />
      </div>
    </div>
  );
};

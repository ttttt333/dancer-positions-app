/**
 * LandscapeBottomWaveBar.tsx
 * 横画面: 画面下部に縦画面と同じ波形編集 UI（畳み込み可能）
 */

import React, { useState, useCallback } from "react";
import styles from "./LandscapeBottomWaveBar.module.css";
import { PortraitWaveTransport } from "./PortraitWaveTransport";

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
}

export const LandscapeBottomWaveBar: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onStop,
  onSeek,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => !v);
  }, []);

  return (
    <div className={styles.dock} data-collapsed={collapsed ? "true" : "false"}>
      <button
        type="button"
        className={styles.toggleRow}
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "波形を展開" : "波形を畳む"}
      >
        <span className={styles.toggleChevron} aria-hidden>
          {collapsed ? "▲" : "▼"}
        </span>
        <span className={styles.toggleLabel}>波形</span>
        {collapsed && duration > 0 ? (
          <div className={styles.miniTrack} aria-hidden>
            <div className={styles.miniFill} style={{ width: `${pct}%` }} />
            <div className={styles.miniPlayhead} style={{ left: `${pct}%` }} />
          </div>
        ) : null}
        <span className={styles.toggleTime}>
          {fmt(currentTime)}
          <span style={{ color: "#4b5563", margin: "0 3px" }}>/</span>
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
          waveHeightPx={80}
        />
      </div>
    </div>
  );
};

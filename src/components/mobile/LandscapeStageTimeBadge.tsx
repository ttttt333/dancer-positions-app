/**
 * LandscapeStageTimeBadge.tsx
 * 横画面: ステージ右端外側に再生時刻を小さく表示
 */

import React from "react";
import styles from "./LandscapeStageTimeBadge.module.css";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

interface Props {
  currentTime: number;
  duration: number;
}

export const LandscapeStageTimeBadge: React.FC<Props> = ({ currentTime, duration }) => {
  return (
    <div className={styles.badge} aria-live="polite" aria-label={`再生位置 ${fmt(currentTime)} / ${fmt(duration)}`}>
      <span className={styles.current}>{fmt(currentTime)}</span>
      <span className={styles.sep}>/</span>
      <span className={styles.duration}>{fmt(duration)}</span>
    </div>
  );
};

/**
 * PortraitWaveTransport.tsx
 * 縦向き下部用: 再生コントロール + 波形（タップでシーク / キュー選択 / ダブルタップでキュー追加）
 */

import React, { useRef, useCallback, useState, useEffect } from "react";
import styles from "./PortraitWaveTransport.module.css";
import { useMobileShellBridgeStore } from "../../store/useMobileShellBridgeStore";

const NUM_BARS = 48;
const CUE_HIT_SEC = 1.5;

const FALLBACK_HEIGHTS: number[] = [
  20, 35, 15, 45, 30, 50, 25, 40, 18, 42, 32, 48, 22, 38, 28, 52,
  20, 36, 24, 44, 30, 46, 18, 40, 26, 48, 22, 34, 28, 50, 20, 38,
  24, 42, 30, 46, 18, 36, 26, 44, 22, 48, 20, 40, 28, 50, 24, 38,
];

interface Props {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (sec: number) => void;
  onAddCue?: () => void;
  cueStartTimes?: number[];
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

async function computeWavePeaks(url: string, numBars: number): Promise<number[]> {
  const res = await fetch(url, { mode: "cors" });
  const buf = await res.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(buf);
  ctx.close();

  const ch = decoded.getChannelData(0);
  const blockSize = Math.floor(ch.length / numBars);
  const peaks: number[] = [];
  for (let i = 0; i < numBars; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += ch[i * blockSize + j] ** 2;
    }
    peaks.push(Math.sqrt(sum / blockSize));
  }
  const max = Math.max(...peaks, 0.001);
  return peaks.map((p) => Math.max(4, (p / max) * 52));
}

function nearestCueTime(tSec: number, cueStartTimes: number[]): number | null {
  if (cueStartTimes.length === 0) return null;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const t of cueStartTimes) {
    const d = Math.abs(t - tSec);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return bestDist <= CUE_HIT_SEC ? best : null;
}

export const PortraitWaveTransport: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onAddCue,
  cueStartTimes = [],
}) => {
  const onSelectCueNearTime = useMobileShellBridgeStore((s) => s.onSelectCueNearTime);
  const [wavePeaks, setWavePeaks] = useState<number[]>(FALLBACK_HEIGHTS);
  const progressRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const playedBars = Math.floor((currentTime / Math.max(duration, 1)) * wavePeaks.length);
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    if (!audioUrl) {
      setWavePeaks(FALLBACK_HEIGHTS);
      return;
    }
    let cancelled = false;
    computeWavePeaks(audioUrl, NUM_BARS)
      .then((peaks) => {
        if (!cancelled) setWavePeaks(peaks);
      })
      .catch(() => {
        if (!cancelled) setWavePeaks(FALLBACK_HEIGHTS);
      });
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  const timeFromClientX = useCallback(
    (clientX: number): number | null => {
      if (!progressRef.current || duration === 0) return null;
      const r = progressRef.current.getBoundingClientRect();
      return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
    },
    [duration]
  );

  const handleWaveTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const clientX =
        "touches" in e
          ? ((e as React.TouchEvent).changedTouches[0]?.clientX ?? 0)
          : (e as React.MouseEvent).clientX;
      const tSec = timeFromClientX(clientX);
      if (tSec == null) return;

      const now = Date.now();
      if (now - lastTapRef.current < 350) {
        onSeek(tSec);
        onAddCue?.();
        lastTapRef.current = 0;
        return;
      }

      const nearCue = nearestCueTime(tSec, cueStartTimes);
      if (nearCue != null) {
        onSelectCueNearTime(nearCue);
      } else {
        onSeek(tSec);
      }
      lastTapRef.current = now;
    },
    [timeFromClientX, onSeek, onAddCue, cueStartTimes, onSelectCueNearTime]
  );

  const handleStop = useCallback(() => {
    onSeek(0);
    if (isPlaying) onPlayPause();
  }, [isPlaying, onPlayPause, onSeek]);

  const handleSkipBack = useCallback(() => {
    onSeek(Math.max(0, currentTime - 5));
  }, [currentTime, onSeek]);

  const handleSkipForward = useCallback(() => {
    onSeek(Math.min(duration, currentTime + 5));
  }, [currentTime, duration, onSeek]);

  return (
    <div className={styles.transport}>
      <div className={styles.row}>
        <div className={styles.controls}>
          <button
            className={styles.ctrlBtn}
            onClick={handleSkipBack}
            disabled={!audioUrl}
            aria-label="5秒戻す"
          >
            <span className={styles.skipIcon}>↺</span>
            <span className={styles.skipSec}>5</span>
          </button>
          <button
            className={styles.ctrlBtn}
            onClick={handleSkipForward}
            disabled={!audioUrl}
            aria-label="5秒進める"
          >
            <span className={styles.skipIcon}>↻</span>
            <span className={styles.skipSec}>5</span>
          </button>
          <button
            className={styles.playBtn}
            onClick={onPlayPause}
            disabled={!audioUrl}
            aria-label={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className={styles.ctrlBtn}
            onClick={handleStop}
            disabled={!audioUrl}
            aria-label="停止して先頭へ"
          >
            ⏹
          </button>
        </div>
        <span className={styles.timeText}>
          {fmt(currentTime)}
          <span className={styles.timeSep}>/</span>
          {fmt(duration)}
        </span>
      </div>

      <div
        ref={progressRef}
        className={styles.waveform}
        onClick={handleWaveTap}
        onTouchEnd={handleWaveTap}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-label="再生位置（タップで移動・キュー付近で選択・ダブルタップでキュー追加）"
      >
        {wavePeaks.map((h, i) => (
          <div
            key={i}
            className={styles.bar}
            style={{
              height: Math.min(h, 32),
              background: i < playedBars ? "#d97706" : "rgba(217,119,6,0.18)",
            }}
          />
        ))}
        <div className={styles.playhead} style={{ left: `${pct}%` }} />
        {duration > 0 &&
          cueStartTimes.map((t, idx) => (
            <div
              key={idx}
              className={styles.cueMarker}
              style={{ left: `${(t / duration) * 100}%` }}
              aria-hidden
            />
          ))}
      </div>
    </div>
  );
};

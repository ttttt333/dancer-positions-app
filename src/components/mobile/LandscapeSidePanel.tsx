/**
 * LandscapeSidePanel.tsx
 * 横向き専用の右サイドパネル（理想レイアウト版）
 * 再生コントロール行 + キューナビ + アクションボタン
 * 波形はこのパネル内に集約（上部には表示しない）
 */

import React, { useState, useRef, useCallback } from 'react'
import styles from './LandscapeSidePanel.module.css'

// ── 波形バーの高さデータ (固定値) ──
const WAVE_HEIGHTS = [
  20,35,15,45,30,50,25,40,18,42,32,48,22,38,28,52,
  20,36,24,44,30,46,18,40,26,48,22,34,28,50,20,38,
]

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlayPause: () => void
  onSeek?: (sec: number) => void
  currentCueIndex: number
  totalCues: number
  onCuePrev: () => void
  onCueNext: () => void
  onAddCue: () => void
  onStageSettings: () => void
  onViewerList: () => void
}

export const LandscapeSidePanel: React.FC<Props> = ({
  isPlaying, currentTime, duration, onPlayPause, onSeek,
  currentCueIndex, totalCues, onCuePrev, onCueNext,
  onAddCue, onStageSettings, onViewerList,
}) => {
  const [open, setOpen] = useState(true)
  const waveRef = useRef<HTMLDivElement>(null)
  const playedBars = Math.floor((currentTime / Math.max(duration, 1)) * WAVE_HEIGHTS.length)
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleWaveClick = useCallback((e: React.MouseEvent) => {
    if (!waveRef.current || !onSeek || duration === 0) return
    const r = waveRef.current.getBoundingClientRect()
    onSeek(((e.clientX - r.left) / r.width) * duration)
  }, [duration, onSeek])

  if (!open) {
    return (
      <div className={styles.collapsed}>
        <button className={styles.collapseBtn} onClick={() => setOpen(true)} aria-label="パネルを開く">
          ‹
        </button>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/* ── 閉じるボタン ── */}
      <div className={styles.panelTop}>
        <button className={styles.collapseBtn} onClick={() => setOpen(false)} aria-label="パネルを閉じる">
          ›
        </button>
      </div>

      {/* ── 再生コントロール (1行) ── */}
      <div className={styles.playerRow}>
        <button
          className={styles.btnPlay}
          onClick={onPlayPause}
          aria-label={isPlaying ? '一時停止' : '再生'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span className={styles.timeText}>{fmt(currentTime)}</span>
        <span className={styles.timeSep}>/</span>
        <span className={styles.timeDur}>{fmt(duration)}</span>
      </div>

      {/* ── 波形バー (タップでシーク) ── */}
      <div
        ref={waveRef}
        className={styles.waveform}
        onClick={handleWaveClick}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-label="再生位置"
      >
        {WAVE_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className={styles.waveBar}
            style={{
              height: Math.min(h * 0.55, 16),
              background: i < playedBars ? '#d97706' : 'rgba(217,119,6,0.2)',
            }}
          />
        ))}
        {/* プログレスライン */}
        <div
          className={styles.wavePlayhead}
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className={styles.divider} />

      {/* ── キューナビ ── */}
      <div className={styles.cueSection}>
        <p className={styles.cueMetaLabel}>Cue Navigation</p>
        <p className={styles.cueValue}>
          ({currentCueIndex + 1} / {totalCues})
        </p>
        <div className={styles.cueArrows}>
          <button
            className={styles.btnMd}
            onClick={onCuePrev}
            disabled={currentCueIndex === 0}
            aria-label="前のキュー"
          >‹</button>
          <button
            className={styles.btnMd}
            onClick={onCueNext}
            disabled={currentCueIndex >= totalCues - 1}
            aria-label="次のキュー"
          >›</button>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── アクションボタン ── */}
      <button className={styles.viewerBtn} onClick={onViewerList}>
        Viewer List
      </button>
      <button className={styles.goldBtn} onClick={onAddCue}>
        + Next Cue
      </button>
      <button className={styles.darkBtn} onClick={onStageSettings}>
        Stage Settings
      </button>
    </div>
  )
}

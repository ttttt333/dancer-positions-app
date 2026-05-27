/**
 * PortraitHeader.tsx
 * 縦向き専用の音声プレイヤー + 波形バー
 *
 * ▶ Geminiコードからの修正点:
 *   - react-responsive 不使用 (useOrientation に統一)
 *   - 波形バーのデータを外部定数で管理 (コンポーネント内 Math.random() を排除)
 *   - safe-area を CSS env() で直接指定
 */

import React, { useRef, useCallback, useState } from 'react'
import styles from './PortraitHeader.module.css'

// ── 波形バーの高さデータ (固定値: renderごとに変わらない) ──
const WAVE_HEIGHTS = [
  20,35,15,45,30,50,25,40,18,42,32,48,22,38,28,52,
  20,36,24,44,30,46,18,40,26,48,22,34,28,50,20,38,
  24,42,30,46,18,36,26,44,22,48,20,40,28,50,24,38,18,42,
]

interface Props {
  audioUrl: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlayPause: () => void
  onSeek: (sec: number) => void
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export const PortraitHeader: React.FC<Props> = ({
  audioUrl, isPlaying, currentTime, duration, onPlayPause, onSeek,
}) => {
  const [showWave, setShowWave] = useState(true)
  const progressRef = useRef<HTMLDivElement>(null)
  const playedBars = Math.floor((currentTime / Math.max(duration, 1)) * WAVE_HEIGHTS.length)

  const handleWaveClick = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || duration === 0) return
    const r = progressRef.current.getBoundingClientRect()
    onSeek(((e.clientX - r.left) / r.width) * duration)
  }, [duration, onSeek])

  return (
    <div className={styles.header}>
      <div className={styles.row}>
        {/* 再生ボタン */}
        <button
          className={styles.playBtn}
          onClick={onPlayPause}
          disabled={!audioUrl}
          aria-label={isPlaying ? '一時停止' : '再生'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* タイム表示 */}
        <div className={styles.timePill}>
          <span className={styles.timeText}>{fmt(currentTime)} / {fmt(duration)}</span>
        </div>

        {/* 波形トグル */}
        <div className={styles.waveToggleArea}>
          <span className={styles.waveLabel}>Waveform</span>
          <button
            className={styles.toggle}
            data-on={showWave}
            onClick={() => setShowWave(v => !v)}
            aria-label="波形の表示切り替え"
          >
            <span className={styles.toggleThumb} data-on={showWave} />
          </button>
        </div>
      </div>

      {/* 波形バー (タップでシーク) */}
      {showWave && (
        <div
          ref={progressRef}
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
              className={styles.bar}
              style={{
                height: Math.min(h, 28),
                background: i < playedBars ? '#d97706' : 'rgba(217,119,6,0.18)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

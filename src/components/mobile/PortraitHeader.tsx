/**
 * PortraitHeader.tsx
 * 縦向き専用の音声プレイヤー + 波形バー
 *
 * - audioUrl が変わると Web Audio API で実際の波形を計算
 * - コントロール: 先頭戻し / -5s / 再生 / +5s
 * - タイム表示は右寄せ
 */

import React, { useRef, useCallback, useState, useEffect } from 'react'
import styles from './PortraitHeader.module.css'

const NUM_BARS = 48

// フォールバック用固定値
const FALLBACK_HEIGHTS: number[] = [
  20,35,15,45,30,50,25,40,18,42,32,48,22,38,28,52,
  20,36,24,44,30,46,18,40,26,48,22,34,28,50,20,38,
  24,42,30,46,18,36,26,44,22,48,20,40,28,50,24,38,
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

/** AudioContext で URL をデコードして RMS ピーク配列を返す */
async function computeWavePeaks(url: string, numBars: number): Promise<number[]> {
  const res = await fetch(url, { mode: 'cors' })
  const buf = await res.arrayBuffer()
  const ctx = new AudioContext()
  const decoded = await ctx.decodeAudioData(buf)
  ctx.close()

  const ch = decoded.getChannelData(0)
  const blockSize = Math.floor(ch.length / numBars)
  const peaks: number[] = []
  for (let i = 0; i < numBars; i++) {
    let sum = 0
    for (let j = 0; j < blockSize; j++) {
      sum += ch[i * blockSize + j] ** 2
    }
    peaks.push(Math.sqrt(sum / blockSize))
  }
  const max = Math.max(...peaks, 0.001)
  return peaks.map(p => Math.max(4, (p / max) * 52))
}

export const PortraitHeader: React.FC<Props> = ({
  audioUrl, isPlaying, currentTime, duration, onPlayPause, onSeek,
}) => {
  const [showWave, setShowWave] = useState(true)
  const [wavePeaks, setWavePeaks] = useState<number[]>(FALLBACK_HEIGHTS)
  const progressRef = useRef<HTMLDivElement>(null)
  const playedBars = Math.floor((currentTime / Math.max(duration, 1)) * wavePeaks.length)

  // ── 音源が変わったら実際の波形を計算 ──
  useEffect(() => {
    if (!audioUrl) {
      setWavePeaks(FALLBACK_HEIGHTS)
      return
    }
    let cancelled = false
    computeWavePeaks(audioUrl, NUM_BARS)
      .then(peaks => { if (!cancelled) setWavePeaks(peaks) })
      .catch(() => { if (!cancelled) setWavePeaks(FALLBACK_HEIGHTS) })
    return () => { cancelled = true }
  }, [audioUrl])

  const handleWaveClick = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || duration === 0) return
    const r = progressRef.current.getBoundingClientRect()
    onSeek(((e.clientX - r.left) / r.width) * duration)
  }, [duration, onSeek])

  const handleStop = useCallback(() => {
    onSeek(0)
    if (isPlaying) onPlayPause()
  }, [isPlaying, onPlayPause, onSeek])

  const handleSkipBack = useCallback(() => {
    onSeek(Math.max(0, currentTime - 5))
  }, [currentTime, onSeek])

  const handleSkipForward = useCallback(() => {
    onSeek(Math.min(duration, currentTime + 5))
  }, [currentTime, duration, onSeek])

  return (
    <div className={styles.header}>
      <div className={styles.row}>
        {/* ── 左: 操作ボタン群 ── */}
        <div className={styles.controls}>
          {/* 停止して先頭へ */}
          <button
            className={styles.ctrlBtn}
            onClick={handleStop}
            disabled={!audioUrl}
            aria-label="停止して先頭へ"
          >⏹</button>

          {/* -5秒 */}
          <button
            className={styles.ctrlBtn}
            onClick={handleSkipBack}
            disabled={!audioUrl}
            aria-label="5秒戻す"
          >
            <span className={styles.skipIcon}>↺</span>
            <span className={styles.skipSec}>5</span>
          </button>

          {/* 再生 / 一時停止 */}
          <button
            className={styles.playBtn}
            onClick={onPlayPause}
            disabled={!audioUrl}
            aria-label={isPlaying ? '一時停止' : '再生'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* +5秒 */}
          <button
            className={styles.ctrlBtn}
            onClick={handleSkipForward}
            disabled={!audioUrl}
            aria-label="5秒進める"
          >
            <span className={styles.skipIcon}>↻</span>
            <span className={styles.skipSec}>5</span>
          </button>
        </div>

        {/* ── 右: タイム表示 + 波形トグル ── */}
        <div className={styles.rightArea}>
          <span className={styles.timeText}>
            {fmt(currentTime)}<span className={styles.timeSep}>/</span>{fmt(duration)}
          </span>
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

      {/* ── 波形バー (タップでシーク) ── */}
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
          {wavePeaks.map((h, i) => (
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

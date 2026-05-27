/**
 * LandscapeSidePanel.tsx
 * 横向き専用の右サイドパネル
 * コンパクトプレイヤー + キューナビ + アクションボタン
 *
 * ▶ Geminiコードからの修正点:
 *   - 横向きでもヘッダー (PortraitHeader) を残していたバグを修正
 *     → このパネルにプレイヤーを内包し、外側のヘッダーは表示しない
 *   - safe-right を env(safe-area-inset-right) で直接対応
 *   - パネル開閉機能を追加
 */

import React, { useState } from 'react'
import styles from './LandscapeSidePanel.module.css'

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlayPause: () => void
  currentCueIndex: number
  totalCues: number
  onCuePrev: () => void
  onCueNext: () => void
  onAddCue: () => void
  onStageSettings: () => void
  onViewerList: () => void
}

export const LandscapeSidePanel: React.FC<Props> = ({
  isPlaying, currentTime, duration, onPlayPause,
  currentCueIndex, totalCues, onCuePrev, onCueNext,
  onAddCue, onStageSettings, onViewerList,
}) => {
  const [open, setOpen] = useState(true)

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
      {/* 閉じるボタン */}
      <div className={styles.panelTop}>
        <button className={styles.collapseBtn} onClick={() => setOpen(false)} aria-label="パネルを閉じる">
          ›
        </button>
      </div>

      {/* コンパクトプレイヤー */}
      <div className={styles.playerBox}>
        <div className={styles.playerMeta}>
          <span className={styles.metaLabel}>Player</span>
          <span className={styles.metaTime}>{fmt(currentTime)} / {fmt(duration)}</span>
        </div>
        <div className={styles.playerControls}>
          <button className={styles.btnSm} aria-label="巻き戻し">⏮</button>
          <button
            className={styles.btnPlay}
            onClick={onPlayPause}
            aria-label={isPlaying ? '一時停止' : '再生'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className={styles.btnSm} aria-label="早送り">⏭</button>
        </div>
      </div>

      {/* キューナビ */}
      <div className={styles.cueSection}>
        <p className={styles.cueMetaLabel}>Cue Navigation</p>
        <p className={styles.cueValue}>
          Cue {currentCueIndex + 1} / {totalCues}
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

      {/* アクション */}
      <button className={styles.viewerBtn} onClick={onViewerList}>
        Viewer List
      </button>
      <button className={styles.goldBtn} onClick={onAddCue}>
        ＋ Next Cue
      </button>
      <button className={styles.darkBtn} onClick={onStageSettings}>
        Stage Settings
      </button>
    </div>
  )
}

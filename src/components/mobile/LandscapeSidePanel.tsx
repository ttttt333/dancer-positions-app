/**
 * LandscapeSidePanel.tsx
 * 横向き専用の左サイドパネル
 * 再生コントロール行 + キューナビ + Menuボタン + Undo/Redo
 */

import React, { useState, useCallback } from 'react'
import styles from './LandscapeSidePanel.module.css'
import ctrlStyles from './TransportControls.module.css'
import { TransportIconPause, TransportIconPlay, TransportIconStop } from './TransportIcons'
import { useMobileShellBridgeStore } from '../../store/useMobileShellBridgeStore'

interface MenuItem {
  label: string
  icon: string
  action: () => void
}

interface MenuSection {
  title: string
  icon: string
  items: MenuItem[]
}

interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlayPause: () => void
  onStop: () => void
  onSeek?: (sec: number) => void
  currentCueIndex: number
  totalCues: number
  onCuePrev: () => void
  onCueNext: () => void
  onAddCue: () => void
  onStageSettings: () => void
  onViewerList: () => void
  onUndo?: () => void
  onRedo?: () => void
  undoDisabled?: boolean
  redoDisabled?: boolean
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export const LandscapeSidePanel: React.FC<Props> = ({
  isPlaying, currentTime, duration, onPlayPause, onStop,
  currentCueIndex, totalCues, onCuePrev, onCueNext,
  onAddCue, onStageSettings, onViewerList,
  onUndo, onRedo, undoDisabled, redoDisabled,
}) => {
  const [open, setOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const stageView = useMobileShellBridgeStore((s) => s.stageView)
  const onStageViewChange = useMobileShellBridgeStore((s) => s.onStageViewChange)
  const onSaveSpot    = useMobileShellBridgeStore((s) => s.onSaveSpot)
  const onAddText     = useMobileShellBridgeStore((s) => s.onAddText)
  const onCueList     = useMobileShellBridgeStore((s) => s.onCueList)
  const onStageShape  = useMobileShellBridgeStore((s) => s.onStageShape)
  const onSetPiece    = useMobileShellBridgeStore((s) => s.onSetPiece)
  const onAudioImport = useMobileShellBridgeStore((s) => s.onAudioImport)
  const onAiSuggest = useMobileShellBridgeStore((s) => s.onAiSuggest)
  const onRosterImport = useMobileShellBridgeStore((s) => s.onRosterImport)
  const onMemberList  = useMobileShellBridgeStore((s) => s.onMemberList)
  const onMemberAdd   = useMobileShellBridgeStore((s) => s.onMemberAdd)
  const onShareLinks  = useMobileShellBridgeStore((s) => s.onShareLinks)
  const onHelp        = useMobileShellBridgeStore((s) => s.onHelp)
  const onFlowLibrary = useMobileShellBridgeStore((s) => s.onFlowLibrary)

  const MENU_SECTIONS: MenuSection[] = [
    {
      title: 'Stages', icon: '🎭',
      items: [
        { label: 'キュー設定',       icon: '🎬', action: onAddCue },
        { label: '舞台設定',         icon: '⚙️', action: onStageSettings },
        { label: 'キュー一覧',       icon: '📋', action: onCueList },
        { label: 'ライブラリ',       icon: '📚', action: onFlowLibrary },
        { label: '立ち位置雛形保存', icon: '💾', action: onSaveSpot },
        { label: 'テキスト追加',     icon: '✏️', action: onAddText },
        { label: '舞台変形',         icon: '🏟️', action: onStageShape },
        { label: '大道具追加',       icon: '🪑', action: onSetPiece },
      ],
    },
    {
      title: 'Timeline', icon: '🎵',
      items: [
        { label: '音源追加', icon: '🎵', action: onAudioImport },
        { label: 'AI提案', icon: '✨', action: onAiSuggest },
        { label: '名簿取込', icon: '📄', action: onRosterImport },
      ],
    },
    {
      title: 'Team', icon: '👥',
      items: [
        { label: 'メンバー表示', icon: '👤', action: onMemberList },
        { label: 'メンバー追加', icon: '➕', action: onMemberAdd },
        { label: '閲覧共有',    icon: '🔗', action: onShareLinks },
      ],
    },
    {
      title: 'Settings', icon: '⚙️',
      items: [
        { label: 'エクスポート', icon: '📤', action: onViewerList },
        { label: 'ヘルプ',      icon: '❓', action: onHelp },
      ],
    },
  ]

  const handleMenuItemTap = useCallback((action: () => void) => {
    action()
    setMenuOpen(false)
  }, [])

  if (!open) {
    return (
      <div className={styles.collapsed}>
        <button className={styles.collapseBtn} onClick={() => setOpen(true)} aria-label="パネルを開く">
          ›
        </button>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/* ── 閉じるボタン ── */}
      <div className={styles.panelTop}>
        <button className={styles.collapseBtn} onClick={() => setOpen(false)} aria-label="パネルを閉じる">
          ‹
        </button>
      </div>

      {/* ── 再生コントロール (1行) ── */}
      <div className={styles.playerRow}>
        <button
          className={`${ctrlStyles.btn} ${ctrlStyles.btnPrimary}`}
          onClick={onPlayPause}
          disabled={duration <= 0}
          aria-label={isPlaying ? '一時停止' : '再生'}
        >
          {isPlaying ? (
            <TransportIconPause size={22} className={ctrlStyles.iconPrimary} />
          ) : (
            <TransportIconPlay size={22} className={ctrlStyles.iconPrimary} />
          )}
        </button>
        <button
          className={ctrlStyles.btn}
          onClick={onStop}
          disabled={duration <= 0}
          aria-label="停止して先頭へ"
        >
          <TransportIconStop size={18} className={ctrlStyles.icon} />
        </button>
        <span className={styles.timeText}>{fmt(currentTime)}</span>
        <span className={styles.timeSep}>/</span>
        <span className={styles.timeDur}>{fmt(duration)}</span>
      </div>

      <div className={styles.divider} />

      {/* ── キューナビ: [‹][›] -------- Cue X/Y ── */}
      <div className={styles.cueRow}>
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
        <span className={styles.cueValue}>
          {currentCueIndex + 1} / {totalCues}
        </span>
      </div>

      <div className={styles.divider} />

      {/* ── 2D / 3D 表示切替 ── */}
      <div className={styles.viewToggleRow}>
        <button
          className={stageView === '2d' ? styles.viewBtnActive : styles.viewBtn}
          onClick={() => onStageViewChange('2d')}
          aria-label="2D表示"
        >
          2D
        </button>
        <button
          className={stageView === '3d' ? styles.viewBtnActive : styles.viewBtn}
          onClick={() => onStageViewChange('3d')}
          aria-label="3D表示"
        >
          3D
        </button>
      </div>

      {/* ── Menu + Undo/Redo (パネル下部) ── */}
      <div className={styles.bottomArea}>
        {/* ☰ Menu ボタン */}
        <button
          className={styles.menuBtn}
          onClick={() => setMenuOpen(true)}
          aria-label="メニューを開く"
          aria-expanded={menuOpen}
        >
          <span className={styles.menuBtnIcon}>☰</span>
          <span className={styles.menuBtnLabel}>Menu</span>
        </button>

        {/* Undo / Redo */}
        <div className={styles.undoRedoRow}>
          <button
            className={styles.histBtn}
            onClick={onUndo}
            disabled={undoDisabled}
            aria-label="元に戻す"
          >
            <span className={styles.histIcon}>↩</span>
            <span className={styles.histLabel}>Undo</span>
          </button>
          <button
            className={styles.histBtn}
            onClick={onRedo}
            disabled={redoDisabled}
            aria-label="やり直す"
          >
            <span className={styles.histIcon}>↪</span>
            <span className={styles.histLabel}>Redo</span>
          </button>
        </div>
      </div>

      {/* ── メニューオーバーレイ ── */}
      {menuOpen && (
        <>
          <div
            className={styles.menuBackdrop}
            onClick={() => setMenuOpen(false)}
          />
          <div className={styles.menuSheet} role="dialog" aria-label="メニュー">
            {/* ヘッダー */}
            <div className={styles.menuSheetHeader}>
              <span className={styles.menuSheetTitle}>Menu</span>
              <button
                className={styles.menuSheetClose}
                onClick={() => setMenuOpen(false)}
                aria-label="メニューを閉じる"
              >✕</button>
            </div>

            {/* セクション一覧 */}
            <div className={styles.menuContent}>
              {MENU_SECTIONS.map((section) => (
                <div key={section.title} className={styles.menuSection}>
                  <div className={styles.menuSectionTitle}>
                    <span>{section.icon}</span> {section.title}
                  </div>
                  <div className={styles.menuGrid}>
                    {section.items.map((item) => (
                      <button
                        key={item.label}
                        className={styles.menuItem}
                        onClick={() => handleMenuItemTap(item.action)}
                      >
                        <span className={styles.menuItemIcon}>{item.icon}</span>
                        <span className={styles.menuItemLabel}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

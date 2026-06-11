/**
 * LandscapeSidePanel.tsx
 * 横向き専用の左サイドパネル（再生・波形操作・Menu）
 */

import React, { useState, useCallback } from 'react'
import styles from './LandscapeSidePanel.module.css'
import ctrlStyles from './TransportControls.module.css'
import {
  TransportIconPause,
  TransportIconPlay,
  TransportIconStop,
  TransportIconSkipBack,
  TransportIconSkipForward,
  TransportIconZoomIn,
  TransportIconZoomOut,
  TransportIconUndo,
  TransportIconRedo,
} from './TransportIcons'
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
  audioUrl: string | null
  isPlaying: boolean
  duration: number
  onPlayPause: () => void
  onStop: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  landscapeWaveExpanded?: boolean
  onWaveExpand?: () => void
  onAddCue: () => void
  onStageSettings: () => void
  onViewerList: () => void
  onUndo?: () => void
  onRedo?: () => void
  undoDisabled?: boolean
  redoDisabled?: boolean
  /** 親（MobileShell）から畳み状態を制御する場合 */
  panelOpen?: boolean
  onPanelOpenChange?: (open: boolean) => void
}

export const LandscapeSidePanel: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  duration,
  onPlayPause,
  onStop,
  onSkipBack,
  onSkipForward,
  onZoomIn,
  onZoomOut,
  landscapeWaveExpanded = true,
  onWaveExpand,
  onAddCue,
  onStageSettings,
  onViewerList,
  onUndo,
  onRedo,
  undoDisabled,
  redoDisabled,
  panelOpen: panelOpenProp,
  onPanelOpenChange,
}) => {
  const [panelOpenInternal, setPanelOpenInternal] = useState(true)
  const panelOpen = panelOpenProp ?? panelOpenInternal
  const setPanelOpen = onPanelOpenChange ?? setPanelOpenInternal
  const [menuOpen, setMenuOpen] = useState(false)
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
  const onVideoExport = useMobileShellBridgeStore((s) => s.onVideoExport)
  const onFlowLibrary = useMobileShellBridgeStore((s) => s.onFlowLibrary)
  const onPhotoParse = useMobileShellBridgeStore((s) => s.onPhotoParse)

  const transportDisabled = !audioUrl || duration <= 0

  const MENU_SECTIONS: MenuSection[] = [
    {
      title: 'Stages', icon: '🎭',
      items: [
        { label: 'キュー設定',       icon: '🎬', action: onAddCue },
        { label: '舞台設定',         icon: '⚙️', action: onStageSettings },
        { label: 'キュー一覧',       icon: '📋', action: onCueList },
        { label: 'ライブラリ',       icon: '📚', action: onFlowLibrary },
        { label: '画像キュー',       icon: '🖼️', action: onPhotoParse },
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
        { label: '動画書き出し', icon: '🎥', action: onVideoExport },
        { label: 'ヘルプ',      icon: '❓', action: onHelp },
      ],
    },
  ]

  const handleMenuItemTap = useCallback((action: () => void) => {
    action()
    setMenuOpen(false)
  }, [])

  const waveExpandBtn =
    !landscapeWaveExpanded && onWaveExpand ? (
      <button
        type="button"
        className={styles.waveExpandBtn}
        onClick={onWaveExpand}
        aria-label="波形を展開"
        title="波形を展開"
      >
        <span className={styles.waveExpandIcon} aria-hidden>〜</span>
        <span className={styles.waveExpandLabel}>波形</span>
      </button>
    ) : null

  if (!panelOpen) {
    return (
      <div className={styles.collapsedRail} aria-hidden>
        <div className={styles.collapsedFloatingStack}>
          {waveExpandBtn}
          <button
            type="button"
            className={`${styles.panelToggleBtn} ${styles.panelToggleBtnExpandFloating}`}
            onClick={() => setPanelOpen(true)}
            aria-label="左メニューを開く"
            title="左メニューを開く"
          >
            <span className={styles.panelToggleChevron} aria-hidden>
              ›
            </span>
            <span className={styles.panelToggleLabel}>Menu</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelTop}>
        <button
          type="button"
          className={`${styles.panelToggleBtn} ${styles.panelToggleBtnCollapse}`}
          onClick={() => setPanelOpen(false)}
          aria-label="左メニューを畳む"
          title="左メニューを畳む"
        >
          <span className={styles.panelToggleChevron} aria-hidden>
            ‹
          </span>
          <span className={styles.panelToggleLabel}>畳む</span>
        </button>
      </div>

      {waveExpandBtn}

      <div className={`${ctrlStyles.controls} ${styles.controlGrid}`}>
        <button
          className={`${ctrlStyles.btn} ${ctrlStyles.btnPrimary} ${styles.gridBtn}`}
          onClick={onPlayPause}
          disabled={transportDisabled}
          aria-label={isPlaying ? '一時停止' : '再生'}
        >
          {isPlaying ? (
            <TransportIconPause size={20} className={ctrlStyles.iconPrimary} />
          ) : (
            <TransportIconPlay size={20} className={ctrlStyles.iconPrimary} />
          )}
        </button>
        <button
          className={`${ctrlStyles.btn} ${styles.gridBtn}`}
          onClick={onStop}
          disabled={transportDisabled}
          aria-label="停止して先頭へ"
        >
          <TransportIconStop size={16} className={ctrlStyles.icon} />
        </button>
        <button
          className={`${ctrlStyles.btn} ${ctrlStyles.skipBtn} ${styles.gridBtn}`}
          onClick={onSkipBack}
          disabled={transportDisabled}
          aria-label="5秒戻す"
        >
          <TransportIconSkipBack size={18} className={ctrlStyles.icon} />
          <span className={ctrlStyles.skipBadge}>5</span>
        </button>
        <button
          className={`${ctrlStyles.btn} ${ctrlStyles.skipBtn} ${styles.gridBtn}`}
          onClick={onSkipForward}
          disabled={transportDisabled}
          aria-label="5秒進める"
        >
          <TransportIconSkipForward size={18} className={ctrlStyles.icon} />
          <span className={ctrlStyles.skipBadge}>5</span>
        </button>
        <button
          className={`${ctrlStyles.btn} ${styles.gridBtn}`}
          onClick={onZoomOut}
          disabled={transportDisabled}
          aria-label="波形を縮小"
          title="縮小"
        >
          <TransportIconZoomOut size={18} className={ctrlStyles.icon} />
        </button>
        <button
          className={`${ctrlStyles.btn} ${styles.gridBtn}`}
          onClick={onZoomIn}
          disabled={transportDisabled}
          aria-label="波形を拡大"
          title="拡大"
        >
          <TransportIconZoomIn size={18} className={ctrlStyles.icon} />
        </button>
      </div>

      <div className={styles.bottomArea}>
        <button
          className={styles.menuBtn}
          onClick={() => setMenuOpen(true)}
          aria-label="メニューを開く"
          aria-expanded={menuOpen}
        >
          <span className={styles.menuBtnIcon}>☰</span>
          <span className={styles.menuBtnLabel}>Menu</span>
        </button>

        <div className={styles.undoRedoRow} role="group" aria-label="操作履歴">
          <button
            type="button"
            className={`${styles.histBtn} ${styles.histBtnUndo}`}
            onClick={onUndo}
            disabled={undoDisabled}
            aria-label="元に戻す"
            title="元に戻す"
          >
            <span className={styles.histIconWrap} aria-hidden>
              <TransportIconUndo size={20} className={styles.histIconSvg} />
            </span>
            <span className={styles.histLabel}>戻る</span>
          </button>
          <button
            type="button"
            className={`${styles.histBtn} ${styles.histBtnRedo}`}
            onClick={onRedo}
            disabled={redoDisabled}
            aria-label="やり直す"
            title="やり直す"
          >
            <span className={styles.histIconWrap} aria-hidden>
              <TransportIconRedo size={20} className={styles.histIconSvg} />
            </span>
            <span className={styles.histLabel}>進む</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div
            className={styles.menuBackdrop}
            onClick={() => setMenuOpen(false)}
          />
          <div className={styles.menuSheet} role="dialog" aria-label="メニュー">
            <div className={styles.menuSheetHeader}>
              <span className={styles.menuSheetTitle}>Menu</span>
              <button
                className={styles.menuSheetClose}
                onClick={() => setMenuOpen(false)}
                aria-label="メニューを閉じる"
              >✕</button>
            </div>
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

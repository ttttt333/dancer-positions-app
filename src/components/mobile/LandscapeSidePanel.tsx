/**
 * LandscapeSidePanel.tsx
 * 横向き専用の左サイドパネル（再生・波形操作・Menu）
 */

import React, { useState } from 'react'
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
import { formatMmSsFloor } from '../../lib/timeFormat'
import { MobileMenuSheet } from './MobileMenuSheet'

interface Props {
  audioUrl: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlayPause: () => void
  onStop: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  landscapeWaveExpanded?: boolean
  onWaveExpand?: () => void
  /** false のとき左パネルを畳めない（波形たたみ後は舞台最大化＋再生を維持） */
  allowPanelCollapse?: boolean
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
  currentTime,
  duration,
  onPlayPause,
  onStop,
  onSkipBack,
  onSkipForward,
  onZoomIn,
  onZoomOut,
  landscapeWaveExpanded = true,
  onWaveExpand,
  allowPanelCollapse = true,
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
  const stageView = useMobileShellBridgeStore((s) => s.stageView)
  const onStageViewChange = useMobileShellBridgeStore((s) => s.onStageViewChange)
  const showFormationChange = useMobileShellBridgeStore((s) => s.showFormationChange)
  const onFormationChange = useMobileShellBridgeStore((s) => s.onFormationChange)
  const cuePagerLabel = useMobileShellBridgeStore((s) => s.cuePagerLabel)
  const cuePagerCanPrev = useMobileShellBridgeStore((s) => s.cuePagerCanPrev)
  const cuePagerCanNext = useMobileShellBridgeStore((s) => s.cuePagerCanNext)
  const onCuePrev = useMobileShellBridgeStore((s) => s.onCuePrev)
  const onCueNext = useMobileShellBridgeStore((s) => s.onCueNext)

  const transportDisabled = !audioUrl || duration <= 0

  const waveExpandBtn =
    !landscapeWaveExpanded && onWaveExpand ? (
      <button
        type="button"
        className={`${styles.waveExpandBtn} ${styles.waveExpandBtnCompact}`}
        onClick={onWaveExpand}
        aria-label="波形を展開"
        title="波形を展開"
      >
        <span className={styles.waveExpandIcon} aria-hidden>▲</span>
        <span className={styles.waveExpandLabel} aria-hidden>波形</span>
      </button>
    ) : null

  const menuOverlay = menuOpen ? (
    <MobileMenuSheet
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      variant="landscape"
    />
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

  if (!landscapeWaveExpanded) {
    return (
      <div className={`${styles.panel} ${styles.panelCompact}`}>
        {waveExpandBtn}

        <div className={styles.compactTransportCol}>
          <button
            className={`${ctrlStyles.btn} ${ctrlStyles.btnPrimary} ${styles.compactPlayBtn}`}
            onClick={onPlayPause}
            disabled={transportDisabled}
            aria-label={isPlaying ? '一時停止' : '再生'}
          >
            {isPlaying ? (
              <TransportIconPause size={22} className={ctrlStyles.iconPrimary} />
            ) : (
              <TransportIconPlay size={22} className={ctrlStyles.iconPrimary} />
            )}
          </button>
          <button
            className={`${ctrlStyles.btn} ${styles.compactStopBtn}`}
            onClick={onStop}
            disabled={transportDisabled}
            aria-label="停止して先頭へ"
          >
            <TransportIconStop size={16} className={ctrlStyles.icon} />
          </button>
        </div>

        <div className={styles.compactStageControls} aria-label="舞台コントロール">
          {showFormationChange ? (
            <button
              type="button"
              className={styles.compactChangeBtn}
              onClick={onFormationChange}
              title="立ち位置の雛形を選ぶ"
              aria-label="立ち位置の雛形を選ぶ"
            >
              Change
            </button>
          ) : null}
          <div className={styles.compactViewRow} role="group" aria-label="ステージ表示">
            <button
              type="button"
              className={`${styles.compactViewBtn}${stageView === '2d' ? ` ${styles.compactViewBtnActive}` : ''}`}
              onClick={() => onStageViewChange('2d')}
            >
              2D
            </button>
            <button
              type="button"
              className={`${styles.compactViewBtn}${stageView === '3d' ? ` ${styles.compactViewBtnActive}` : ''}`}
              onClick={() => onStageViewChange('3d')}
            >
              3D
            </button>
          </div>
          {cuePagerLabel ? (
            <div className={styles.compactPager} role="group" aria-label="キュー移動">
              <button
                type="button"
                className={styles.compactPagerBtn}
                onClick={onCuePrev}
                disabled={!cuePagerCanPrev}
                aria-label="前のキュー"
              >
                ‹
              </button>
              <span className={styles.compactPagerLabel} role="status">
                {cuePagerLabel}
              </span>
              <button
                type="button"
                className={styles.compactPagerBtn}
                onClick={onCueNext}
                disabled={!cuePagerCanNext}
                aria-label="次のキュー"
              >
                ›
              </button>
            </div>
          ) : null}
          <div
            className={styles.compactTime}
            aria-live="polite"
            aria-label={`再生位置 ${formatMmSsFloor(currentTime)} / ${formatMmSsFloor(duration)}`}
          >
            <span className={styles.compactTimeCurrent}>{formatMmSsFloor(currentTime)}</span>
            {' / '}
            {formatMmSsFloor(duration)}
          </div>
        </div>

        <div className={styles.compactToolRow} role="group" aria-label="メニューと操作履歴">
          <button
            type="button"
            className={`${styles.compactIconBtn} ${styles.compactIconBtnMenu}`}
            onClick={() => setMenuOpen(true)}
            aria-label="メニューを開く"
            aria-expanded={menuOpen}
          >
            ☰
          </button>
          <button
            type="button"
            className={`${styles.compactIconBtn} ${styles.compactIconBtnHist}`}
            onClick={onUndo}
            disabled={undoDisabled}
            aria-label="元に戻す"
            title="元に戻す"
          >
            <TransportIconUndo size={18} />
          </button>
          <button
            type="button"
            className={`${styles.compactIconBtn} ${styles.compactIconBtnHist}`}
            onClick={onRedo}
            disabled={redoDisabled}
            aria-label="やり直す"
            title="やり直す"
          >
            <TransportIconRedo size={18} />
          </button>
        </div>

        {menuOverlay}
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {allowPanelCollapse ? (
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
      ) : null}

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

      {menuOverlay}
    </div>
  )
}

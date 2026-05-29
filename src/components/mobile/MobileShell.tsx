/**
 * MobileShell.tsx
 *
 * 縦/横向きに応じてレイアウトを自動切り替えするシェル。
 * EditorPage の内容 (children) をそのまま受け取り、
 * 周囲に音声バー・コントロールパネルを追加する。
 *
 * 使い方:
 *   <MobileShell audioUrl={...} cues={...} currentCue={...} ...>
 *     <EditorStageArea />  ← ステージ部分のみ渡す
 *   </MobileShell>
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useOrientation } from '../../hooks/useOrientation'
import { PortraitBottomBar } from './PortraitBottomBar'
import { LandscapeSidePanel } from './LandscapeSidePanel'
import { LandscapeBottomWaveBar } from './LandscapeBottomWaveBar'
import { useMobileShellBridgeStore } from '../../store/useMobileShellBridgeStore'
import styles from './MobileShell.module.css'

export interface MobileShellProps {
  /** ステージ描画エリア (Konvaキャンバスが入る) */
  children: React.ReactNode

  // ── 音声 ──
  audioUrl: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlayPause: () => void
  onStop: () => void
  onSeek: (sec: number) => void

  // ── キュー ──
  currentCueIndex: number
  totalCues: number
  onCuePrev: () => void
  onCueNext: () => void
  onAddCue: () => void

  // ── アクション ──
  onStageSettings: () => void
  onViewerList: () => void

  // ── タブ ──
  activeTab: 'stages' | 'timeline' | 'team' | 'settings'
  onTabChange: (tab: MobileShellProps['activeTab']) => void
}

export const MobileShell: React.FC<MobileShellProps> = (props) => {
  const orientation = useOrientation()
  const isLandscape = orientation === 'landscape'
  const onUndo = useMobileShellBridgeStore((s) => s.onUndo)
  const onRedo = useMobileShellBridgeStore((s) => s.onRedo)
  const undoDisabled = useMobileShellBridgeStore((s) => s.undoDisabled)
  const redoDisabled = useMobileShellBridgeStore((s) => s.redoDisabled)
  const cueStartTimes = useMobileShellBridgeStore((s) => s.cueStartTimes)

  // ── ダイアログ開閉を監視して浮遊閉じるボタンを表示 ──
  const [hasOpenDialog, setHasOpenDialog] = useState(false)
  const [landscapeWaveExpanded, setLandscapeWaveExpanded] = useState(true)

  useEffect(() => {
    const checkDialog = () => {
      /** キュー設定（aria-modal="false"）はフッターのキャンセルで閉じる。浮遊ボタンは邪魔になるため出さない */
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]')
      /** Change 雛形ピッカーは左下に閉じる・適用があるため浮遊閉じるは出さない */
      if (modal?.getAttribute('data-editor-sheet') === 'formation-preset-picker') {
        setHasOpenDialog(false)
        return
      }
      setHasOpenDialog(!!modal)
    }
    const observer = new MutationObserver(checkDialog)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal'],
    })
    checkDialog()
    return () => observer.disconnect()
  }, [])

  const handleFloatingClose = useCallback(() => {
    // EditorSideSheet の透明クリック領域ボタン
    const dismissBtn = document.querySelector(
      'button[aria-label="パネルを閉じる"]'
    ) as HTMLButtonElement | null
    if (dismissBtn && !dismissBtn.disabled) {
      dismissBtn.click()
      return
    }
    // ダイアログ内の閉じる/キャンセルボタン
    const dialog = document.querySelector('[role="dialog"]')
    if (dialog) {
      const closeBtn = dialog.querySelector(
        'button[aria-label*="閉じ"], button[aria-label*="キャンセル"], button[aria-label*="close"]'
      ) as HTMLButtonElement | null
      if (closeBtn) {
        closeBtn.click()
        return
      }
    }
    // フォールバック: Escape キー
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  }, [])

  /**
   * 縦↔横で return を分けると EditorPage がアンマウントされ編集内容が消える。
   * ルートは 1 本化し、ステージ host に固定 key を付けて子を維持する。
   */
  return (
    <div
      className={isLandscape ? styles.landscapeRoot : styles.portraitRoot}
      {...(isLandscape
        ? {
            'data-shell-landscape': '',
            ...(landscapeWaveExpanded ? {} : { 'data-landscape-wave-collapsed': '' }),
          }
        : { 'data-shell-portrait': '' })}
    >
      {isLandscape ? (
        <div className={styles.landscapeMainRow}>
          <LandscapeSidePanel
            isPlaying={props.isPlaying}
            currentTime={props.currentTime}
            duration={props.duration}
            onPlayPause={props.onPlayPause}
            onStop={props.onStop}
            onSeek={props.onSeek}
            currentCueIndex={props.currentCueIndex}
            totalCues={props.totalCues}
            onCuePrev={props.onCuePrev}
            onCueNext={props.onCueNext}
            onAddCue={props.onAddCue}
            onStageSettings={props.onStageSettings}
            onViewerList={props.onViewerList}
            onUndo={onUndo}
            onRedo={onRedo}
            undoDisabled={undoDisabled}
            redoDisabled={redoDisabled}
            landscapeWaveExpanded={landscapeWaveExpanded}
            onLandscapeWaveExpand={() => setLandscapeWaveExpanded(true)}
          />
          <div
            key="mobile-stage-host"
            className={styles.stageAreaLandscape}
          >
            {props.children}
          </div>
        </div>
      ) : (
        <div
          key="mobile-stage-host"
          className={styles.stageAreaPortrait}
        >
          {props.children}
        </div>
      )}

      {isLandscape && landscapeWaveExpanded ? (
        <LandscapeBottomWaveBar
          audioUrl={props.audioUrl}
          isPlaying={props.isPlaying}
          currentTime={props.currentTime}
          duration={props.duration}
          onPlayPause={props.onPlayPause}
          onStop={props.onStop}
          onSeek={props.onSeek}
          onCollapse={() => setLandscapeWaveExpanded(false)}
        />
      ) : null}

      {!isLandscape ? (
        <PortraitBottomBar
          audioUrl={props.audioUrl}
          isPlaying={props.isPlaying}
          currentTime={props.currentTime}
          duration={props.duration}
          onPlayPause={props.onPlayPause}
          onStop={props.onStop}
          onSeek={props.onSeek}
          currentCueIndex={props.currentCueIndex}
          totalCues={props.totalCues}
          onCuePrev={props.onCuePrev}
          onCueNext={props.onCueNext}
          onAddCue={props.onAddCue}
          onStageSettings={props.onStageSettings}
          onViewerList={props.onViewerList}
          cueStartTimes={cueStartTimes}
        />
      ) : null}

      {hasOpenDialog ? (
        <button
          className={`${styles.floatingClose} ${isLandscape ? styles.floatingCloseLandscape : ""}`.trim()}
          onClick={handleFloatingClose}
          aria-label="ダイアログを閉じる"
        >
          ✕ 閉じる
        </button>
      ) : null}
    </div>
  )
}

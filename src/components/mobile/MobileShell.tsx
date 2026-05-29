/**
 * MobileShell.tsx
 *
 * 縦/横向きに応じてレイアウトを自動切り替えするシェル。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useOrientation } from '../../hooks/useOrientation'
import { PortraitBottomBar } from './PortraitBottomBar'
import { LandscapeSidePanel } from './LandscapeSidePanel'
import { LandscapeBottomWaveBar } from './LandscapeBottomWaveBar'
import { type PortraitWaveTransportHandle } from './PortraitWaveTransport'
import { useMobileShellBridgeStore } from '../../store/useMobileShellBridgeStore'
import styles from './MobileShell.module.css'

export interface MobileShellProps {
  children: React.ReactNode
  audioUrl: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlayPause: () => void
  onStop: () => void
  onSeek: (sec: number) => void
  currentCueIndex: number
  totalCues: number
  onCuePrev: () => void
  onCueNext: () => void
  onAddCue: () => void
  onStageSettings: () => void
  onViewerList: () => void
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
  const landscapeWaveRef = useRef<PortraitWaveTransportHandle>(null)

  const [hasOpenDialog, setHasOpenDialog] = useState(false)
  const [landscapeWaveExpanded, setLandscapeWaveExpanded] = useState(true)

  useEffect(() => {
    const checkDialog = () => {
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]')
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
    const modal = document.querySelector(
      '[role="dialog"][aria-modal="true"]'
    ) as HTMLElement | null
    if (modal) {
      const closeBtn = modal.querySelector(
        'button[aria-label*="閉じ"], button[aria-label*="キャンセル"], button[aria-label*="close"]'
      ) as HTMLButtonElement | null
      if (closeBtn && !closeBtn.disabled) {
        closeBtn.click()
        return
      }
      /** EditorSideSheet: 透明ディミス領域は dialog の外（sheet root 内） */
      const sheetRoot =
        modal.closest('[data-editor-sheet-root]') ??
        document.querySelector('[data-editor-sheet-root]')
      if (sheetRoot) {
        const dismissBtn = sheetRoot.querySelector(
          'button[aria-label="パネルを閉じる"]'
        ) as HTMLButtonElement | null
        if (dismissBtn && !dismissBtn.disabled) {
          dismissBtn.click()
          return
        }
      }
    }
    const dialog = document.querySelector('[role="dialog"]')
    if (dialog) {
      const closeBtn = dialog.querySelector(
        'button[aria-label*="閉じ"], button[aria-label*="キャンセル"], button[aria-label*="close"]'
      ) as HTMLButtonElement | null
      if (closeBtn && !closeBtn.disabled) {
        closeBtn.click()
        return
      }
    }
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  }, [])

  const handleSkipBack = useCallback(() => {
    landscapeWaveRef.current?.skipBack()
  }, [])

  const handleSkipForward = useCallback(() => {
    landscapeWaveRef.current?.skipForward()
  }, [])

  const handleZoomIn = useCallback(() => {
    landscapeWaveRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    landscapeWaveRef.current?.zoomOut()
  }, [])

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
            audioUrl={props.audioUrl}
            isPlaying={props.isPlaying}
            duration={props.duration}
            onPlayPause={props.onPlayPause}
            onStop={props.onStop}
            onSkipBack={handleSkipBack}
            onSkipForward={handleSkipForward}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            landscapeWaveExpanded={landscapeWaveExpanded}
            onWaveExpand={() => setLandscapeWaveExpanded(true)}
            onAddCue={props.onAddCue}
            onStageSettings={props.onStageSettings}
            onViewerList={props.onViewerList}
            onUndo={onUndo}
            onRedo={onRedo}
            undoDisabled={undoDisabled}
            redoDisabled={redoDisabled}
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
          waveRef={landscapeWaveRef}
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

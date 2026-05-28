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
  const onUndo = useMobileShellBridgeStore((s) => s.onUndo)
  const onRedo = useMobileShellBridgeStore((s) => s.onRedo)
  const undoDisabled = useMobileShellBridgeStore((s) => s.undoDisabled)
  const redoDisabled = useMobileShellBridgeStore((s) => s.redoDisabled)
  const cueStartTimes = useMobileShellBridgeStore((s) => s.cueStartTimes)

  // ── ダイアログ開閉を監視して浮遊閉じるボタンを表示 ──
  const [hasOpenDialog, setHasOpenDialog] = useState(false)

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

  if (orientation === 'landscape') {
    return (
      <div className={styles.landscapeRoot} data-shell-landscape="">
        {/* 左サイドパネル: 再生コントロール + 波形 + キューナビ + アクション + Undo/Redo */}
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
        />

        {/* ステージ: 波形ヘッダーを排除して全高使用 */}
        <div className={styles.stageAreaLandscape}>
          {props.children}
        </div>

        {/* ダイアログが開いているときだけ浮遊閉じるボタンを表示 */}
        {hasOpenDialog && (
          <button className={styles.floatingClose} onClick={handleFloatingClose} aria-label="ダイアログを閉じる">
            ✕ 閉じる
          </button>
        )}
      </div>
    )
  }

  // 縦向き
  return (
    <div className={styles.portraitRoot} data-shell-portrait="">
      {/* 中央: ステージ (flex-1 で残り全部) */}
      <div className={styles.stageAreaPortrait}>
        {props.children}
      </div>

      {/* 下部: 波形 + キューナビ + Menu/Undo/Redo */}
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

      {/* ダイアログが開いているときだけ浮遊閉じるボタンを表示 */}
      {hasOpenDialog && (
        <button className={styles.floatingClose} onClick={handleFloatingClose} aria-label="ダイアログを閉じる">
          ✕ 閉じる
        </button>
      )}
    </div>
  )
}

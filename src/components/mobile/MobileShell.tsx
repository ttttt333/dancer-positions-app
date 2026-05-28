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

import React from 'react'
import { useOrientation } from '../../hooks/useOrientation'
import { PortraitHeader } from './PortraitHeader'
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

  if (orientation === 'landscape') {
    return (
      <div className={styles.landscapeRoot} data-shell-landscape="">
        {/* ステージ: 横向きでは波形ヘッダーを排除して全高使用 */}
        <div className={styles.stageAreaLandscape}>
          {props.children}

          {/* Undo / Redo: 左親指が届く左下フローティング */}
          <div className={styles.undoRedoFloat}>
            <button
              className={styles.undoBtn}
              onClick={onUndo}
              disabled={undoDisabled}
              aria-label="元に戻す"
              title="元に戻す (Undo)"
            >
              ↩
            </button>
            <button
              className={styles.undoBtn}
              onClick={onRedo}
              disabled={redoDisabled}
              aria-label="やり直す"
              title="やり直す (Redo)"
            >
              ↪
            </button>
          </div>
        </div>

        {/* 右サイドパネル: 再生コントロール + 波形 + キューナビ + アクション */}
        <LandscapeSidePanel
          isPlaying={props.isPlaying}
          currentTime={props.currentTime}
          duration={props.duration}
          onPlayPause={props.onPlayPause}
          onSeek={props.onSeek}
          currentCueIndex={props.currentCueIndex}
          totalCues={props.totalCues}
          onCuePrev={props.onCuePrev}
          onCueNext={props.onCueNext}
          onAddCue={props.onAddCue}
          onStageSettings={props.onStageSettings}
          onViewerList={props.onViewerList}
        />
      </div>
    )
  }

  // 縦向き
  return (
    <div className={styles.portraitRoot} data-shell-portrait="">
      {/* 上部: 音声プレイヤー + 波形 */}
      <PortraitHeader
        audioUrl={props.audioUrl}
        isPlaying={props.isPlaying}
        currentTime={props.currentTime}
        duration={props.duration}
        onPlayPause={props.onPlayPause}
        onSeek={props.onSeek}
      />

      {/* 中央: ステージ (flex-1 で残り全部) */}
      <div className={styles.stageAreaPortrait}>
        {props.children}
      </div>

      {/* 下部: キューナビ + アクションボタン + タブバー */}
      <PortraitBottomBar
        currentCueIndex={props.currentCueIndex}
        totalCues={props.totalCues}
        onCuePrev={props.onCuePrev}
        onCueNext={props.onCueNext}
        onAddCue={props.onAddCue}
        onStageSettings={props.onStageSettings}
        onViewerList={props.onViewerList}
        activeTab={props.activeTab}
        onTabChange={props.onTabChange}
      />
    </div>
  )
}

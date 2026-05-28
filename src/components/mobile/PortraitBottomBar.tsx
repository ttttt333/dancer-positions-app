/**
 * PortraitBottomBar.tsx
 * 縦向き専用のボトムコントロール
 * キューナビ / NEXT CUE / STAGE SETTINGS / タブバー
 *
 * ▶ Geminiコードからの修正点:
 *   - grid-cols-17 → インラインスタイルで gridTemplateColumns 直接指定
 *   - safe-bottom → env(safe-area-inset-bottom) を CSS で直接使用
 */

import React from 'react'
import styles from './PortraitBottomBar.module.css'
import { useMobileShellBridgeStore } from '../../store/useMobileShellBridgeStore'

const TABS = [
  { id: 'stages'   as const, label: 'Stages',   icon: '⬜' },
  { id: 'timeline' as const, label: 'Timeline',  icon: '📊' },
  { id: 'team'     as const, label: 'Team',      icon: '👥' },
  { id: 'settings' as const, label: 'Settings',  icon: '⚙️' },
]

type TabId = typeof TABS[number]['id']

interface Props {
  currentCueIndex: number
  totalCues: number
  onCuePrev: () => void
  onCueNext: () => void
  onAddCue: () => void
  onStageSettings: () => void
  onViewerList: () => void
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export const PortraitBottomBar: React.FC<Props> = ({
  currentCueIndex, totalCues, onCuePrev, onCueNext,
  onAddCue, onStageSettings, onViewerList, activeTab, onTabChange,
}) => {
  const onUndo = useMobileShellBridgeStore((s) => s.onUndo)
  const onRedo = useMobileShellBridgeStore((s) => s.onRedo)
  const undoDisabled = useMobileShellBridgeStore((s) => s.undoDisabled)
  const redoDisabled = useMobileShellBridgeStore((s) => s.redoDisabled)

  return (
  <div className={styles.bar}>
    {/* ── Undo / Redo + キューナビ 1行 ── */}
    <div className={styles.cueRow}>
      {/* Undo / Redo */}
      <button className={styles.histBtn} onClick={onUndo} disabled={undoDisabled} aria-label="元に戻す">↩</button>
      <button className={styles.histBtn} onClick={onRedo} disabled={redoDisabled} aria-label="やり直す">↪</button>

      <div className={styles.cueNav}>
        <button
          className={styles.navArrow}
          onClick={onCuePrev}
          disabled={currentCueIndex === 0}
          aria-label="前のキュー"
        >‹</button>
        <span className={styles.cueLabel}>
          {currentCueIndex + 1} / {totalCues}
        </span>
        <button
          className={styles.navArrow}
          onClick={onCueNext}
          disabled={currentCueIndex >= totalCues - 1}
          aria-label="次のキュー"
        >›</button>
      </div>
    </div>

    {/* ── アクション行 ── */}
    <div className={styles.actionsRow}>
      <span className={styles.actionsLabel}>Actions</span>
      <button className={styles.viewerBtn} onClick={onViewerList}>
        Viewer List
      </button>
    </div>

    {/* ── 主要ボタン ── */}
    <div className={styles.mainBtns}>
      <button className={styles.goldBtn} onClick={onAddCue}>
        ＋ Next Cue
      </button>
      <button className={styles.darkBtn} onClick={onStageSettings}>
        Stage Settings
      </button>
    </div>

    {/* ── タブバー ── */}
    <div className={styles.tabBar}>
      {TABS.map(t => (
        <button
          key={t.id}
          className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabActive : ''}`}
          onClick={() => onTabChange(t.id)}
          aria-current={activeTab === t.id ? 'page' : undefined}
        >
          <span className={styles.tabIcon} aria-hidden>{t.icon}</span>
          <span className={styles.tabLabel}>{t.label}</span>
        </button>
      ))}
    </div>
  </div>
  )
}

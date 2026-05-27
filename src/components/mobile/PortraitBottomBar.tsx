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
}) => (
  <div className={styles.bar}>
    {/* ── キューナビ ── */}
    <div className={styles.cueRow}>
      <div className={styles.cueNav}>
        <button
          className={styles.navArrow}
          onClick={onCuePrev}
          disabled={currentCueIndex === 0}
          aria-label="前のキュー"
        >◀</button>
        <span className={styles.cueLabel}>
          Cue {currentCueIndex + 1} / {totalCues}
        </span>
        <button
          className={styles.navArrow}
          onClick={onCueNext}
          disabled={currentCueIndex >= totalCues - 1}
          aria-label="次のキュー"
        >▶</button>
        <button className={styles.addCueBtn} onClick={onAddCue}>
          ADD CUE
        </button>
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

/**
 * PortraitBottomBar.tsx
 * 縦向き専用のボトムコントロール
 * キューナビ / Undo-Redo / タブバー (タップでスライドアップメニュー)
 */

import React, { useState, useCallback } from 'react'
import styles from './PortraitBottomBar.module.css'
import { useMobileShellBridgeStore } from '../../store/useMobileShellBridgeStore'

const TABS = [
  { id: 'stages'   as const, label: 'Stages',   icon: '🎭' },
  { id: 'timeline' as const, label: 'Timeline',  icon: '🎵' },
  { id: 'team'     as const, label: 'Team',      icon: '👥' },
  { id: 'settings' as const, label: 'Settings',  icon: '⚙️' },
]

type TabId = typeof TABS[number]['id']

interface MenuItem {
  label: string
  icon: string
  action: () => void
}

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
  const [openMenu, setOpenMenu] = useState<TabId | null>(null)

  const onUndo = useMobileShellBridgeStore((s) => s.onUndo)
  const onRedo = useMobileShellBridgeStore((s) => s.onRedo)
  const undoDisabled = useMobileShellBridgeStore((s) => s.undoDisabled)
  const redoDisabled = useMobileShellBridgeStore((s) => s.redoDisabled)

  const onSaveSpot    = useMobileShellBridgeStore((s) => s.onSaveSpot)
  const onAddText     = useMobileShellBridgeStore((s) => s.onAddText)
  const onCueList     = useMobileShellBridgeStore((s) => s.onCueList)
  const onStageShape  = useMobileShellBridgeStore((s) => s.onStageShape)
  const onSetPiece    = useMobileShellBridgeStore((s) => s.onSetPiece)
  const onAudioImport = useMobileShellBridgeStore((s) => s.onAudioImport)
  const onRosterImport= useMobileShellBridgeStore((s) => s.onRosterImport)
  const onMemberList  = useMobileShellBridgeStore((s) => s.onMemberList)
  const onMemberAdd   = useMobileShellBridgeStore((s) => s.onMemberAdd)
  const onShareLinks  = useMobileShellBridgeStore((s) => s.onShareLinks)
  const onHelp        = useMobileShellBridgeStore((s) => s.onHelp)

  const TAB_MENUS: Record<TabId, MenuItem[]> = {
    stages: [
      { label: '立ち位置保存',  icon: '💾', action: onSaveSpot },
      { label: 'テキスト追加',  icon: '✏️', action: onAddText },
      { label: 'キュー一覧',   icon: '📋', action: onCueList },
      { label: '舞台変形',     icon: '🏟️', action: onStageShape },
      { label: '大道具',       icon: '🪑', action: onSetPiece },
    ],
    timeline: [
      { label: '音源追加',     icon: '🎵', action: onAudioImport },
      { label: '名簿取込',     icon: '📄', action: onRosterImport },
    ],
    team: [
      { label: 'メンバー表示', icon: '👤', action: onMemberList },
      { label: 'メンバー追加', icon: '➕', action: onMemberAdd },
      { label: '閲覧共有',    icon: '🔗', action: onShareLinks },
    ],
    settings: [
      { label: 'エクスポート',  icon: '📤', action: onAddCue }, // placeholder: onAddCue is temp
      { label: 'ヘルプ',       icon: '❓', action: onHelp },
    ],
  }
  // settingsのエクスポートは専用アクションが取得できるまで onViewerList で代替
  TAB_MENUS.settings[0].action = onViewerList

  const handleTabTap = useCallback((tabId: TabId) => {
    onTabChange(tabId)
    setOpenMenu(prev => prev === tabId ? null : tabId)
  }, [onTabChange])

  const handleMenuItemTap = useCallback((item: MenuItem) => {
    item.action()
    setOpenMenu(null)
  }, [])

  const menuItems = openMenu ? TAB_MENUS[openMenu] : []

  return (
  <div className={styles.bar}>
    {/* ── スライドアップ メニューシート ── */}
    {openMenu && (
      <>
        {/* 背景タップで閉じる */}
        <div className={styles.menuBackdrop} onClick={() => setOpenMenu(null)} />
        <div className={styles.menuSheet}>
          <div className={styles.menuHandle} />
          <div className={styles.menuTitle}>
            {TABS.find(t => t.id === openMenu)?.label}
          </div>
          <div className={styles.menuList}>
            {menuItems.map((item) => (
              <button
                key={item.label}
                className={styles.menuItem}
                onClick={() => handleMenuItemTap(item)}
              >
                <span className={styles.menuIcon}>{item.icon}</span>
                <span className={styles.menuLabel}>{item.label}</span>
                <span className={styles.menuChevron}>›</span>
              </button>
            ))}
          </div>
        </div>
      </>
    )}

    {/* ── Undo / Redo + キューナビ 1行 ── */}
    <div className={styles.cueRow}>
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

      {/* ── ＋ Next Cue ── */}
      <button className={styles.addCueBtn} onClick={onAddCue}>
        ＋ Cue
      </button>
    </div>

    {/* ── タブバー ── */}
    <div className={styles.tabBar}>
      {TABS.map(t => (
        <button
          key={t.id}
          className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabActive : ''} ${openMenu === t.id ? styles.tabMenuOpen : ''}`}
          onClick={() => handleTabTap(t.id)}
          aria-current={activeTab === t.id ? 'page' : undefined}
          aria-expanded={openMenu === t.id}
        >
          <span className={styles.tabIcon} aria-hidden>{t.icon}</span>
          <span className={styles.tabLabel}>{t.label}</span>
        </button>
      ))}
    </div>
  </div>
  )
}

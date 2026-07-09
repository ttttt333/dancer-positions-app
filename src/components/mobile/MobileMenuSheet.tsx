/**
 * MobileMenuSheet.tsx
 * スマホ縦/横共通メニュー — 2ブロック×3×3 で1画面に収める統一レイアウト
 */

import React, { useCallback } from 'react'
import styles from './MobileMenuSheet.module.css'
import { MobileMenuIcon } from './MobileMenuIcons'
import { useMobileMenuSections, type MobileMenuItem } from './useMobileMenuSections'

export type MobileMenuSheetVariant = 'portrait' | 'landscape'

interface Props {
  open: boolean
  onClose: () => void
  variant?: MobileMenuSheetVariant
}

export const MobileMenuSheet: React.FC<Props> = ({
  open,
  onClose,
  variant = 'portrait',
}) => {
  const sections = useMobileMenuSections()

  const handleItemTap = useCallback(
    (action: MobileMenuItem['action']) => {
      action()
      onClose()
    },
    [onClose]
  )

  if (!open) return null

  const sheetClass =
    variant === 'landscape'
      ? `${styles.sheet} ${styles.sheetLandscape}`
      : styles.sheet

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <div className={sheetClass} role="dialog" aria-label="メニュー">
        <header className={styles.header}>
          <div className={styles.headerBrand}>
            <span className={styles.title}>Menu</span>
            <span className={styles.subtitle}>Studio</span>
          </div>
        </header>

        <div className={styles.body}>
          {sections.map((section) => (
            <section key={section.title} className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>{section.title}</span>
              </div>
              <div className={styles.grid}>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.tile}
                    onClick={() => handleItemTap(item.action)}
                  >
                    <span className={styles.iconWrap} aria-hidden>
                      <MobileMenuIcon id={item.icon} size={22} className={styles.icon} />
                    </span>
                    <span className={styles.tileLabel}>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* 閉じる: 全メニュー共通で左下（左親指で届く位置） */}
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="メニューを閉じる"
          >
            ✕ 閉じる
          </button>
        </footer>
      </div>
    </>
  )
}

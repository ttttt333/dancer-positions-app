/**
 * MobileMenuSheet.tsx
 * スマホ縦/横共通のフルスクリーンメニュー（1画面収まり・シネマティック UI）
 */

import React, { useCallback } from 'react'
import styles from './MobileMenuSheet.module.css'
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
      <div
        className={styles.backdrop}
        onClick={onClose}
        aria-hidden
      />
      <div className={sheetClass} role="dialog" aria-label="メニュー">
        <header className={styles.header}>
          <div className={styles.headerBrand}>
            <span className={styles.title}>Menu</span>
            <span className={styles.subtitle}>Choreography Studio</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="メニューを閉じる"
          >
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {sections.map((section) => (
            <section key={section.title} className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>{section.title}</span>
                <span className={styles.sectionHeadLine} aria-hidden />
              </div>
              <div className={styles.tileGrid}>
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={styles.tile}
                    onClick={() => handleItemTap(item.action)}
                  >
                    <span className={styles.iconOrb} aria-hidden>
                      {item.icon}
                    </span>
                    <span className={styles.tileLabel}>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

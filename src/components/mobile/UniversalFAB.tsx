import React, { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import styles from './UniversalFAB.module.css';

interface UniversalFABProps {
  isOpen: boolean;
  onToggle: () => void;
  projectName: string;
  isPlaying: boolean;
  currentTime: number;
}

// ユニバーサルシンボルメニューのアイコン定義
const MENU_ITEMS = [
  { id: 'save', icon: '💾', label: '保存' },
  { id: 'share', icon: '🔗', label: '共有' },
  { id: 'circle', icon: '⭕', label: '円形配置' },
  { id: 'line', icon: '➖', label: 'ライン配置' },
  { id: 'grid', icon: '⊞', label: 'グリッド配置' },
  { id: 'add-dancer', icon: '👤', label: 'ダンサー追加' },
  { id: 'export', icon: '📤', label: '書き出し' },
  { id: 'settings', icon: '⚙️', label: '設定' },
];

export const UniversalFAB: React.FC<UniversalFABProps> = ({
  isOpen,
  onToggle,
  projectName,
  isPlaying,
  currentTime,
}) => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const handleMenuItemClick = (itemId: string) => {
    setSelectedItem(itemId);
    // メニュー項目の処理を実装
    console.log('Menu item clicked:', itemId);
    
    // フィードバックのためのバイブレーション
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // クリック後にメニューを閉じる
    setTimeout(() => {
      onToggle();
      setSelectedItem(null);
    }, 200);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.universalFabContainer}>
      {/* メインFABボタン */}
      <button
        className={`${styles.fabMain} ${isOpen ? styles.open : ''}`}
        onClick={onToggle}
        aria-label="メニュー"
      >
        <span className={styles.fabIcon}>
          {isOpen ? '✕' : '☰'}
        </span>
      </button>

      {/* 展開されるメニュー項目 */}
      {isOpen && (
        <div className={styles.menuItems}>
          {MENU_ITEMS.map((item, index) => (
            <button
              key={item.id}
              className={`${styles.menuItem} ${selectedItem === item.id ? styles.selected : ''}`}
              onClick={() => handleMenuItemClick(item.id)}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              <span className={styles.menuIcon}>{item.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* プロジェクト情報表示 */}
      <div className={styles.projectInfo}>
        <div className={styles.projectName}>{projectName}</div>
        <div className={styles.timeInfo}>
          {formatTime(currentTime)} {isPlaying ? '▶️' : '⏸️'}
        </div>
      </div>
    </div>
  );
};

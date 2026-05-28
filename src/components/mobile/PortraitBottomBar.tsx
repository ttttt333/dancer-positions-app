/**
 * PortraitBottomBar.tsx
 * 縦向き専用ボトム: 波形 / キューナビ / Menu + Undo-Redo
 */

import React, { useState, useCallback } from "react";
import styles from "./PortraitBottomBar.module.css";
import { useMobileShellBridgeStore } from "../../store/useMobileShellBridgeStore";
import { PortraitWaveTransport } from "./PortraitWaveTransport";

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
}

interface MenuSection {
  title: string;
  icon: string;
  items: MenuItem[];
}

interface Props {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (sec: number) => void;
  currentCueIndex: number;
  totalCues: number;
  onCuePrev: () => void;
  onCueNext: () => void;
  onAddCue: () => void;
  onStageSettings: () => void;
  onViewerList: () => void;
  cueStartTimes: number[];
}

export const PortraitBottomBar: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onStop,
  onSeek,
  currentCueIndex,
  totalCues,
  onCuePrev,
  onCueNext,
  onAddCue,
  onStageSettings,
  onViewerList,
  cueStartTimes,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const onUndo = useMobileShellBridgeStore((s) => s.onUndo);
  const onRedo = useMobileShellBridgeStore((s) => s.onRedo);
  const undoDisabled = useMobileShellBridgeStore((s) => s.undoDisabled);
  const redoDisabled = useMobileShellBridgeStore((s) => s.redoDisabled);

  const onSaveSpot = useMobileShellBridgeStore((s) => s.onSaveSpot);
  const onAddText = useMobileShellBridgeStore((s) => s.onAddText);
  const onCueList = useMobileShellBridgeStore((s) => s.onCueList);
  const onStageShape = useMobileShellBridgeStore((s) => s.onStageShape);
  const onSetPiece = useMobileShellBridgeStore((s) => s.onSetPiece);
  const onAudioImport = useMobileShellBridgeStore((s) => s.onAudioImport);
  const onAiSuggest = useMobileShellBridgeStore((s) => s.onAiSuggest);
  const onRosterImport = useMobileShellBridgeStore((s) => s.onRosterImport);
  const onMemberList = useMobileShellBridgeStore((s) => s.onMemberList);
  const onMemberAdd = useMobileShellBridgeStore((s) => s.onMemberAdd);
  const onShareLinks = useMobileShellBridgeStore((s) => s.onShareLinks);
  const onHelp = useMobileShellBridgeStore((s) => s.onHelp);
  const onFlowLibrary = useMobileShellBridgeStore((s) => s.onFlowLibrary);

  const MENU_SECTIONS: MenuSection[] = [
    {
      title: "Stages",
      icon: "🎭",
      items: [
        { label: "キュー設定", icon: "🎬", action: onAddCue },
        { label: "舞台設定", icon: "⚙️", action: onStageSettings },
        { label: "キュー一覧", icon: "📋", action: onCueList },
        { label: "ライブラリ", icon: "📚", action: onFlowLibrary },
        { label: "立ち位置雛形保存", icon: "💾", action: onSaveSpot },
        { label: "テキスト追加", icon: "✏️", action: onAddText },
        { label: "舞台変形", icon: "🏟️", action: onStageShape },
        { label: "大道具追加", icon: "🪑", action: onSetPiece },
      ],
    },
    {
      title: "Timeline",
      icon: "🎵",
      items: [
        { label: "音源追加", icon: "🎵", action: onAudioImport },
        { label: "AI提案", icon: "✨", action: onAiSuggest },
        { label: "名簿取込", icon: "📄", action: onRosterImport },
      ],
    },
    {
      title: "Team",
      icon: "👥",
      items: [
        { label: "メンバー表示", icon: "👤", action: onMemberList },
        { label: "メンバー追加", icon: "➕", action: onMemberAdd },
        { label: "閲覧共有", icon: "🔗", action: onShareLinks },
      ],
    },
    {
      title: "Settings",
      icon: "⚙️",
      items: [
        { label: "エクスポート", icon: "📤", action: onViewerList },
        { label: "ヘルプ", icon: "❓", action: onHelp },
      ],
    },
  ];

  const handleMenuItemTap = useCallback((action: () => void) => {
    action();
    setMenuOpen(false);
  }, []);

  return (
    <div className={styles.bar}>
      <PortraitWaveTransport
        audioUrl={audioUrl}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={onPlayPause}
        onStop={onStop}
        onSeek={onSeek}
      />

      <div className={styles.toolbarRow}>
        <button
          className={styles.menuBtn}
          onClick={() => setMenuOpen(true)}
          aria-label="メニューを開く"
          aria-expanded={menuOpen}
        >
          <span className={styles.menuBtnIcon}>☰</span>
          <span className={styles.menuBtnLabel}>Menu</span>
        </button>
        <button
          className={styles.histBtn}
          onClick={onUndo}
          disabled={undoDisabled}
          aria-label="元に戻す"
        >
          ↩
        </button>
        <button
          className={styles.histBtn}
          onClick={onRedo}
          disabled={redoDisabled}
          aria-label="やり直す"
        >
          ↪
        </button>
        <div className={styles.cueNav}>
          <button
            className={styles.navArrow}
            onClick={onCuePrev}
            disabled={currentCueIndex === 0}
            aria-label="前のキュー"
          >
            ‹
          </button>
          <span className={styles.cueLabel}>
            {currentCueIndex + 1}/{totalCues}
          </span>
          <button
            className={styles.navArrow}
            onClick={onCueNext}
            disabled={currentCueIndex >= totalCues - 1}
            aria-label="次のキュー"
          >
            ›
          </button>
        </div>
        <button className={styles.addCueBtn} onClick={onAddCue}>
          ＋Cue
        </button>
      </div>

      {menuOpen && (
        <>
          <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
          <div className={styles.menuSheet} role="dialog" aria-label="メニュー">
            <div className={styles.menuSheetHeader}>
              <span className={styles.menuSheetTitle}>Menu</span>
              <button
                className={styles.menuSheetClose}
                onClick={() => setMenuOpen(false)}
                aria-label="メニューを閉じる"
              >
                ✕
              </button>
            </div>
            <div className={styles.menuContent}>
              {MENU_SECTIONS.map((section) => (
                <div key={section.title} className={styles.menuSection}>
                  <div className={styles.menuSectionTitle}>
                    <span>{section.icon}</span> {section.title}
                  </div>
                  <div className={styles.menuGrid}>
                    {section.items.map((item) => (
                      <button
                        key={item.label}
                        className={styles.menuItem}
                        onClick={() => handleMenuItemTap(item.action)}
                      >
                        <span className={styles.menuItemIcon}>{item.icon}</span>
                        <span className={styles.menuItemLabel}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

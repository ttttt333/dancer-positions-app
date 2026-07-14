/**
 * PortraitBottomBar.tsx
 * 縦向き専用ボトム: 波形 / キューナビ / Menu + Undo-Redo / キュー削除
 */

import React, { useState } from "react";
import styles from "./PortraitBottomBar.module.css";
import ctrlStyles from "./TransportControls.module.css";
import {
  TransportIconChevronLeft,
  TransportIconChevronRight,
  TransportIconRedo,
  TransportIconUndo,
} from "./TransportIcons";
import { useMobileShellBridgeStore } from "../../store/useMobileShellBridgeStore";
import { PortraitWaveTransport } from "./PortraitWaveTransport";
import { MobileMenuSheet } from "./MobileMenuSheet";

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
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const onUndo = useMobileShellBridgeStore((s) => s.onUndo);
  const onRedo = useMobileShellBridgeStore((s) => s.onRedo);
  const undoDisabled = useMobileShellBridgeStore((s) => s.undoDisabled);
  const redoDisabled = useMobileShellBridgeStore((s) => s.redoDisabled);
  const onDeleteSelectedCue = useMobileShellBridgeStore(
    (s) => s.onDeleteSelectedCue
  );
  const canDeleteSelectedCue = useMobileShellBridgeStore(
    (s) => s.canDeleteSelectedCue
  );

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
          className={`${ctrlStyles.btn} ${styles.toolbarCtrlBtn}`}
          onClick={onUndo}
          disabled={undoDisabled}
          aria-label="元に戻す"
        >
          <TransportIconUndo size={22} className={ctrlStyles.icon} />
        </button>
        <button
          className={`${ctrlStyles.btn} ${styles.toolbarCtrlBtn}`}
          onClick={onRedo}
          disabled={redoDisabled}
          aria-label="やり直す"
        >
          <TransportIconRedo size={22} className={ctrlStyles.icon} />
        </button>
        <div className={styles.cueNav}>
          <button
            className={`${ctrlStyles.btn} ${styles.cueNavBtn}`}
            onClick={onCuePrev}
            disabled={currentCueIndex === 0}
            aria-label="前のキュー"
          >
            <TransportIconChevronLeft size={22} className={ctrlStyles.icon} />
          </button>
          <span className={styles.cueLabel}>
            {currentCueIndex + 1}/{totalCues}
          </span>
          <button
            className={`${ctrlStyles.btn} ${styles.cueNavBtn}`}
            onClick={onCueNext}
            disabled={currentCueIndex >= totalCues - 1}
            aria-label="次のキュー"
          >
            <TransportIconChevronRight size={22} className={ctrlStyles.icon} />
          </button>
        </div>
        <button
          className={styles.deleteCueBtn}
          onClick={onDeleteSelectedCue}
          disabled={!canDeleteSelectedCue}
          title="選択中のキューを削除"
          aria-label="選択中のキューを削除"
        >
          削除
        </button>
      </div>

      {menuOpen ? (
        <MobileMenuSheet
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          variant="portrait"
        />
      ) : null}
    </div>
  );
};

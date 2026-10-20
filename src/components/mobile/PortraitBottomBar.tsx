/**
 * PortraitBottomBar.tsx
 * 縦向きボトム（FODI風）:
 * 上段: Undo/Redo · ±5s · キュー頁 · 削除
 * 中段: 再生 + 波形（再生バー固定・波形スライド）
 * 下段: Menu · 雛形 · 一気± · 微調整±（セーフエリアギリギリ）
 */

import React, { useRef, useState } from "react";
import styles from "./PortraitBottomBar.module.css";
import ctrlStyles from "./TransportControls.module.css";
import {
  TransportIconChevronLeft,
  TransportIconChevronRight,
  TransportIconRedo,
  TransportIconSkipBack,
  TransportIconSkipForward,
  TransportIconUndo,
  TransportIconWaveZoomBig,
  TransportIconWaveZoomFit,
  TransportIconZoomIn,
  TransportIconZoomOut,
} from "./TransportIcons";
import { useMobileShellBridgeStore } from "../../store/useMobileShellBridgeStore";
import {
  PortraitWaveTransport,
  type PortraitWaveTransportHandle,
} from "./PortraitWaveTransport";
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
  const waveRef = useRef<PortraitWaveTransportHandle>(null);

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
  const onFormationChange = useMobileShellBridgeStore((s) => s.onFormationChange);
  const showFormationChange = useMobileShellBridgeStore(
    (s) => s.showFormationChange
  );

  const transportDisabled = !audioUrl;

  return (
    <div className={styles.bar}>
      {/* 上段: 履歴 · シーク · キュー頁 · 削除 */}
      <div className={styles.editRow} role="toolbar" aria-label="編集・キュー操作">
        <button
          className={`${ctrlStyles.btn} ${styles.editBtn}`}
          onClick={onUndo}
          disabled={undoDisabled}
          aria-label="元に戻す"
          title="元に戻す"
        >
          <TransportIconUndo size={20} className={ctrlStyles.icon} />
        </button>
        <button
          className={`${ctrlStyles.btn} ${styles.editBtn}`}
          onClick={onRedo}
          disabled={redoDisabled}
          aria-label="やり直す"
          title="やり直す"
        >
          <TransportIconRedo size={20} className={ctrlStyles.icon} />
        </button>
        <button
          className={`${ctrlStyles.btn} ${ctrlStyles.skipBtn} ${styles.editBtn}`}
          onClick={() => waveRef.current?.skipBack()}
          disabled={transportDisabled}
          aria-label="5秒戻す"
          title="5秒戻す"
        >
          <TransportIconSkipBack size={18} className={ctrlStyles.icon} />
          <span className={ctrlStyles.skipBadge}>5</span>
        </button>
        <button
          className={`${ctrlStyles.btn} ${ctrlStyles.skipBtn} ${styles.editBtn}`}
          onClick={() => waveRef.current?.skipForward()}
          disabled={transportDisabled}
          aria-label="5秒進める"
          title="5秒進める"
        >
          <TransportIconSkipForward size={18} className={ctrlStyles.icon} />
          <span className={ctrlStyles.skipBadge}>5</span>
        </button>
        <div className={styles.cueNav}>
          <button
            className={`${ctrlStyles.btn} ${styles.cueNavBtn}`}
            onClick={onCuePrev}
            disabled={currentCueIndex === 0}
            aria-label="前のキュー"
          >
            <TransportIconChevronLeft size={20} className={ctrlStyles.icon} />
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
            <TransportIconChevronRight size={20} className={ctrlStyles.icon} />
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

      {/* 中段: 再生 + 波形 */}
      <PortraitWaveTransport
        ref={waveRef}
        fodiChrome
        audioUrl={audioUrl}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={onPlayPause}
        onStop={onStop}
        onSeek={onSeek}
      />

      {/* 下段: Menu · 雛形 · 一気± · 微調整±（セーフエリア直上） */}
      <div className={styles.menuBar} role="toolbar" aria-label="メニューと波形ズーム">
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
          className={styles.changeBtn}
          onClick={() => onFormationChange?.()}
          disabled={!showFormationChange || !onFormationChange}
          aria-label="立ち位置の雛形を選ぶ"
          title="雛形（Change）"
        >
          <span className={styles.changeBtnIcon} aria-hidden>
            ◆
          </span>
          <span className={styles.changeBtnLabel}>雛形</span>
        </button>
        <button
          className={`${ctrlStyles.btn} ${styles.zoomBtn}`}
          onClick={() => waveRef.current?.zoomToSelectedCue()}
          disabled={transportDisabled}
          aria-label="選択キューを調整しやすい大きさに拡大"
          title="一気に拡大"
        >
          <TransportIconWaveZoomBig size={18} className={ctrlStyles.icon} />
        </button>
        <button
          className={`${ctrlStyles.btn} ${styles.zoomBtn}`}
          onClick={() => waveRef.current?.zoomToFit()}
          disabled={transportDisabled}
          aria-label="波形を全体表示"
          title="一気に縮小（全体）"
        >
          <TransportIconWaveZoomFit size={18} className={ctrlStyles.icon} />
        </button>
        <button
          className={`${ctrlStyles.btn} ${styles.zoomBtn}`}
          onClick={() => waveRef.current?.zoomIn()}
          disabled={transportDisabled}
          aria-label="波形を拡大"
          title="微調整で拡大"
        >
          <TransportIconZoomIn size={18} className={ctrlStyles.icon} />
        </button>
        <button
          className={`${ctrlStyles.btn} ${styles.zoomBtn}`}
          onClick={() => waveRef.current?.zoomOut()}
          disabled={transportDisabled}
          aria-label="波形を縮小"
          title="微調整で縮小"
        >
          <TransportIconZoomOut size={18} className={ctrlStyles.icon} />
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

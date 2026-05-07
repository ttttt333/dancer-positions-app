/**
 * MobileEditorShell — モバイルエディタのメインコンテナ
 *
 * Portrait: stage flex:1 → timeline(波形+再生) ~72px → bottomtab 56px+safe
 * Landscape: stage 60% left | right panel 40% scrollable
 *
 * スワイプ: stage上の横スワイプ = 前後キュー切替（ハプティクスあり）
 */
import { useState, useRef, useCallback, type ReactNode } from "react";
import type { EditorStageWorkbenchProps } from "../EditorStageWorkbench";
import { EditorStageWorkbench } from "../EditorStageWorkbench";
import { sortCuesByStart } from "../../lib/cueInterval";
import { shell } from "../../theme/choreoShell";

import { MobileBottomTabBar, type MobileTab } from "./MobileBottomTabBar";
import { MobileToolSheet } from "./MobileToolSheet";
import { MobileCueList } from "./MobileCueList";

// ── Types ──────────────────────────────────────────────────────────────────

export type MobileEditorShellProps = {
  /** 全 workbench プロップ (layout 以外) */
  workbenchProps: Omit<EditorStageWorkbenchProps, "layout">;
  /** ステージキャンバス要素（StageBoard JSX を親から渡す） */
  stageEl: ReactNode;
  /**
   * タイムラインパネル要素（波形＋再生コントロール）。
   * TimelinePanel compactTopDock=true editorMobileStack=false で渡す。
   */
  timelinePanelEl: ReactNode;
  /** 横向き判定 */
  landscape: boolean;
  /** キュー選択 */
  selectedCueId: string | null;
  setSelectedCueId: (id: string | null) => void;
  /** キュー追加ダイアログを開く */
  onAddCue: () => void;
  /** view モードのとき true */
  isView?: boolean;
};

// ── Haptics helper ─────────────────────────────────────────────────────────

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignore
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function MobileEditorShell({
  workbenchProps,
  stageEl,
  timelinePanelEl,
  landscape,
  selectedCueId,
  setSelectedCueId,
  onAddCue,
  isView = false,
}: MobileEditorShellProps) {
  const { project } = workbenchProps;

  // Sorted cues (for swipe navigation)
  const sortedCues = sortCuesByStart(project.cues);

  // Tab state
  const [activeTab, setActiveTab] = useState<MobileTab>("stage");
  const [toolSheetOpen, setToolSheetOpen] = useState(false);

  const handleTabChange = (tab: MobileTab) => {
    if (tab === "more") {
      const nextOpen = !toolSheetOpen;
      setToolSheetOpen(nextOpen);
      setActiveTab(nextOpen ? "more" : "stage");
    } else {
      setToolSheetOpen(false);
      setActiveTab(tab);
    }
  };

  const closeSheet = useCallback(() => {
    setToolSheetOpen(false);
    setActiveTab("stage");
  }, []);

  // ── Swipe to change cue ─────────────────────────────────────────────────
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 48;
  const SWIPE_MAX_Y = 60;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (swipeStartX.current === null || swipeStartY.current === null) return;
      const dx = e.changedTouches[0].clientX - swipeStartX.current;
      const dy = e.changedTouches[0].clientY - swipeStartY.current;
      swipeStartX.current = null;
      swipeStartY.current = null;

      if (Math.abs(dy) > SWIPE_MAX_Y) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      const idx = selectedCueId
        ? sortedCues.findIndex((c) => c.id === selectedCueId)
        : -1;

      if (dx < 0) {
        const nextIdx = idx + 1;
        if (nextIdx < sortedCues.length) {
          setSelectedCueId(sortedCues[nextIdx].id);
          vibrate(10);
        }
      } else {
        const prevIdx = idx - 1;
        if (prevIdx >= 0) {
          setSelectedCueId(sortedCues[prevIdx].id);
          vibrate(10);
        }
      }
    },
    [selectedCueId, sortedCues, setSelectedCueId]
  );

  // ── Landscape layout ──────────────────────────────────────────────────
  if (landscape) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: "100%",
          background: shell.bgDeep,
          overflow: "hidden",
        }}
      >
        {/* Stage area — 60% */}
        <div
          style={{
            flex: "0 0 60%",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Canvas */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
            {stageEl}
          </div>

          {/* Timeline: waveform + playback (compact) */}
          <div style={{ flexShrink: 0, overflow: "hidden" }}>
            {timelinePanelEl}
          </div>
        </div>

        {/* Right panel — 40% */}
        <div
          style={{
            flex: "0 0 40%",
            display: "flex",
            flexDirection: "column",
            borderLeft: `1px solid ${shell.border}`,
            minWidth: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            background: shell.surface,
          }}
        >
          <EditorStageWorkbench
            key="mobile-rail-land"
            layout="rail"
            {...workbenchProps}
            hideUndoRedoInRail={false}
          />
        </div>
      </div>
    );
  }

  // ── Portrait layout ───────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: shell.bgDeep,
        overflow: "hidden",
      }}
    >
      {/* Stage — always mounted, toggled via display */}
      <div
        style={{
          flex: activeTab === "stage" ? 1 : 0,
          minHeight: 0,
          display: activeTab === "stage" ? "flex" : "none",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {stageEl}
      </div>

      {/* Cue list tab */}
      {activeTab === "cues" && (
        <MobileCueList
          cues={project.cues}
          selectedCueId={selectedCueId}
          onSelectCue={(id) => {
            setSelectedCueId(id);
            setActiveTab("stage");
          }}
          onAddCue={() => {
            onAddCue();
            setActiveTab("stage");
          }}
          isView={isView}
        />
      )}

      {/* Timeline strip (waveform + playback controls) — shown only on stage tab */}
      <div
        style={{
          flexShrink: 0,
          overflow: "hidden",
          display: activeTab === "stage" ? "block" : "none",
        }}
      >
        {timelinePanelEl}
      </div>

      {/* Bottom tab bar */}
      <MobileBottomTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAdd={onAddCue}
        isView={isView}
      />

      {/* Tool sheet overlay */}
      <MobileToolSheet
        open={toolSheetOpen}
        onClose={closeSheet}
        workbenchProps={workbenchProps}
      />
    </div>
  );
}

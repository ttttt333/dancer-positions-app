/**
 * MobileEditorShell — モバイルエディタのメインコンテナ
 *
 * Portrait: header 44px → stage flex:1(~65%) → waveform 52px → playbar 60px → bottomtab 56px+safe
 * Landscape: stage 60% left | right panel 40% scrollable
 *
 * スワイプ: stage上の横スワイプ = 前後キュー切替（ハプティクスあり）
 */
import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import type { ChoreographyProjectJson, Cue } from "../../types/choreography";
import type { EditorStageWorkbenchProps } from "../EditorStageWorkbench";
import { EditorStageWorkbench } from "../EditorStageWorkbench";
import { sortCuesByStart } from "../../lib/cueInterval";
import { shell } from "../../theme/choreoShell";
import { usePlaybackUiStore } from "../../store/usePlaybackUiStore";
import { useTimelinePlayback } from "../../hooks/useTimelinePlayback";

import { MobilePlaybar } from "./MobilePlaybar";
import { MobileBottomTabBar, type MobileTab } from "./MobileBottomTabBar";
import { MobileToolSheet } from "./MobileToolSheet";
import { MobileCueList } from "./MobileCueList";

// ── Types ──────────────────────────────────────────────────────────────────

export type MobileEditorShellProps = {
  /** 全 workbench プロップ (layout 以外) */
  workbenchProps: Omit<EditorStageWorkbenchProps, "layout">;
  /** タイムラインパネル要素（波形・再生 UI をマウントしたまま渡す） */
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
  timelinePanelEl,
  landscape,
  selectedCueId,
  setSelectedCueId,
  onAddCue,
  isView = false,
}: MobileEditorShellProps) {
  const { project } = workbenchProps;

  // Playback state from store
  const currentTime = usePlaybackUiStore((s) => s.currentTimeSec);
  const isPlaying = usePlaybackUiStore((s) => s.isPlaying);
  const duration = usePlaybackUiStore((s) => s.durationSec);

  // Playback controls
  const { togglePlay, stopPlayback, seekForward5Sec, seekBackward5Sec } =
    useTimelinePlayback({
      durationSec: duration,
      trimStartSec: project.trimStartSec ?? 0,
      trimEndSec: project.trimEndSec ?? null,
    });

  const hasAudio = duration > 0;

  // Sorted cues
  const sortedCues = sortCuesByStart(project.cues);

  // Tab state
  const [activeTab, setActiveTab] = useState<MobileTab>("stage");
  const [toolSheetOpen, setToolSheetOpen] = useState(false);

  // When MORE tab is pressed, toggle tool sheet
  const handleTabChange = (tab: MobileTab) => {
    if (tab === "more") {
      setToolSheetOpen((prev) => !prev);
      setActiveTab(toolSheetOpen ? "stage" : "more");
    } else {
      setToolSheetOpen(false);
      setActiveTab(tab);
    }
  };

  // Close sheet → go back to stage
  const closeSheet = useCallback(() => {
    setToolSheetOpen(false);
    setActiveTab("stage");
  }, []);

  // ── Swipe to change cue ─────────────────────────────────────────────────
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 48;
  const SWIPE_MAX_Y = 60; // ignore if mostly vertical

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

      if (Math.abs(dy) > SWIPE_MAX_Y) return; // vertical scroll
      if (Math.abs(dx) < SWIPE_THRESHOLD) return; // too short

      const idx = selectedCueId
        ? sortedCues.findIndex((c) => c.id === selectedCueId)
        : -1;

      if (dx < 0) {
        // swipe left = next cue
        const nextIdx = idx + 1;
        if (nextIdx < sortedCues.length) {
          setSelectedCueId(sortedCues[nextIdx].id);
          vibrate(10);
        }
      } else {
        // swipe right = previous cue
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
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <EditorStageWorkbench key="mobile-stage-land" layout="stage" {...workbenchProps} />
          </div>

          {/* Waveform (always mounted, compact height) */}
          <div
            style={{
              height: 52,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {timelinePanelEl}
          </div>

          {/* Playbar */}
          <MobilePlaybar
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            hasAudio={hasAudio}
            isView={isView}
            togglePlay={togglePlay}
            stopPlayback={stopPlayback}
            seekForward5Sec={seekForward5Sec}
            seekBackward5Sec={seekBackward5Sec}
          />
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
          <EditorStageWorkbench key="mobile-rail-land" layout="rail" {...workbenchProps} hideUndoRedoInRail={false} />
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
      {/* Stage area */}
      {activeTab === "stage" && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <EditorStageWorkbench key="mobile-stage-port" layout="stage" {...workbenchProps} />
        </div>
      )}

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
          currentTime={currentTime}
        />
      )}

      {/* Waveform strip (always mounted but compact) */}
      <div
        style={{
          height: activeTab === "stage" ? 52 : 0,
          overflow: "hidden",
          flexShrink: 0,
          transition: "height 0.18s ease",
        }}
      >
        {timelinePanelEl}
      </div>

      {/* Playbar */}
      <MobilePlaybar
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        hasAudio={hasAudio}
        isView={isView}
        togglePlay={togglePlay}
        stopPlayback={stopPlayback}
        seekForward5Sec={seekForward5Sec}
        seekBackward5Sec={seekBackward5Sec}
      />

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

import { preloadFFmpeg } from "../lib/extractVideoAudio";
import { TimelineAudioChrome } from "./TimelineAudioChrome";
import type { TimelineAudioChromeProps } from "./TimelineAudioChrome";
import { TimelineCueList } from "./TimelineCueList";
import type { TimelineCueListProps } from "./TimelineCueList";
import { TimelineToolbar, tlPx } from "./TimelineToolbar";
import type { TimelineToolbarProps } from "./TimelineToolbar";
import { TimelineWaveMenus } from "./TimelineWaveMenus";
import type { TimelineWaveMenusProps } from "./TimelineWaveMenus";
import { WaveformStrip } from "./WaveformStrip";
import type { WaveformStripProps } from "./WaveformStrip";

export type TimelinePanelLayoutProps = Omit<
  TimelineAudioChromeProps,
  "onPreloadFfmpegPointer"
> &
  WaveformStripProps &
  TimelineToolbarProps &
  TimelineCueListProps &
  TimelineWaveMenusProps & {
    /** true のとき EditorPage 側で `<TimelineAudioChrome>` を描画済み */
    audioChromeRenderedExternally?: boolean;
  };

/**
 * `TimelinePanel` の見た目レイヤー：音源 chrome・ツールバー・波形・キュー一覧・波形オーバーレイメニュー。
 */
export function TimelinePanelLayout(p: TimelinePanelLayoutProps) {
  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: p.compactTopDock ? 0 : tlPx(4),
          minHeight: 0,
          flex: "1 1 auto",
          height: p.compactTopDock ? "100%" : undefined,
          overflow: p.compactTopDock ? "hidden" : undefined,
          fontSize:
            p.compactTopDock && p.editorMobileStack
              ? tlPx(10)
              : p.compactTopDock
                ? tlPx(11)
                : tlPx(12),
        }}
      >
        {!p.audioChromeRenderedExternally ? (
          <TimelineAudioChrome
            audioFileInputRef={p.audioFileInputRef}
            extractProgress={p.extractProgress}
            onPickAudio={p.onPickAudio}
            onPreloadFfmpegPointer={() => {
              void preloadFFmpeg();
            }}
          />
        ) : null}
        <TimelineToolbar
          compactTopDock={p.compactTopDock}
          brandRailCss={p.brandRailCss}
          wideWorkbench={p.wideWorkbench}
          waveTimelineDockTop={p.waveTimelineDockTop}
          onWaveTimelineDockTopChange={p.onWaveTimelineDockTopChange}
          viewMode={p.viewMode}
          duration={p.duration}
          isPlaying={p.isPlaying}
          currentTime={p.currentTime}
          togglePlay={p.togglePlay}
          stopPlayback={p.stopPlayback}
          seekForward5Sec={p.seekForward5Sec}
          seekBackward5Sec={p.seekBackward5Sec}
          onSave={p.onSave}
          onOpenAudioImport={p.onOpenAudioImport}
          onUndo={p.onUndo}
          onRedo={p.onRedo}
          undoDisabled={p.undoDisabled}
          redoDisabled={p.redoDisabled}
          editorMobileStack={p.editorMobileStack}
          compactDockLeading={p.compactDockLeading}
        />
        <div
          style={{
            flex: p.compactTopDock ? "1 1 auto" : undefined,
            minHeight: p.compactTopDock ? 0 : undefined,
            overflow: p.compactTopDock ? "hidden" : undefined,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <WaveformStrip
          waveContainerRef={p.waveContainerRef}
          canvasRef={p.canvasRef}
          playheadLineOverlayRef={p.playheadLineOverlayRef}
          compactTopDock={p.compactTopDock}
          wideWorkbench={p.wideWorkbench}
          duration={p.duration}
          viewMode={p.viewMode}
          hasPeaks={p.hasPeaks}
          waveView={p.waveView}
          waveCanvasCssH={p.waveCanvasCssH}
          showWaveHeightResizeHandle={!(p.compactTopDock && p.wideWorkbench)}
          onWaveRulerPointerDown={p.onWaveRulerPointerDown}
          onWaveClick={p.onWaveClick}
          onWaveDoubleClick={p.onWaveDoubleClick}
          onWaveContextMenu={p.onWaveContextMenu}
          onWaveCanvasPointerDown={p.onWaveCanvasPointerDown}
          onWaveCanvasPointerMove={p.onWaveCanvasPointerMove}
          onWaveCanvasPointerLeave={p.onWaveCanvasPointerLeave}
          onWaveBorderResizePointerDown={p.onWaveBorderResizePointerDown}
          onPlayheadLinePointerDown={p.onPlayheadLinePointerDown}
          onPlayheadLinePointerMove={p.onPlayheadLinePointerMove}
          onPlayheadLinePointerUp={p.onPlayheadLinePointerUp}
          onPlayheadLinePointerCancel={p.onPlayheadLinePointerCancel}
        />
        </div>
        <TimelineCueList
          cuesSorted={p.cuesSorted}
          formations={p.formations}
          viewMode={p.viewMode}
          selectedCueIds={p.selectedCueIds}
          onSelectedCueIdsChange={p.onSelectedCueIdsChange}
          updateCue={p.updateCue}
          adjustFormationDancerCount={p.adjustFormationDancerCount}
          duplicateCueSameSettings={p.duplicateCueSameSettings}
          removeCue={p.removeCue}
          compactTopDock={p.compactTopDock}
          cueListPortalTarget={p.cueListPortalTarget}
        />
      </div>
      <TimelineWaveMenus
        viewMode={p.viewMode}
        currentTime={p.currentTime}
        cuesSorted={p.cuesSorted}
        setProject={p.setProject}
        waveCueMenu={p.waveCueMenu}
        setWaveCueMenu={p.setWaveCueMenu}
        gapRouteMenu={p.gapRouteMenu}
        setGapRouteMenu={p.setGapRouteMenu}
        waveCueConfirm={p.waveCueConfirm}
        setWaveCueConfirm={p.setWaveCueConfirm}
        splitCueAtPlayhead={p.splitCueAtPlayhead}
        removeCue={p.removeCue}
        duplicateCueAfterSource={p.duplicateCueAfterSource}
        duplicateCueAtTimelineEnd={p.duplicateCueAtTimelineEnd}
        saveCueFormationToBoxList={p.saveCueFormationToBoxList}
        onOpenPathEditor={p.onOpenPathEditor}
      />
    </>
  );
}

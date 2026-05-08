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

/** 波形枠に付与するブラウザ title（ホイール・目盛り・リサイズ等） */
const WAVE_CHROME_TITLE =
  "波形上でマウスホイール（またはトラックパッドの縦スクロール）で時間軸の拡大・縮小。上の秒数目盛りをクリックすると再生位置だけ移動します（一時停止中は再生ボタンやスペースキーで再生）。下の枠線付近をドラッグすると波形の縦の高さを変えられます。赤い縦線付近をドラッグすると再生位置を移動できます。金枠のキュー同士の間に出る白いブロックを右クリックするか Alt+クリックすると、その先のキューへの立ち位置の入り方を選べます。";

export type TimelinePanelLayoutProps = Omit<
  TimelineAudioChromeProps,
  "onPreloadFfmpegPointer"
> &
  Omit<WaveformStripProps, "chromeTitle"> &
  TimelineToolbarProps &
  TimelineCueListProps &
  TimelineWaveMenusProps;

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
          fontSize:
            p.compactTopDock && p.editorMobileStack
              ? tlPx(10)
              : p.compactTopDock
                ? tlPx(11)
                : tlPx(12),
        }}
      >
        <TimelineAudioChrome
          audioFileInputRef={p.audioFileInputRef}
          extractProgress={p.extractProgress}
          onPickAudio={p.onPickAudio}
          onPreloadFfmpegPointer={() => {
            void preloadFFmpeg();
          }}
        />
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
          onUndo={p.onUndo}
          onRedo={p.onRedo}
          undoDisabled={p.undoDisabled}
          redoDisabled={p.redoDisabled}
          editorMobileStack={p.editorMobileStack}
          compactDockLeading={p.compactDockLeading}
        />
        <WaveformStrip
          waveContainerRef={p.waveContainerRef}
          canvasRef={p.canvasRef}
          playheadLineOverlayRef={p.playheadLineOverlayRef}
          compactTopDock={p.compactTopDock}
          duration={p.duration}
          viewMode={p.viewMode}
          hasPeaks={p.hasPeaks}
          waveView={p.waveView}
          waveCanvasCssH={p.waveCanvasCssH}
          chromeTitle={WAVE_CHROME_TITLE}
          onWaveRulerPointerDown={p.onWaveRulerPointerDown}
          onWaveClick={p.onWaveClick}
          onWaveDoubleClick={p.onWaveDoubleClick}
          onWaveContextMenu={p.onWaveContextMenu}
          onWaveCanvasPointerDown={p.onWaveCanvasPointerDown}
          onWaveCanvasPointerMove={p.onWaveCanvasPointerMove}
          onWaveCanvasPointerLeave={p.onWaveCanvasPointerLeave}
          onWaveBorderResizePointerDown={p.onWaveBorderResizePointerDown}
        />
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
      />
    </>
  );
}

import {
  forwardRef,
  useState,
} from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import { TimelinePanelLayout } from "./TimelinePanelLayout";
import { useTimelineAudio } from "../hooks/useTimelineAudio";
import { useTimelinePlayback } from "../hooks/useTimelinePlayback";
import { useTimelineWaveSurfaceHandlers } from "../hooks/useTimelineWaveSurfaceHandlers";
import { useTimelineCueActions } from "../hooks/useTimelineCueActions";
import { useTimelineWaveCanvasActions } from "../hooks/useTimelineWaveCanvasActions";
import { useTimelineWaveHeightDrag } from "../hooks/useTimelineWaveHeightDrag";
import { useTimelineWaveWheelZoom } from "../hooks/useTimelineWaveWheelZoom";
import { useTimelineWaveViewport } from "../hooks/useTimelineWaveViewport";
import { useTimelineWaveMenuState } from "../hooks/useTimelineWaveMenuState";
import { useTimelineDeleteSelectedCuesOnKey } from "../hooks/useTimelineDeleteSelectedCuesOnKey";
import { useTimelinePanelImperativeHandle } from "../hooks/useTimelinePanelImperativeHandle";
import { useTimelinePanelProjectSlice } from "../hooks/useTimelinePanelProjectSlice";
import { useTimelinePlaybackUi } from "../hooks/useTimelinePlaybackUi";
import { useTimelineWaveCanvasModel } from "../hooks/useTimelineWaveCanvasModel";
import { useTimelineWaveDockLayout } from "../hooks/useTimelineWaveDockLayout";
import { useTimelineUnmountStagePreviewClear } from "../hooks/useTimelineUnmountStagePreviewClear";

export type TimelinePanelHandle = {
  togglePlay: () => void;
  /** 仕様 §5: 再生中ステージクリックなどと同じ「停止」（一時停止＋先頭付近へ） */
  stopPlayback: () => void;
  /** 音源ファイル選択ダイアログを開く（エディタ上部ツールバー用） */
  openAudioImport: () => void;
  /** フローライブラリ保存用。現在の波形ピーク（無ければ null） */
  getWavePeaksSnapshot: () => number[] | null;
  /** フロー読み込み後に保存済みピークを即反映（decode を待たない） */
  restoreWavePeaks: (peaks: number[], durationSec?: number) => void;
  /**
   * フロー保存: 現在 `<audio>` の音源を Blob 化（未設定・取得失敗時は null）
   */
  getCurrentAudioBlobForFlowLibrary: () => Promise<Blob | null>;
};

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  serverProjectId: number | null;
  loggedIn: boolean;
  /** キュー追加ウィザードで案を選ぶとステージに即プレビュー（閉じると null） */
  onStagePreviewChange?: (dancers: DancerSpot[] | null) => void;
  /**
   * キュー一覧でページ切替などした直後。親で activeFormationId は既に更新済み想定。
   */
  onFormationChosenFromCueList?: () => void;
  /** 編集の元に戻す（ステージツールバーの「戻る」と同じ） */
  onUndo?: () => void;
  /** 編集のやり直し（ステージの「進む」と同じ） */
  onRedo?: () => void;
  undoDisabled?: boolean;
  redoDisabled?: boolean;
  /** ChoreoCore: 波形・一覧で選択中のキュー（複数可）。書き込み先は末尾を主として使う想定。 */
  selectedCueIds: string[];
  onSelectedCueIdsChange: Dispatch<SetStateAction<string[]>>;
  /** 「現在位置にキュー追加」時に複製する元フォーメーション */
  formationIdForNewCue: string;
  /** ワイド編集幅のとき、タイムラインを画面上部へドックする切替を表示する */
  wideWorkbench?: boolean;
  waveTimelineDockTop?: boolean;
  onWaveTimelineDockTopChange?: (next: boolean) => void;
  /**
   * タイムラインを画面上部ドック時のコンパクト表示。
   * - キュー一覧は `cueListPortalTarget` が指定されていれば
   *   そこにポータルで描画する（右列に切り出すため）
   */
  compactTopDock?: boolean;
  /** `compactTopDock` の時、キュー一覧を描画するポータル先 DOM 要素 */
  cueListPortalTarget?: HTMLElement | null;
  /** 上部ツールバーの「保存」ボタン押下コールバック（立ち位置保存ダイアログを開く） */
  onSave?: () => void;
};

export const TimelinePanel = forwardRef<TimelinePanelHandle, Props>(
  function TimelinePanel(
    {
      project,
      setProject,
      serverProjectId,
      loggedIn,
      onStagePreviewChange,
      onFormationChosenFromCueList,
      onUndo,
      onRedo,
      undoDisabled = true,
      redoDisabled = true,
      selectedCueIds,
      onSelectedCueIdsChange,
      formationIdForNewCue,
      wideWorkbench = false,
      waveTimelineDockTop = false,
      onWaveTimelineDockTopChange,
      compactTopDock = false,
      cueListPortalTarget = null,
      onSave,
    },
    ref
  ) {
    const {
      currentTime,
      setCurrentTime,
      isPlaying,
      duration,
      setDuration,
      setPlaybackTrustedDurationSec,
    } = useTimelinePlaybackUi();
    const [peaks, setPeaks] = useState<number[] | null>(null);
    const {
      viewPortion,
      setViewPortion,
      viewPortionRef,
      setWaveViewStartOverride,
      waveViewStartOverrideRef,
      waveView,
    } = useTimelineWaveViewport({
      peaks,
      duration,
      currentTime,
      isPlaying,
    });
    const {
      brandRailCss,
      waveCanvasCssH,
      setWaveCanvasCssH,
      waveCanvasCssHRef,
    } = useTimelineWaveDockLayout({ wideWorkbench, compactTopDock });

    const { cuesSorted, trimStartSec, trimEndSec, formations } =
      useTimelinePanelProjectSlice(project);

    const {
      canvasRef,
      playheadLineOverlayRef,
      waveContainerRef,
      peaksRef,
      durationRef,
      trimRef,
      currentTimePropRef,
      cuesRef,
      selectedCueIdsRef,
      lastWaveDrawRangeRef,
      cueDragRef,
      cueDragPreviewRangeRef,
      newCueRangePreviewRef,
      emptyWaveDragRef,
      suppressNextWaveSeekRef,
      playheadScrubDragRef,
      waveHoverCueRef,
      isPlayingForWaveRef,
      drawWaveformAt,
    } = useTimelineWaveCanvasModel({
      peaks,
      duration,
      currentTime,
      isPlaying,
      viewPortion,
      viewPortionRef,
      waveViewStartOverrideRef,
      trimStartSec,
      trimEndSec,
      cuesSorted,
      selectedCueIds,
      waveformAmplitudeScale: project.waveformAmplitudeScale,
      wideWorkbench,
      waveCanvasCssH,
    });

    const {
      waveCueMenu,
      setWaveCueMenu,
      gapRouteMenu,
      setGapRouteMenu,
      waveCueConfirm,
      setWaveCueConfirm,
    } = useTimelineWaveMenuState();

    useTimelineDeleteSelectedCuesOnKey({
      viewMode: project.viewMode,
      selectedCueIdsRef,
      setProject,
      onSelectedCueIdsChange,
    });

    /** 音源: 波形デコード・ファイル／動画インポート・API／Supabase／フロー同期（内部で blob URL を保持） */
    const {
      extractProgress,
      audioFileInputRef,
      onPickAudio,
      openAudioImport,
    } = useTimelineAudio({
      setProject,
      setPeaks,
      loggedIn,
      serverProjectId,
      audioAssetId: project.audioAssetId,
      audioSupabasePath: project.audioSupabasePath,
      flowLocalAudioKey: project.flowLocalAudioKey,
    });

    useTimelineWaveWheelZoom({
      waveContainerRef,
      durationRef,
      lastWaveDrawRangeRef,
      isPlayingForWaveRef,
      setViewPortion,
      setWaveViewStartOverride,
    });

    const { onWaveBorderResizePointerDown } = useTimelineWaveHeightDrag({
      projectViewMode: project.viewMode,
      waveCanvasCssHRef,
      setWaveCanvasCssH,
    });

    const { togglePlay, seekForward5Sec, seekBackward5Sec, stopPlayback } =
      useTimelinePlayback({
        durationSec: duration,
        trimStartSec,
        trimEndSec,
      });

    useTimelinePanelImperativeHandle({
      ref,
      peaksRef,
      setPeaks,
      setDuration,
      setPlaybackTrustedDurationSec,
      togglePlay,
      stopPlayback,
      openAudioImport,
    });

    useTimelineUnmountStagePreviewClear(onStagePreviewChange);

    const {
      addCueStartingAtTime,
      removeCue,
      updateCue,
      duplicateCueSameSettings,
      duplicateCueAtTimelineEnd,
      duplicateCueAfterSource,
      splitCueAtPlayhead,
      saveCueFormationToBoxList,
      adjustFormationDancerCount,
    } = useTimelineCueActions({
      project,
      setProject,
      durationRef,
      currentTime,
      onSelectedCueIdsChange,
      onFormationChosenFromCueList,
      formationIdForNewCue,
      trimStartSec,
      trimEndSec,
    });

    const { onWaveClick, onWaveContextMenu, onWaveDoubleClick } =
      useTimelineWaveCanvasActions({
        suppressNextWaveSeekRef,
        canvasRef,
        duration,
        viewPortion,
        currentTime,
        lastWaveDrawRangeRef,
        peaks,
        cuesSorted,
        cueDragPreviewRangeRef,
        onSelectedCueIdsChange,
        viewMode: project.viewMode,
        trimStartSec,
        trimEndSec,
        setWaveCueMenu,
        setGapRouteMenu,
        setWaveCueConfirm,
        addCueStartingAtTime,
      });

    const {
      onWaveRulerPointerDown,
      onWaveCanvasPointerDown,
      onWaveCanvasPointerMove,
      onWaveCanvasPointerLeave,
    } = useTimelineWaveSurfaceHandlers({
      projectViewMode: project.viewMode,
      duration,
      peaks,
      canvasRef,
      lastWaveDrawRangeRef,
      waveViewStartOverrideRef,
      trimStartSec,
      trimEndSec,
      currentTimePropRef,
      isPlayingForWaveRef,
      viewPortionRef,
      drawWaveformAt,
      cuesSorted,
      cuesRef,
      cueDragRef,
      cueDragPreviewRangeRef,
      playheadScrubDragRef,
      emptyWaveDragRef,
      newCueRangePreviewRef,
      waveHoverCueRef,
      setCurrentTime,
      onSelectedCueIdsChange,
      suppressNextWaveSeekRef,
      setProject,
      durationRef,
      formationIdForNewCue,
      formations,
      onFormationChosenFromCueList,
      viewPortion,
      currentTime,
    });

    return (
      <TimelinePanelLayout
        audioFileInputRef={audioFileInputRef}
        extractProgress={extractProgress}
        onPickAudio={onPickAudio}
        compactTopDock={compactTopDock}
        brandRailCss={brandRailCss}
        wideWorkbench={wideWorkbench}
        waveTimelineDockTop={waveTimelineDockTop ?? false}
        onWaveTimelineDockTopChange={onWaveTimelineDockTopChange}
        viewMode={project.viewMode}
        duration={duration}
        isPlaying={isPlaying}
        currentTime={currentTime}
        togglePlay={togglePlay}
        stopPlayback={stopPlayback}
        seekForward5Sec={seekForward5Sec}
        seekBackward5Sec={seekBackward5Sec}
        onSave={onSave}
        onUndo={onUndo}
        onRedo={onRedo}
        undoDisabled={undoDisabled}
        redoDisabled={redoDisabled}
        waveContainerRef={waveContainerRef}
        canvasRef={canvasRef}
        playheadLineOverlayRef={playheadLineOverlayRef}
        hasPeaks={!!peaks}
        waveView={waveView}
        waveCanvasCssH={waveCanvasCssH}
        onWaveRulerPointerDown={onWaveRulerPointerDown}
        onWaveClick={onWaveClick}
        onWaveDoubleClick={onWaveDoubleClick}
        onWaveContextMenu={onWaveContextMenu}
        onWaveCanvasPointerDown={onWaveCanvasPointerDown}
        onWaveCanvasPointerMove={onWaveCanvasPointerMove}
        onWaveCanvasPointerLeave={onWaveCanvasPointerLeave}
        onWaveBorderResizePointerDown={onWaveBorderResizePointerDown}
        cuesSorted={cuesSorted}
        formations={formations}
        selectedCueIds={selectedCueIds}
        onSelectedCueIdsChange={onSelectedCueIdsChange}
        updateCue={updateCue}
        adjustFormationDancerCount={adjustFormationDancerCount}
        duplicateCueSameSettings={duplicateCueSameSettings}
        removeCue={removeCue}
        cueListPortalTarget={cueListPortalTarget}
        setProject={setProject}
        waveCueMenu={waveCueMenu}
        setWaveCueMenu={setWaveCueMenu}
        gapRouteMenu={gapRouteMenu}
        setGapRouteMenu={setGapRouteMenu}
        waveCueConfirm={waveCueConfirm}
        setWaveCueConfirm={setWaveCueConfirm}
        splitCueAtPlayhead={splitCueAtPlayhead}
        duplicateCueAfterSource={duplicateCueAfterSource}
        duplicateCueAtTimelineEnd={duplicateCueAtTimelineEnd}
        saveCueFormationToBoxList={saveCueFormationToBoxList}
      />
    );
  }
);

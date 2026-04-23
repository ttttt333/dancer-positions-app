import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, Dispatch, RefObject, SetStateAction } from "react";
import type { ChoreographyProjectJson, Cue, DancerSpot } from "../types/choreography";
import {
  cloneFormationForNewCue,
  resolveCueIntervalNonOverlap,
  sortCuesByStart,
} from "../lib/cueInterval";
import { fetchAuthorizedAudioBlobUrl, getToken, audioApiUpload } from "../api/client";
import {
  formatMmSs,
  formatMmSsClock,
  formatMmSsFloor,
  parseMmSsFlexible,
  waveRulerTicks,
} from "../lib/timeFormat";
import { dancersForLayoutPreset } from "../lib/formationLayouts";
import {
  extractAudioBufferFromVideoFile,
  mimeForExtractedVideoAudio,
  preloadFFmpeg,
} from "../lib/extractVideoAudio";
import { playCompletionWoof } from "../lib/playCompletionWoof";
import { btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";

/** タイムライン上部ツールバー用（再生・波形周りの縦スペース節約） */
const TIMELINE_UI_SCALE = 1.2;
function tlPx(n: number): string {
  return `${Math.round(n * TIMELINE_UI_SCALE * 10) / 10}px`;
}

const timelineToolbarBtn: CSSProperties = {
  ...btnSecondary,
  padding: `${tlPx(3)} ${tlPx(8)}`,
  fontSize: tlPx(11),
  borderRadius: tlPx(5),
  lineHeight: 1.2,
};

export type TimelinePanelHandle = {
  togglePlay: () => void;
  /** 仕様 §5: 再生中ステージクリックなどと同じ「停止」（一時停止＋先頭付近へ） */
  stopPlayback: () => void;
  /** 再生を止め、トリム内に収めて `tSec` へシーク（ステージのキュー切替用） */
  pauseAndSeekToSec: (tSec: number) => void;
  /** 音源ファイル選択ダイアログを開く（エディタ上部ツールバー用） */
  openAudioImport: () => void;
};

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  duration: number;
  setDuration: (d: number) => void;
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
  /** ChoreoGrid: 波形・一覧で選択中のキュー（複数可）。書き込み先は末尾を主として使う想定。 */
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
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** 波形キャンバス表示高さ（CSS px）。下枠ドラッグで変更 */
const WAVE_CANVAS_H_MIN = 24;
const WAVE_CANVAS_H_MAX = 280;
const WAVE_CANVAS_H_DEFAULT = 72;

/** 再生中の目盛り・波形ビュー窓の微振れを抑える（約 33ms グリッド） */
function quantizePlayheadForWaveView(sec: number): number {
  if (!Number.isFinite(sec)) return 0;
  return Math.round(sec * 30) / 30;
}

/** 波形キャンバス上のキュー区間帯をクリック判定（CSS ピクセル座標） */
function pickCueIdAtWave(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  cueList: Cue[],
  viewStart: number,
  viewSpan: number,
  dragPreview: { cueId: string; tStart: number; tEnd: number } | null
): string | null {
  if (viewSpan <= 0) return null;
  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  const w = r.width;
  const h = r.height;
  if (w <= 0) return null;
  const mid = h / 2;
  const barHalfH = 14;
  const viewEnd = viewStart + viewSpan;
  let best: { id: string; dist: number } | null = null;
  for (const cue of cueList) {
    const ts =
      dragPreview && dragPreview.cueId === cue.id
        ? dragPreview.tStart
        : cue.tStartSec;
    const te =
      dragPreview && dragPreview.cueId === cue.id
        ? dragPreview.tEnd
        : cue.tEndSec;
    if (te < viewStart || ts > viewEnd) continue;
    const x1 = ((Math.max(ts, viewStart) - viewStart) / viewSpan) * w;
    const x2 = ((Math.min(te, viewEnd) - viewStart) / viewSpan) * w;
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const pad = 3;
    if (x < left - pad || x > right + pad) continue;
    if (y < mid - barHalfH || y > mid + barHalfH) continue;
    const cx = clamp(x, left, right);
    const dist = Math.abs(x - cx) + Math.abs(y - mid) * 0.05;
    if (!best || dist < best.dist) best = { id: cue.id, dist };
  }
  return best?.id ?? null;
}

const CUE_EDGE_GRAB_PX = 14;
type CueDragEdgeMode = "move" | "start" | "end";

/** 帯上のクリックが開始端／終了端／移動のいずれか（§3） */
function pickCueDragKindAtWave(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  cueList: Cue[],
  viewStart: number,
  viewSpan: number,
  dragPreview: { cueId: string; tStart: number; tEnd: number } | null
): { cueId: string; mode: CueDragEdgeMode } | null {
  const id = pickCueIdAtWave(
    clientX,
    clientY,
    canvas,
    cueList,
    viewStart,
    viewSpan,
    dragPreview
  );
  if (!id || viewSpan <= 0) return null;
  const cue = cueList.find((c) => c.id === id);
  if (!cue) return null;
  const ts =
    dragPreview && dragPreview.cueId === cue.id ? dragPreview.tStart : cue.tStartSec;
  const te =
    dragPreview && dragPreview.cueId === cue.id ? dragPreview.tEnd : cue.tEndSec;
  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  const w = r.width;
  if (w <= 0) return null;
  const mid = r.height / 2;
  const barHalfH = 14;
  if (y < mid - barHalfH || y > mid + barHalfH) return null;
  const viewEnd = viewStart + viewSpan;
  const x1 = ((Math.max(ts, viewStart) - viewStart) / viewSpan) * w;
  const x2 = ((Math.min(te, viewEnd) - viewStart) / viewSpan) * w;
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  let mode: CueDragEdgeMode = "move";
  if (x <= left + CUE_EDGE_GRAB_PX) mode = "start";
  else if (x >= right - CUE_EDGE_GRAB_PX) mode = "end";
  return { cueId: id, mode };
}

const PLAYHEAD_SCRUB_HALF_WIDTH_PX = 10;

/** 再生ヘッド（ピンク縦線）付近をドラッグしてシーク試聴するためのヒット（CSS ピクセル） */
function hitPlayheadStripForScrub(
  clientX: number,
  canvas: HTMLCanvasElement,
  viewStart: number,
  viewSpan: number,
  playheadSec: number,
  durationSec: number,
  viewPortion: number
): boolean {
  if (durationSec <= 0 || viewSpan <= 0) return false;
  const r = canvas.getBoundingClientRect();
  const w = r.width;
  if (w <= 0) return false;
  const x = clientX - r.left;
  const zoomed = viewPortion < 1 - 1e-9;
  const xPlay = zoomed
    ? WAVE_PLAYHEAD_X_FRAC * w
    : ((playheadSec - viewStart) / viewSpan) * w;
  return Math.abs(x - xPlay) <= PLAYHEAD_SCRUB_HALF_WIDTH_PX;
}

function computeViewRange(
  durationSec: number,
  viewPortion: number,
  centerTime: number
): { start: number; end: number; span: number } {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { start: 0, end: 1, span: 1 };
  }
  if (viewPortion >= 1 - 1e-9) {
    return { start: 0, end: durationSec, span: durationSec };
  }
  const span = Math.max(0.08, durationSec * viewPortion);
  const start = clamp(
    centerTime - span / 2,
    0,
    Math.max(0, durationSec - span)
  );
  return { start, end: start + span, span };
}

/**
 * ズーム時は再生位置がキャンバス左寄りの固定ラインに来るよう窓を合わせ、
 * 波形だけが流れる。全表示時は従来どおり `computeViewRange` と同じ。
 */
const WAVE_PLAYHEAD_X_FRAC = 0.11;

function getWaveViewForDraw(
  durationSec: number,
  viewPortion: number,
  anchorTimeSec: number
): { start: number; end: number; span: number } {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { start: 0, end: 1, span: 1 };
  }
  if (viewPortion >= 1 - 1e-9) {
    return computeViewRange(durationSec, viewPortion, anchorTimeSec);
  }
  const span = Math.max(0.08, durationSec * viewPortion);
  const start = clamp(
    anchorTimeSec - WAVE_PLAYHEAD_X_FRAC * span,
    0,
    Math.max(0, durationSec - span)
  );
  return { start, end: start + span, span };
}

function CueTimeInput({
  timeSec,
  disabled,
  onCommit,
  variant = "default",
  ariaLabel,
}: {
  timeSec: number;
  disabled: boolean;
  onCommit: (v: number) => void;
  /** キュー一覧の1行表示用（大きめ・強調色） */
  variant?: "default" | "cueRow";
  ariaLabel?: string;
}) {
  const isRow = variant === "cueRow";
  const [text, setText] = useState(() =>
    isRow ? formatMmSsFloor(timeSec) : formatMmSs(timeSec)
  );
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) {
      setText(isRow ? formatMmSsFloor(timeSec) : formatMmSs(timeSec));
    }
  }, [timeSec, focus, isRow]);
  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={text}
      onFocus={() => {
        setFocus(true);
        setText(isRow ? formatMmSsFloor(timeSec) : formatMmSs(timeSec));
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocus(false);
        const v = parseMmSsFlexible(text);
        if (v != null && Number.isFinite(v) && v >= 0) onCommit(v);
        else setText(isRow ? formatMmSsFloor(timeSec) : formatMmSs(timeSec));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      aria-label={ariaLabel ?? "時刻"}
      placeholder={isRow ? "" : "分:秒"}
      style={{
        padding: isRow ? "2px 3px" : "6px 8px",
        borderRadius: "6px",
        border: `1px solid ${isRow ? "#db2777" : "#334155"}`,
        background: "#020617",
        color: isRow ? "#fce7f3" : "#e2e8f0",
        width: isRow ? "auto" : "100%",
        minWidth: isRow ? "31px" : "72px",
        maxWidth: isRow ? "42px" : "96px",
        fontSize: isRow ? "11px" : "13px",
        fontWeight: isRow ? 600 : undefined,
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum"',
        flexShrink: 0,
      }}
    />
  );
}

/** 再生中は RAF で textContent のみ更新し、親の間欠 setState と切り離して秒表示のブレを防ぐ */
const PlaybackClockReadout = memo(function PlaybackClockReadout({
  audioRef,
  isPlaying,
  idleTimeSec,
  durationSec,
  monoFontSizePx = 13,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  idleTimeSec: number;
  durationSec: number;
  /** 既定 13px の 1.5 倍など */
  monoFontSizePx?: number;
}) {
  const liveRef = useRef<HTMLSpanElement>(null);
  const idleTimeSecRef = useRef(idleTimeSec);
  idleTimeSecRef.current = idleTimeSec;

  useLayoutEffect(() => {
    if (isPlaying) return;
    const el = liveRef.current;
    if (el) el.textContent = formatMmSsClock(idleTimeSec);
  }, [isPlaying, idleTimeSec]);

  /** 再生開始直後に1回だけシード（以降は RAF が担当） */
  useLayoutEffect(() => {
    if (!isPlaying) return;
    const el = liveRef.current;
    if (!el) return;
    const a = audioRef.current;
    const t =
      a && Number.isFinite(a.currentTime)
        ? a.currentTime
        : idleTimeSecRef.current;
    el.textContent = formatMmSsClock(t);
  }, [isPlaying, audioRef]);

  useEffect(() => {
    if (!isPlaying) return;
    let id = 0;
    const loop = () => {
      const a = audioRef.current;
      const t =
        a && !a.paused && Number.isFinite(a.currentTime)
          ? a.currentTime
          : idleTimeSecRef.current;
      const el = liveRef.current;
      if (el) el.textContent = formatMmSsClock(t);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [isPlaying, audioRef]);

  const durPart = durationSec > 0 ? formatMmSsClock(durationSec) : "—";

  return (
    <span
      style={{
        color: "#94a3b8",
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum"',
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: `${monoFontSizePx}px`,
        minWidth: `${Math.max(17, Math.ceil(17 * (monoFontSizePx / 13)))}ch`,
        display: "inline-block",
        flexShrink: 0,
        textAlign: "right",
        whiteSpace: "pre",
      }}
    >
      {/* 再生中は RAF が textContent を更新。子ノードを置かない（親再レンダーでの上書き防止） */}
      <span ref={liveRef} />
      <span>
        {" / "}
        {durPart}
      </span>
    </span>
  );
});

export const TimelinePanel = forwardRef<TimelinePanelHandle, Props>(
  function TimelinePanel(
    {
      project,
      setProject,
      currentTime,
      setCurrentTime,
      isPlaying,
      setIsPlaying,
      duration,
      setDuration,
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
    },
    ref
  ) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioFileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    /** 波形枠（目盛り＋キャンバス）。ホイール拡縮は passive: false で登録 */
    const waveContainerRef = useRef<HTMLDivElement>(null);
    const [peaks, setPeaks] = useState<number[] | null>(null);
    /** 動画→音声抽出の進捗 UI 表示用 */
    const [extractProgress, setExtractProgress] = useState<{
      ratio: number;
      stage: "decode" | "wasm" | "record" | "loading";
      message?: string;
    } | null>(null);
    const rafRef = useRef<number>(0);
    /** 再生中は親の currentTime を毎フレーム更新しない（全体レイアウトのブルブル防止） */
    const lastPlaybackStateEmitRef = useRef(0);
    const wasPlayingRef = useRef(false);
    const blobUrlRef = useRef<string | null>(null);
    /** 1 = 曲全体表示。小さいほど拡大（見える時間幅が狭い） */
    const [viewPortion, setViewPortion] = useState(1);
    const [waveCanvasCssH, setWaveCanvasCssH] = useState(WAVE_CANVAS_H_DEFAULT);
    const waveCanvasCssHRef = useRef(waveCanvasCssH);
    waveCanvasCssHRef.current = waveCanvasCssH;
    const waveHeightDragRef = useRef<{
      pointerId: number;
      startY: number;
      startH: number;
    } | null>(null);
    const selectedCueIdsRef = useRef<string[]>([]);
    selectedCueIdsRef.current = selectedCueIds;
    const waveAmpRef = useRef(1);

    const peaksRef = useRef(peaks);
    const durationRef = useRef(duration);
    const viewPortionRef = useRef(viewPortion);
    const trimRef = useRef({ start: 0, end: null as number | null });
    const currentTimePropRef = useRef(currentTime);

    peaksRef.current = peaks;
    durationRef.current = duration;
    viewPortionRef.current = viewPortion;
    trimRef.current = { start: project.trimStartSec, end: project.trimEndSec };
    currentTimePropRef.current = currentTime;

    waveAmpRef.current = project.waveformAmplitudeScale ?? 1;

    const {
      cues,
      playbackRate,
      trimStartSec,
      trimEndSec,
      formations,
    } = project;

    const cuesRef = useRef<Cue[]>(cues);
    cuesRef.current = cues;

    const lastWaveDrawRangeRef = useRef({ viewStart: 0, viewSpan: 1 });
    const cueDragRef = useRef<{
      pointerId: number;
      cueId: string;
      mode: CueDragEdgeMode;
      moved: boolean;
      grabOffset: number;
      origStart: number;
      origEnd: number;
    } | null>(null);
    const cueDragPreviewRangeRef = useRef<{
      cueId: string;
      tStart: number;
      tEnd: number;
    } | null>(null);
    /** 波形の空きドラッグで新規区間を作るときのプレビュー（秒） */
    const newCueRangePreviewRef = useRef<{ tStart: number; tEnd: number } | null>(
      null
    );
    const emptyWaveDragRef = useRef<{
      pointerId: number;
      startClientX: number;
      startT: number;
      trimLo: number;
      trimHi: number;
      /** 水平 5px 超えたらドラッグ確定 */
      active: boolean;
    } | null>(null);
    const suppressNextWaveSeekRef = useRef(false);
    const playheadScrubDragRef = useRef<{
      pointerId: number;
      wasPlaying: boolean;
    } | null>(null);
    /** 波形上のキュー帯ホバー（端＝リサイズ、中央＝移動の視覚ヒント用） */
    const waveHoverCueRef = useRef<{
      cueId: string;
      mode: CueDragEdgeMode;
    } | null>(null);

    const playheadGridSec = useMemo(
      () => (isPlaying ? quantizePlayheadForWaveView(currentTime) : currentTime),
      [currentTime, isPlaying]
    );

    const waveView = useMemo(
      () => getWaveViewForDraw(duration, viewPortion, playheadGridSec),
      [duration, viewPortion, playheadGridSec]
    );

    const isPlayingForWaveRef = useRef(isPlaying);
    isPlayingForWaveRef.current = isPlaying;

    const drawWaveformAt = useCallback((playheadTime: number) => {
      const c = canvasRef.current;
      const pk = peaksRef.current;
      const d = durationRef.current;
      const vp = viewPortionRef.current;
      const { start: trimS, end: trimE } = trimRef.current;
      if (!c || !pk) return;
      const w = c.width;
      const h = c.height;
      const g = c.getContext("2d");
      if (!g) return;

      const tGrid = isPlayingForWaveRef.current
        ? quantizePlayheadForWaveView(playheadTime)
        : playheadTime;
      const { start: viewStart, span: viewSpan } = getWaveViewForDraw(d, vp, tGrid);
      const viewEnd = viewStart + viewSpan;
      lastWaveDrawRangeRef.current = { viewStart, viewSpan };

      g.fillStyle = "#0f172a";
      g.fillRect(0, 0, w, h);

      if (d > 0 && trimS > 0) {
        const xTrim = ((trimS - viewStart) / viewSpan) * w;
        if (xTrim > 0 && xTrim < w) {
          g.fillStyle = "rgba(15,23,42,0.55)";
          g.fillRect(0, 0, xTrim, h);
        }
      }
      if (d > 0 && trimE != null && trimE < d) {
        const xTrim = ((trimE - viewStart) / viewSpan) * w;
        if (xTrim > 0 && xTrim < w) {
          g.fillStyle = "rgba(15,23,42,0.55)";
          g.fillRect(xTrim, 0, w - xTrim, h);
        }
      }

      g.strokeStyle = "#6366f1";
      g.lineWidth = 1;
      const mid = h / 2;
      /** peaks は decode 時に曲全体を等分したビン。時刻 t はファイル上の絶対秒 */
      pk.forEach((p, i) => {
        if (d <= 0 || viewSpan <= 0) return;
        const t =
          pk.length <= 1 ? d / 2 : (i / (pk.length - 1)) * d;
        if (t < viewStart || t > viewEnd) return;
        const x = ((t - viewStart) / viewSpan) * w;
        if (x < -1 || x > w + 1) return;
        const amp = waveAmpRef.current;
        const ph = Math.min(h * 0.48, ((p * h) / 2) * amp);
        g.beginPath();
        g.moveTo(x, mid - ph);
        g.lineTo(x, mid + ph);
        g.stroke();
      });

      const cueList = cuesRef.current;
      const dragCueId = cueDragRef.current?.cueId ?? null;
      const dragPrev = cueDragPreviewRangeRef.current;
      if (d > 0 && viewSpan > 0 && cueList.length > 0) {
        for (const cue of cueList) {
          let ts = cue.tStartSec;
          let te = cue.tEndSec;
          if (dragPrev && dragPrev.cueId === cue.id) {
            ts = dragPrev.tStart;
            te = dragPrev.tEnd;
          }
          if (te < viewStart || ts > viewEnd) continue;
          const x1 = ((Math.max(ts, viewStart) - viewStart) / viewSpan) * w;
          const x2 = ((Math.min(te, viewEnd) - viewStart) / viewSpan) * w;
          const left = Math.min(x1, x2);
          const width = Math.max(3, Math.abs(x2 - x1));
          const isDrag = dragCueId === cue.id;
          const isSel = selectedCueIdsRef.current.includes(cue.id);
          const hover = waveHoverCueRef.current;
          const isHover =
            hover?.cueId === cue.id && (!dragCueId || dragCueId !== cue.id);
          const hoverStart = isHover && hover.mode === "start";
          const hoverEnd = isHover && hover.mode === "end";
          const bh = isDrag ? 24 : 20;
          g.fillStyle = isDrag ? "rgba(253, 224, 71, 0.55)" : "rgba(252, 211, 77, 0.38)";
          g.fillRect(left, mid - bh / 2, width, bh);
          g.strokeStyle = isSel ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.88)";
          g.lineWidth = isSel ? 2.5 : 2;
          if (isHover) g.lineWidth = Math.max(g.lineWidth, 2.75);
          g.strokeRect(left + 0.5, mid - bh / 2 + 0.5, width - 1, bh - 1);
          if (hoverStart || hoverEnd) {
            g.strokeStyle = "#ffffff";
            g.lineWidth = 3;
            g.lineCap = "butt";
            if (hoverStart) {
              g.beginPath();
              g.moveTo(left + 0.5, mid - bh / 2 - 1);
              g.lineTo(left + 0.5, mid + bh / 2 + 1);
              g.stroke();
            }
            if (hoverEnd) {
              g.beginPath();
              g.moveTo(left + width - 0.5, mid - bh / 2 - 1);
              g.lineTo(left + width - 0.5, mid + bh / 2 + 1);
              g.stroke();
            }
          }
        }
      }

      const newPrev = newCueRangePreviewRef.current;
      if (d > 0 && viewSpan > 0 && newPrev) {
        let ts = newPrev.tStart;
        let te = newPrev.tEnd;
        if (te < ts) [ts, te] = [te, ts];
        if (te >= viewStart && ts <= viewEnd) {
          const x1 = ((Math.max(ts, viewStart) - viewStart) / viewSpan) * w;
          const x2 = ((Math.min(te, viewEnd) - viewStart) / viewSpan) * w;
          const left = Math.min(x1, x2);
          const width = Math.max(3, Math.abs(x2 - x1));
          const bh = 22;
          g.fillStyle = "rgba(45, 212, 191, 0.42)";
          g.fillRect(left, mid - bh / 2, width, bh);
          g.strokeStyle = "rgba(15, 23, 42, 0.65)";
          g.lineWidth = 1;
          g.strokeRect(left + 0.5, mid - bh / 2 + 0.5, width - 1, bh - 1);
        }
      }

      if (d > 0 && viewSpan > 0) {
        const zoomed = vp < 1 - 1e-9;
        let xPlay: number;
        if (zoomed) {
          xPlay = WAVE_PLAYHEAD_X_FRAC * w;
        } else {
          xPlay = ((playheadTime - viewStart) / viewSpan) * w;
          if (Number.isFinite(xPlay)) {
            xPlay = Math.min(w, Math.max(0, Math.round(xPlay * 2) / 2));
          } else {
            xPlay = 0;
          }
        }
        g.strokeStyle = "#f472b6";
        g.lineWidth = 2;
        g.lineCap = "butt";
        g.beginPath();
        g.moveTo(xPlay + 0.5, 0);
        g.lineTo(xPlay + 0.5, h);
        g.stroke();
      }
    }, []);

    useEffect(() => {
      if (isPlaying) return;
      drawWaveformAt(currentTime);
    }, [
      currentTime,
      drawWaveformAt,
      peaks,
      duration,
      viewPortion,
      trimStartSec,
      trimEndSec,
      isPlaying,
      cues,
      selectedCueIds,
      project.waveformAmplitudeScale,
      waveCanvasCssH,
    ]);

    useEffect(() => {
      if (!isPlaying || !peaks) return;
      let id = 0;
      const paint = () => {
        const a = audioRef.current;
        const t =
          a && !a.paused && Number.isFinite(a.currentTime)
            ? a.currentTime
            : currentTimePropRef.current;
        drawWaveformAt(t);
        id = requestAnimationFrame(paint);
      };
      id = requestAnimationFrame(paint);
      return () => cancelAnimationFrame(id);
    }, [
      isPlaying,
      peaks,
      drawWaveformAt,
      viewPortion,
      duration,
      trimStartSec,
      trimEndSec,
      cues,
      selectedCueIds,
      project.waveformAmplitudeScale,
      waveCanvasCssH,
    ]);

    useEffect(() => {
      setViewPortion(1);
    }, [peaks]);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Delete" && e.key !== "Backspace") return;
        if (project.viewMode === "view") return;
        const t = e.target;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
        if (t instanceof HTMLElement && t.isContentEditable) return;
        const ids = selectedCueIdsRef.current;
        if (ids.length === 0) return;
        e.preventDefault();
        const idSet = new Set(ids);
        setProject((p) => ({
          ...p,
          cues: sortCuesByStart(p.cues.filter((c) => !idSet.has(c.id))),
        }));
        onSelectedCueIdsChange([]);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [project.viewMode, setProject, onSelectedCueIdsChange]);

    useEffect(() => {
      const a = audioRef.current;
      if (!a) return;
      a.playbackRate = playbackRate;
    }, [playbackRate]);

    useEffect(() => {
      const a = audioRef.current;
      if (!a) return;
      const onMeta = () => {
        const dur = a.duration;
        if (Number.isFinite(dur)) setDuration(dur);
      };
      const onPlay = () => setIsPlaying(true);
      const onPause = () => setIsPlaying(false);
      a.addEventListener("loadedmetadata", onMeta);
      a.addEventListener("play", onPlay);
      a.addEventListener("pause", onPause);
      return () => {
        a.removeEventListener("loadedmetadata", onMeta);
        a.removeEventListener("play", onPlay);
        a.removeEventListener("pause", onPause);
      };
    }, [setDuration, setIsPlaying]);

    const tick = useCallback(() => {
      const a = audioRef.current;
      if (a && !a.paused) {
        let t = a.currentTime;
        const end = trimEndSec ?? duration;
        if (t < trimStartSec) {
          a.currentTime = trimStartSec;
          t = trimStartSec;
        }
        if (end > 0 && t >= end) {
          a.pause();
          a.currentTime = trimStartSec;
          setCurrentTime(trimStartSec);
          setIsPlaying(false);
          return;
        }
        const rounded = Math.round(t * 1000) / 1000;
        const now = performance.now();
        /** ステージ補間を滑らかにするため親の currentTime を高頻度で同期 */
        if (now - lastPlaybackStateEmitRef.current >= 12) {
          lastPlaybackStateEmitRef.current = now;
          setCurrentTime(rounded);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }, [duration, setCurrentTime, setIsPlaying, trimEndSec, trimStartSec]);

    useEffect(() => {
      if (isPlaying) {
        lastPlaybackStateEmitRef.current = 0;
        rafRef.current = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(rafRef.current);
      }
      return () => cancelAnimationFrame(rafRef.current);
    }, [isPlaying, tick]);

    /** 再生→停止の直後だけオーディオ時刻に合わせる（間引きのズレ解消。マウント時の上書きはしない） */
    useEffect(() => {
      if (isPlaying) {
        wasPlayingRef.current = true;
        return;
      }
      if (!wasPlayingRef.current) return;
      wasPlayingRef.current = false;
      const a = audioRef.current;
      if (!a?.src || !Number.isFinite(a.currentTime)) return;
      setCurrentTime(Math.round(a.currentTime * 1000) / 1000);
    }, [isPlaying, setCurrentTime]);

    const decodePeaksFromBuffer = useCallback(async (buf: ArrayBuffer) => {
      const ctx = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(buf.slice(0));
      const ch = audioBuf.getChannelData(0);
      const len = 400;
      const block = Math.floor(ch.length / len) || 1;
      const out: number[] = [];
      for (let i = 0; i < len; i++) {
        let s = 0;
        for (let j = 0; j < block; j++) {
          s += Math.abs(ch[i * block + j] ?? 0);
        }
        out.push(s / block);
      }
      const max = Math.max(...out, 1e-6);
      setPeaks(out.map((x) => x / max));
      await ctx.close();
    }, []);

    useEffect(() => {
      const aid = project.audioAssetId;
      if (aid == null || !getToken()) return;
      let cancelled = false;
      (async () => {
        try {
          const url = await fetchAuthorizedAudioBlobUrl(aid);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = url;
          const a = audioRef.current;
          if (a) {
            a.src = url;
            a.load();
          }
          const res = await fetch(`/api/audio/${aid}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          const buf = await res.arrayBuffer();
          if (!cancelled) await decodePeaksFromBuffer(buf);
        } catch (e) {
          console.error(e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [project.audioAssetId, decodePeaksFromBuffer]);

    useEffect(() => {
      return () => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }, []);

    const onPickAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      const isVideo = f.type.startsWith("video/");
      if (isVideo) {
        const ok = window.confirm(
          `動画「${f.name}」から音声を抽出します。\nMP4 / AVI / MOV / MKV / WMV などほとんどの形式に対応。AAC / MP3 / Opus などの一般的な音声は再エンコードせず demux するので、大容量の動画でも数秒〜十数秒で完了します。\nFFmpeg コア（約 30MB）はエディタ起動時と「音源追加」ボタンのホバー時点で先読み済みのはずなので、通常は読み込み待ちなしで抽出が始まります。\n著作権・利用範囲はご利用者の責任です。続行しますか？`
        );
        if (!ok) return;
      }
      if (loggedIn && serverProjectId != null && !isVideo) {
        try {
          const fd = new FormData();
          fd.append("file", f);
          fd.append("projectId", String(serverProjectId));
          const { id } = await audioApiUpload(fd);
          setProject((p) => ({ ...p, audioAssetId: id }));
        } catch (err) {
          alert(err instanceof Error ? err.message : "サーバへのアップロードに失敗しました");
        }
      }
      if (loggedIn && serverProjectId != null && isVideo) {
        setProject((p) => ({ ...p, audioAssetId: null }));
      }
      let buf: ArrayBuffer;
      try {
        if (isVideo) {
          setExtractProgress({ ratio: 0, stage: "decode", message: "抽出準備中…" });
          buf = await extractAudioBufferFromVideoFile(f, (p) => {
            setExtractProgress(p);
          });
        } else {
          buf = await f.arrayBuffer();
        }
      } catch (err) {
        setExtractProgress(null);
        alert(err instanceof Error ? err.message : "読み込みに失敗しました");
        return;
      } finally {
        if (isVideo) {
          /** 完了 or エラー直後は一瞬だけ 100% を見せてから消す */
          setTimeout(() => setExtractProgress(null), 400);
        }
      }
      const blob = new Blob([buf], {
        type: isVideo ? mimeForExtractedVideoAudio(buf) : f.type || "audio/mpeg",
      });
      const url = URL.createObjectURL(blob);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
      const a = audioRef.current;
      if (a) {
        a.src = url;
        a.load();
      }
      await decodePeaksFromBuffer(buf);
      if (isVideo) {
        playCompletionWoof();
      }
    };

    const onWaveClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (suppressNextWaveSeekRef.current) {
        suppressNextWaveSeekRef.current = false;
        return;
      }
      const c = canvasRef.current;
      const a = audioRef.current;
      if (!c || !a || duration <= 0) return;
      const d = duration;
      let viewStart = lastWaveDrawRangeRef.current.viewStart;
      let viewSpan = lastWaveDrawRangeRef.current.viewSpan;
      if (viewSpan <= 0) {
        const vp = viewPortion;
        const gv = getWaveViewForDraw(d, vp, currentTime);
        viewStart = gv.start;
        viewSpan = gv.span;
      }
      if (viewSpan <= 0) return;
      const hitId =
        peaks != null && cues.length > 0
          ? pickCueIdAtWave(
              e.clientX,
              e.clientY,
              c,
              cues,
              viewStart,
              viewSpan,
              cueDragPreviewRangeRef.current
            )
          : null;
      if (hitId) {
        if (e.metaKey || e.ctrlKey) {
          onSelectedCueIdsChange((prev) =>
            prev.includes(hitId) ? prev.filter((x) => x !== hitId) : [...prev, hitId]
          );
        } else {
          onSelectedCueIdsChange([hitId]);
        }
      } else {
        onSelectedCueIdsChange([]);
      }
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const t = viewStart + (x / r.width) * viewSpan;
      const clamped = Math.max(trimStartSec, Math.min(trimEndSec ?? duration, t));
      a.currentTime = clamped;
      setCurrentTime(clamped);
    };

    const onWaveContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (project.viewMode === "view" || duration <= 0 || !peaks) return;
      const c = canvasRef.current;
      if (!c) return;
      let viewStart = lastWaveDrawRangeRef.current.viewStart;
      let viewSpan = lastWaveDrawRangeRef.current.viewSpan;
      if (viewSpan <= 0) {
        const gv = getWaveViewForDraw(duration, viewPortion, currentTime);
        viewStart = gv.start;
        viewSpan = gv.span;
      }
      if (viewSpan <= 0) return;
      const id = pickCueIdAtWave(
        e.clientX,
        e.clientY,
        c,
        cues,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current
      );
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      setProject((p) => ({
        ...p,
        cues: sortCuesByStart(p.cues.filter((x) => x.id !== id)),
      }));
      onSelectedCueIdsChange((prev) => prev.filter((x) => x !== id));
    };

    useEffect(() => {
      const el = waveContainerRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        if (durationRef.current <= 0) return;
        e.preventDefault();
        const dy = e.deltaY;
        if (dy === 0) return;
        /** deltaY>0 で縮小（見える時間幅↑）、<0 で拡大。トラックパッドの細かい delta に追従 */
        const mult = Math.exp(dy * 0.00115);
        setViewPortion((p) => {
          const next = p * mult;
          return Math.min(1, Math.max(0.025, next));
        });
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, []);

    useEffect(() => {
      const onMove = (ev: PointerEvent) => {
        const d = waveHeightDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const dy = ev.clientY - d.startY;
        const nh = Math.round(
          Math.min(
            WAVE_CANVAS_H_MAX,
            Math.max(WAVE_CANVAS_H_MIN, d.startH + dy)
          )
        );
        setWaveCanvasCssH(nh);
      };
      const onUp = (ev: PointerEvent) => {
        const d = waveHeightDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        waveHeightDragRef.current = null;
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
    }, []);

    const onWaveBorderResizePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (project.viewMode === "view") return;
        e.preventDefault();
        e.stopPropagation();
        waveHeightDragRef.current = {
          pointerId: e.pointerId,
          startY: e.clientY,
          startH: waveCanvasCssHRef.current,
        };
        document.body.style.cursor = "ns-resize";
      },
      [project.viewMode]
    );

    const togglePlay = useCallback(() => {
      const a = audioRef.current;
      if (!a?.src) return;
      if (a.paused) {
        if (a.currentTime < trimStartSec) a.currentTime = trimStartSec;
        void a.play();
      } else {
        a.pause();
      }
    }, [trimStartSec]);

    const seekForward5Sec = useCallback(() => {
      const a = audioRef.current;
      if (!a?.src || duration <= 0) return;
      const hi = trimEndSec ?? duration;
      const lo = trimStartSec;
      const next = Math.min(hi, Math.max(lo, a.currentTime + 5));
      a.currentTime = next;
      setCurrentTime(next);
    }, [duration, trimEndSec, trimStartSec, setCurrentTime]);

    const seekBackward5Sec = useCallback(() => {
      const a = audioRef.current;
      if (!a?.src || duration <= 0) return;
      const hi = trimEndSec ?? duration;
      const lo = trimStartSec;
      const next = Math.min(hi, Math.max(lo, a.currentTime - 5));
      a.currentTime = next;
      setCurrentTime(next);
    }, [duration, trimEndSec, trimStartSec, setCurrentTime]);

    const stopPlayback = useCallback(() => {
      const a = audioRef.current;
      if (!a?.src) return;
      a.pause();
      setIsPlaying(false);
      const t = Math.max(0, trimStartSec);
      if (Number.isFinite(t)) {
        a.currentTime = t;
        setCurrentTime(t);
      }
    }, [trimStartSec, setCurrentTime, setIsPlaying]);

    const pauseAndSeekToSec = useCallback(
      (tRaw: number) => {
        const a = audioRef.current;
        const d = durationRef.current;
        const { start: lo, end: trimE } = trimRef.current;
        const hi = trimE ?? d;
        const clamped =
          d > 0 && Number.isFinite(tRaw)
            ? Math.min(hi, Math.max(lo, tRaw))
            : Math.max(0, tRaw);
        setIsPlaying(false);
        if (a?.src && Number.isFinite(clamped)) {
          a.pause();
          a.currentTime = clamped;
        }
        setCurrentTime(clamped);
      },
      [setCurrentTime, setIsPlaying]
    );

    const openAudioImport = useCallback(() => {
      void preloadFFmpeg();
      audioFileInputRef.current?.click();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        togglePlay,
        stopPlayback,
        pauseAndSeekToSec,
        openAudioImport,
      }),
      [togglePlay, stopPlayback, pauseAndSeekToSec, openAudioImport]
    );

    useEffect(() => {
      return () => {
        onStagePreviewChange?.(null);
      };
    }, [onStagePreviewChange]);

    /** 指定秒位置から区間キューを追加（フォーメーションは複製して独立スナップショットにする） */
    const addCueStartingAtTime = useCallback(
      (t0Raw: number) => {
        if (project.viewMode === "view") return;
        const newCueId = crypto.randomUUID();
        let appliedT = 0;
        setProject((p) => {
          if (p.cues.length >= 100) return p;
          const sourceF =
            p.formations.find((f) => f.id === formationIdForNewCue) ??
            p.formations[0];
          if (!sourceF) return p;
          const newFm = cloneFormationForNewCue(sourceF);
          const d = durationRef.current || 1;
          const trimHi = p.trimEndSec ?? d;
          const trimLo = p.trimStartSec;
          let t0 = Math.round(t0Raw * 100) / 100;
          t0 = Math.max(trimLo, Math.min(trimHi - 0.02, t0));
          let t1 = Math.min(trimHi, Math.round((t0 + 2) * 100) / 100);
          if (t1 <= t0) t1 = Math.round((t0 + 0.5) * 100) / 100;
          const resolved = resolveCueIntervalNonOverlap(
            p.cues,
            newCueId,
            t0,
            t1,
            trimLo,
            trimHi
          );
          t0 = resolved.tStartSec;
          t1 = resolved.tEndSec;
          appliedT = t0;
          const cue: Cue = {
            id: newCueId,
            tStartSec: t0,
            tEndSec: t1,
            formationId: newFm.id,
          };
          return {
            ...p,
            formations: [...p.formations, newFm],
            cues: sortCuesByStart([...p.cues, cue]),
            activeFormationId: newFm.id,
          };
        });
        const a = audioRef.current;
        if (a && Number.isFinite(appliedT)) {
          a.currentTime = Math.max(
            trimStartSec,
            Math.min(trimEndSec ?? durationRef.current, appliedT)
          );
        }
        setCurrentTime(appliedT);
        onSelectedCueIdsChange([newCueId]);
        onFormationChosenFromCueList?.();
      },
      [
        project.viewMode,
        setProject,
        trimStartSec,
        trimEndSec,
        setCurrentTime,
        onFormationChosenFromCueList,
        formationIdForNewCue,
        onSelectedCueIdsChange,
      ]
    );

    const onWaveDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (project.viewMode === "view" || duration <= 0 || !peaks) return;
      const c = canvasRef.current;
      const a = audioRef.current;
      if (!c || !a?.src) return;
      let viewStart = lastWaveDrawRangeRef.current.viewStart;
      let viewSpan = lastWaveDrawRangeRef.current.viewSpan;
      if (viewSpan <= 0) {
        const gv = getWaveViewForDraw(duration, viewPortion, currentTime);
        viewStart = gv.start;
        viewSpan = gv.span;
      }
      if (viewSpan <= 0) return;
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const t = viewStart + (x / r.width) * viewSpan;
      const clamped = Math.max(trimStartSec, Math.min(trimEndSec ?? duration, t));
      e.preventDefault();
      e.stopPropagation();
      suppressNextWaveSeekRef.current = true;
      addCueStartingAtTime(clamped);
    };

    const removeCue = (id: string) => {
      setProject((p) => ({
        ...p,
        cues: sortCuesByStart(p.cues.filter((c) => c.id !== id)),
      }));
      onSelectedCueIdsChange((prev) => prev.filter((x) => x !== id));
    };

    const updateCue = (id: string, patch: Partial<Cue>) => {
      setProject((p) => {
        let merged: Partial<Cue> = patch;
        if (patch.tStartSec !== undefined || patch.tEndSec !== undefined) {
          const cur = p.cues.find((c) => c.id === id);
          if (!cur) return p;
          const ns = patch.tStartSec ?? cur.tStartSec;
          const ne = patch.tEndSec ?? cur.tEndSec;
          const trimHi = p.trimEndSec ?? durationRef.current;
          const r = resolveCueIntervalNonOverlap(
            p.cues,
            id,
            ns,
            ne,
            p.trimStartSec,
            trimHi
          );
          merged = { ...patch, tStartSec: r.tStartSec, tEndSec: r.tEndSec };
        }
        return {
          ...p,
          cues: sortCuesByStart(
            p.cues.map((c) => (c.id === id ? { ...c, ...merged } : c))
          ),
        };
      });
    };

    /** 再生位置に、元キューと同じ見た目の区間キューを追加（フォーメーションは複製） */
    const duplicateCueSameSettings = useCallback(
      (source: Cue) => {
        if (project.viewMode === "view") return;
        const newCueId = crypto.randomUUID();
        let appliedT = Math.round(currentTime * 100) / 100;
        setProject((p) => {
          if (p.cues.length >= 100) return p;
          const srcFm = p.formations.find((f) => f.id === source.formationId);
          if (!srcFm) return p;
          const newFm = cloneFormationForNewCue(srcFm);
          const d = durationRef.current || 1;
          const trimHi = p.trimEndSec ?? d;
          const trimLo = p.trimStartSec;
          let t0 = Math.max(trimLo, Math.min(trimHi - 0.02, appliedT));
          let t1 = Math.min(trimHi, Math.round((t0 + (source.tEndSec - source.tStartSec)) * 100) / 100);
          if (t1 <= t0) t1 = Math.round((t0 + 0.5) * 100) / 100;
          const resolved = resolveCueIntervalNonOverlap(
            p.cues,
            newCueId,
            t0,
            t1,
            trimLo,
            trimHi
          );
          t0 = resolved.tStartSec;
          t1 = resolved.tEndSec;
          appliedT = t0;
          const newCue: Cue = {
            id: newCueId,
            tStartSec: t0,
            tEndSec: t1,
            formationId: newFm.id,
            name: source.name,
            note: source.note,
          };
          return {
            ...p,
            formations: [...p.formations, newFm],
            cues: sortCuesByStart([...p.cues, newCue]),
            activeFormationId: newFm.id,
          };
        });
        const a = audioRef.current;
        if (a && Number.isFinite(appliedT)) {
          a.currentTime = Math.max(
            project.trimStartSec,
            Math.min(project.trimEndSec ?? durationRef.current, appliedT)
          );
        }
        setCurrentTime(appliedT);
        onSelectedCueIdsChange([newCueId]);
        onFormationChosenFromCueList?.();
      },
      [
        project.viewMode,
        project.trimStartSec,
        project.trimEndSec,
        setProject,
        currentTime,
        setCurrentTime,
        onFormationChosenFromCueList,
        onSelectedCueIdsChange,
      ]
    );

    /** キュー行の人数カウンター用。立ち位置は中央一列プリセットで即更新（共有形は全キューで共通） */
    const adjustFormationDancerCount = useCallback(
      (formationId: string, delta: number) => {
        if (project.viewMode === "view") return;
        setProject((p) => {
          const fm = p.formations.find((x) => x.id === formationId);
          if (!fm) return p;
          const cur = fm.dancers.length;
          const n = Math.max(1, Math.min(80, cur + delta));
          if (n === cur) return p;
          const dancers = dancersForLayoutPreset(n, "line", {
            dancerSpacingMm: p.dancerSpacingMm,
            stageWidthMm: p.stageWidthMm,
          });
          return {
            ...p,
            formations: p.formations.map((f) =>
              f.id === formationId
                ? { ...f, dancers, confirmedDancerCount: n }
                : f
            ),
          };
        });
      },
      [project.viewMode, setProject]
    );

    const onWaveCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (project.viewMode === "view" || duration <= 0 || !peaks) return;
      const c = canvasRef.current;
      if (!c) return;
      const { viewStart, viewSpan } = lastWaveDrawRangeRef.current;
      const cueHit = pickCueDragKindAtWave(
        e.clientX,
        e.clientY,
        c,
        cues,
        viewStart,
        viewSpan,
        null
      );
      const cueId = cueHit?.cueId ?? null;

      const trimLo = trimStartSec;
      const trimHi = trimEndSec ?? duration;

      const timeFromClientX = (clientX: number) => {
        const r = c.getBoundingClientRect();
        const x = clientX - r.left;
        const t = viewStart + (x / r.width) * viewSpan;
        return Math.max(trimLo, Math.min(trimHi, t));
      };

      const redraw = () => {
        let tRedraw = currentTimePropRef.current;
        const a = audioRef.current;
        if (
          isPlayingForWaveRef.current &&
          a &&
          !a.paused &&
          Number.isFinite(a.currentTime)
        ) {
          tRedraw = a.currentTime;
        }
        drawWaveformAt(tRedraw);
      };

      if (cueId) {
        e.preventDefault();
        e.stopPropagation();
        waveHoverCueRef.current = null;
        const cue = cues.find((x) => x.id === cueId);
        if (!cue) return;

        onSelectedCueIdsChange([cueId]);
        const pointerT0 = timeFromClientX(e.clientX);
        const mode = cueHit?.mode ?? "move";
        const grabOffset = pointerT0 - cue.tStartSec;
        cueDragRef.current = {
          pointerId: e.pointerId,
          cueId,
          mode,
          moved: false,
          grabOffset,
          origStart: cue.tStartSec,
          origEnd: cue.tEndSec,
        };
        cueDragPreviewRangeRef.current = {
          cueId,
          tStart: cue.tStartSec,
          tEnd: cue.tEndSec,
        };
        c.setPointerCapture(e.pointerId);

        const MIN_CUE_DUR = 0.05;
        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== e.pointerId || !cueDragRef.current) return;
          cueDragRef.current.moved = true;
          const drag = cueDragRef.current;
          const cur = timeFromClientX(ev.clientX);
          let ns = drag.origStart;
          let ne = drag.origEnd;
          if (drag.mode === "move") {
            const dur = drag.origEnd - drag.origStart;
            ns = cur - drag.grabOffset;
            ne = ns + dur;
            if (ne > trimHi) {
              ne = trimHi;
              ns = ne - dur;
            }
            if (ns < trimLo) {
              ns = trimLo;
              ne = ns + dur;
            }
            if (ne <= ns) ne = ns + MIN_CUE_DUR;
          } else if (drag.mode === "start") {
            ns = Math.round(cur * 100) / 100;
            ns = Math.max(trimLo, Math.min(ns, drag.origEnd - MIN_CUE_DUR));
            ne = drag.origEnd;
          } else {
            ne = Math.round(cur * 100) / 100;
            ne = Math.min(trimHi, Math.max(ne, drag.origStart + MIN_CUE_DUR));
            ns = drag.origStart;
          }
          ns = Math.round(ns * 100) / 100;
          ne = Math.round(ne * 100) / 100;
          const resolved = resolveCueIntervalNonOverlap(
            cuesRef.current,
            cueId,
            ns,
            ne,
            trimLo,
            trimHi
          );
          ns = resolved.tStartSec;
          ne = resolved.tEndSec;
          cueDragPreviewRangeRef.current = { cueId, tStart: ns, tEnd: ne };
          redraw();
        };

        const onUp = (ev: PointerEvent) => {
          if (ev.pointerId !== e.pointerId || !cueDragRef.current) return;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          try {
            c.releasePointerCapture(ev.pointerId);
          } catch {
            /* ignore */
          }
          const drag = cueDragRef.current;
          cueDragRef.current = null;
          const preview = cueDragPreviewRangeRef.current;
          cueDragPreviewRangeRef.current = null;
          suppressNextWaveSeekRef.current = true;
          if (!drag) return;
          const { cueId: cid, moved, origStart, origEnd } = drag;
          onSelectedCueIdsChange([cid]);
          if (
            preview &&
            Number.isFinite(preview.tStart) &&
            Number.isFinite(preview.tEnd) &&
            moved &&
            (Math.abs(preview.tStart - origStart) > 1e-4 ||
              Math.abs(preview.tEnd - origEnd) > 1e-4)
          ) {
            const ns = preview.tStart;
            const ne = preview.tEnd;
            setProject((p) => {
              const trimHi = p.trimEndSec ?? durationRef.current;
              const r = resolveCueIntervalNonOverlap(
                p.cues,
                cid,
                ns,
                ne,
                p.trimStartSec,
                trimHi
              );
              return {
                ...p,
                cues: sortCuesByStart(
                  p.cues.map((x) =>
                    x.id === cid
                      ? { ...x, tStartSec: r.tStartSec, tEndSec: r.tEndSec }
                      : x
                  )
                ),
              };
            });
          }
          redraw();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
        redraw();
        return;
      }

      const audioEl = audioRef.current;
      let playheadSecForHit = currentTimePropRef.current;
      if (
        isPlayingForWaveRef.current &&
        audioEl &&
        !audioEl.paused &&
        Number.isFinite(audioEl.currentTime)
      ) {
        playheadSecForHit = quantizePlayheadForWaveView(audioEl.currentTime);
      }
      if (
        audioEl?.src &&
        viewSpan > 0 &&
        hitPlayheadStripForScrub(
          e.clientX,
          c,
          viewStart,
          viewSpan,
          playheadSecForHit,
          duration,
          viewPortionRef.current
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
        waveHoverCueRef.current = null;
        const wasPlaying = !audioEl.paused;
        playheadScrubDragRef.current = {
          pointerId: e.pointerId,
          wasPlaying,
        };
        const t0 = timeFromClientX(e.clientX);
        audioEl.currentTime = t0;
        setCurrentTime(Math.round(t0 * 1000) / 1000);
        if (!wasPlaying) {
          void audioEl.play().catch(() => {
            /* 試聴できない環境では無視 */
          });
        }
        const capturePid = e.pointerId;
        c.setPointerCapture(capturePid);

        const onPhMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capturePid || !playheadScrubDragRef.current) return;
          const au = audioRef.current;
          if (!au) return;
          const t = timeFromClientX(ev.clientX);
          au.currentTime = t;
          setCurrentTime(Math.round(t * 1000) / 1000);
          drawWaveformAt(t);
        };

        const onPhUp = (ev: PointerEvent) => {
          if (ev.pointerId !== capturePid || !playheadScrubDragRef.current) return;
          window.removeEventListener("pointermove", onPhMove);
          window.removeEventListener("pointerup", onPhUp);
          window.removeEventListener("pointercancel", onPhUp);
          try {
            c.releasePointerCapture(ev.pointerId);
          } catch {
            /* ignore */
          }
          const drag = playheadScrubDragRef.current;
          playheadScrubDragRef.current = null;
          suppressNextWaveSeekRef.current = true;
          const au = audioRef.current;
          if (au) {
            const tEnd = timeFromClientX(ev.clientX);
            au.currentTime = tEnd;
            setCurrentTime(Math.round(tEnd * 1000) / 1000);
            if (!drag.wasPlaying) {
              au.pause();
            }
          }
          redraw();
        };

        window.addEventListener("pointermove", onPhMove);
        window.addEventListener("pointerup", onPhUp);
        window.addEventListener("pointercancel", onPhUp);
        drawWaveformAt(t0);
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      waveHoverCueRef.current = null;
      emptyWaveDragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startT: timeFromClientX(e.clientX),
        trimLo,
        trimHi,
        active: false,
      };
      newCueRangePreviewRef.current = null;
      c.setPointerCapture(e.pointerId);

      const onEmptyMove = (ev: PointerEvent) => {
        const st = emptyWaveDragRef.current;
        if (!st || ev.pointerId !== st.pointerId) return;
        if (!st.active) {
          if (Math.abs(ev.clientX - st.startClientX) < 5) return;
          st.active = true;
        }
        const tCur = timeFromClientX(ev.clientX);
        const t0 = st.startT;
        newCueRangePreviewRef.current = {
          tStart: Math.min(t0, tCur),
          tEnd: Math.max(t0, tCur),
        };
        redraw();
      };

      const onEmptyUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId || !emptyWaveDragRef.current) return;
        window.removeEventListener("pointermove", onEmptyMove);
        window.removeEventListener("pointerup", onEmptyUp);
        window.removeEventListener("pointercancel", onEmptyUp);
        try {
          c.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        const st = emptyWaveDragRef.current;
        emptyWaveDragRef.current = null;
        const preview = newCueRangePreviewRef.current;
        newCueRangePreviewRef.current = null;

        if (st?.active) {
          suppressNextWaveSeekRef.current = true;
        }

        if (
          st &&
          !st.active &&
          audioRef.current?.src &&
          durationRef.current > 0
        ) {
          const cnv = canvasRef.current;
          if (cnv) {
            const { viewStart, viewSpan } = lastWaveDrawRangeRef.current;
            if (viewSpan > 0) {
              const rr = cnv.getBoundingClientRect();
              const ww = rr.width;
              if (ww > 0) {
                const xUp = ev.clientX - rr.left;
                let tSeek = viewStart + (xUp / ww) * viewSpan;
                tSeek = Math.max(st.trimLo, Math.min(st.trimHi, tSeek));
                const au = audioRef.current;
                if (au) {
                  au.currentTime = tSeek;
                  setCurrentTime(tSeek);
                }
                onSelectedCueIdsChange([]);
                suppressNextWaveSeekRef.current = true;
                redraw();
              }
            }
          }
        }

        if (
          st?.active &&
          preview &&
          Number.isFinite(preview.tStart) &&
          Number.isFinite(preview.tEnd)
        ) {
          let ts = Math.min(preview.tStart, preview.tEnd);
          let te = Math.max(preview.tStart, preview.tEnd);
          ts = Math.round(ts * 100) / 100;
          te = Math.round(te * 100) / 100;
          if (te - ts < 0.1) {
            te = Math.round(Math.min(st.trimHi, ts + 0.1) * 100) / 100;
            if (te <= ts) {
              ts = Math.round(Math.max(st.trimLo, te - 0.1) * 100) / 100;
            }
          }
          if (te > ts && ts >= st.trimLo && te <= st.trimHi) {
            if (cues.length >= 100 || formations.length === 0) {
              redraw();
              return;
            }
            const newCueId = crypto.randomUUID();
            const rNew = resolveCueIntervalNonOverlap(
              cuesRef.current,
              newCueId,
              ts,
              te,
              st.trimLo,
              st.trimHi
            );
            const tsFinal = rNew.tStartSec;
            const teFinal = rNew.tEndSec;
            if (teFinal <= tsFinal + 1e-9) {
              redraw();
              return;
            }
            const appliedT = tsFinal;
            setProject((p) => {
              if (p.cues.length >= 100) return p;
              if (p.cues.some((c) => c.id === newCueId)) return p;
              const sourceF =
                p.formations.find((f) => f.id === formationIdForNewCue) ??
                p.formations[0];
              if (!sourceF) return p;
              const newFm = cloneFormationForNewCue(sourceF);
              const cue: Cue = {
                id: newCueId,
                tStartSec: tsFinal,
                tEndSec: teFinal,
                formationId: newFm.id,
              };
              return {
                ...p,
                formations: [...p.formations, newFm],
                cues: sortCuesByStart([...p.cues, cue]),
                activeFormationId: newFm.id,
              };
            });
            const a = audioRef.current;
            if (a && Number.isFinite(appliedT)) {
              a.currentTime = Math.max(
                trimStartSec,
                Math.min(trimEndSec ?? durationRef.current, appliedT)
              );
            }
            setCurrentTime(appliedT);
            onSelectedCueIdsChange([newCueId]);
            onFormationChosenFromCueList?.();
          }
        }
        redraw();
      };

      window.addEventListener("pointermove", onEmptyMove);
      window.addEventListener("pointerup", onEmptyUp);
      window.addEventListener("pointercancel", onEmptyUp);
      redraw();
    };

    const onWaveCanvasPointerMove = (
      e: React.PointerEvent<HTMLCanvasElement>
    ) => {
      if (project.viewMode === "view" || duration <= 0 || !peaks) return;
      if (
        cueDragRef.current ||
        playheadScrubDragRef.current ||
        emptyWaveDragRef.current
      ) {
        return;
      }
      if (e.buttons !== 0) return;
      const cnv = canvasRef.current;
      if (!cnv) return;
      const { viewStart, viewSpan } = lastWaveDrawRangeRef.current;
      if (viewSpan <= 0) return;
      const hit = pickCueDragKindAtWave(
        e.clientX,
        e.clientY,
        cnv,
        cues,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current
      );
      const prev = waveHoverCueRef.current;
      if (prev?.cueId === hit?.cueId && prev?.mode === hit?.mode) return;
      waveHoverCueRef.current = hit;
      const cur =
        hit?.mode === "start" || hit?.mode === "end"
          ? "ew-resize"
          : hit
            ? "move"
            : "pointer";
      cnv.style.cursor = cur;
      let tRedraw = currentTimePropRef.current;
      const au = audioRef.current;
      if (
        isPlayingForWaveRef.current &&
        au &&
        !au.paused &&
        Number.isFinite(au.currentTime)
      ) {
        tRedraw = au.currentTime;
      }
      drawWaveformAt(tRedraw);
    };

    const onWaveCanvasPointerLeave = () => {
      waveHoverCueRef.current = null;
      const cnv = canvasRef.current;
      if (cnv) cnv.style.cursor = duration > 0 ? "pointer" : "default";
      let tRedraw = currentTimePropRef.current;
      const au = audioRef.current;
      if (
        isPlayingForWaveRef.current &&
        au &&
        !au.paused &&
        Number.isFinite(au.currentTime)
      ) {
        tRedraw = au.currentTime;
      }
      drawWaveformAt(tRedraw);
    };

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compactTopDock ? 0 : tlPx(4),
          minHeight: 0,
          flex: "1 1 auto",
          fontSize: compactTopDock ? tlPx(11) : tlPx(12),
        }}
      >
        <input
          ref={audioFileInputRef}
          id="choreogrid-timeline-audio-file"
          type="file"
          accept="audio/*,video/*"
          style={{ display: "none" }}
          onChange={onPickAudio}
          onClick={() => {
            void preloadFFmpeg();
          }}
        />
        {extractProgress && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 12,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              padding: "6px 10px",
              borderRadius: "8px",
              background:
                "linear-gradient(90deg, rgba(79,70,229,0.22), rgba(14,165,233,0.18))",
              border: "1px solid rgba(99,102,241,0.5)",
              color: "#e2e8f0",
              fontSize: "12px",
              fontWeight: 600,
              boxShadow: "0 6px 20px rgba(15,23,42,0.35)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span>
                {extractProgress.stage === "loading"
                  ? "🔧"
                  : extractProgress.stage === "decode"
                    ? "⚡"
                    : extractProgress.stage === "wasm"
                      ? "🎛️"
                      : "🎙️"}{" "}
                {extractProgress.message ?? "音声を抽出中…"}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "#a5b4fc" }}>
                {Math.round(extractProgress.ratio * 100)}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "rgba(15,23,42,0.6)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(2, Math.min(100, extractProgress.ratio * 100))}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg, #6366f1, #22d3ee)",
                  transition: "width 160ms ease-out",
                }}
              />
            </div>
          </div>
        )}
        {!compactTopDock ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tlPx(4),
              minWidth: 0,
              width: "100%",
              contain: "layout",
              scrollbarWidth: "thin",
            }}
          >
            <>
              {/** 1 行目: 音源追加 → 戻る・進む（＋上部ドック時は右端に閉じる） */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  overflowX: "visible",
                  overflowY: "hidden",
                  gap: tlPx(5),
                  alignItems: "center",
                  rowGap: tlPx(3),
                  width: "100%",
                  minWidth: 0,
                }}
              >
                <label
                  htmlFor="choreogrid-timeline-audio-file"
                  style={{
                    ...timelineToolbarBtn,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: tlPx(32),
                    height: tlPx(28),
                    padding: 0,
                  }}
                  aria-label="音源追加"
                  title="楽曲または動画から音声を読み込み（MP4 / AVI / MOV / MKV / WMV 等に対応）"
                  onPointerEnter={() => {
                    void preloadFFmpeg();
                  }}
                  onFocus={() => {
                    void preloadFFmpeg();
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
                    <path
                      d="M12 5v14M5 12h14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </label>
                {onUndo && onRedo && (
                  <>
                    <div
                      style={{
                        width: "1px",
                        height: tlPx(16),
                        background: "#334155",
                        flexShrink: 0,
                      }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      style={timelineToolbarBtn}
                      disabled={undoDisabled}
                      title="編集を元に戻す（⌘Z / Ctrl+Z）"
                      aria-label="戻る"
                      onClick={() => onUndo()}
                    />
                    <button
                      type="button"
                      style={timelineToolbarBtn}
                      disabled={redoDisabled}
                      title="やり直す（⌘⇧Z / Ctrl+Shift+Z）"
                      aria-label="進む"
                      onClick={() => onRedo()}
                    />
                  </>
                )}
                {waveTimelineDockTop && wideWorkbench && onWaveTimelineDockTopChange ? (
                  <div
                    style={{
                      marginLeft: "auto",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: tlPx(4),
                      position: "sticky",
                      right: 0,
                      zIndex: 3,
                      paddingLeft: tlPx(10),
                      background:
                        "linear-gradient(90deg, transparent, #020617 28%, #020617)",
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        ...timelineToolbarBtn,
                        fontWeight: 700,
                        borderColor: "#64748b",
                        color: "#f8fafc",
                        padding: `${tlPx(3)} ${tlPx(10)}`,
                      }}
                      disabled={project.viewMode === "view"}
                      title="画面上部の波形エリアを閉じ、タイムラインを右列の通常位置に戻します"
                      aria-label="上部の波形エリアを閉じる"
                      onClick={() => onWaveTimelineDockTopChange(false)}
                    />
                  </div>
                ) : null}
              </div>
              {/** 2 行目: 再生・シーク → タイム表示 */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  overflowX: "visible",
                  overflowY: "hidden",
                  gap: tlPx(5),
                  alignItems: "center",
                  rowGap: tlPx(3),
                  width: "100%",
                  minWidth: 0,
                }}
              >
                <button
                  type="button"
                  style={timelineToolbarBtn}
                  onClick={togglePlay}
                  aria-label={isPlaying ? "一時停止" : "再生"}
                  title={isPlaying ? "一時停止" : "再生"}
                >
                  {isPlaying ? "一時停止" : "再生"}
                </button>
                <button
                  type="button"
                  style={timelineToolbarBtn}
                  disabled={project.viewMode === "view" || duration <= 0}
                  title="再生位置を 5 秒進める（トリム範囲内に収めます）"
                  aria-label="5秒進む"
                  onClick={seekForward5Sec}
                />
                <button
                  type="button"
                  style={timelineToolbarBtn}
                  disabled={project.viewMode === "view" || duration <= 0}
                  title="再生位置を 5 秒戻す（トリム範囲内に収めます）"
                  aria-label="5秒戻す"
                  onClick={seekBackward5Sec}
                />
                <button
                  type="button"
                  style={timelineToolbarBtn}
                  disabled={project.viewMode === "view" || duration <= 0}
                  title="再生を止め、先頭（トリム開始位置）に戻します"
                  aria-label="先頭へ"
                  onClick={stopPlayback}
                />
                <PlaybackClockReadout
                  audioRef={audioRef}
                  isPlaying={isPlaying}
                  idleTimeSec={currentTime}
                  durationSec={duration}
                  monoFontSizePx={13 * TIMELINE_UI_SCALE}
                />
              </div>
            </>
          </div>
        ) : (
          <div
            className="wave-compact-time-above-wave"
            style={{
              display: "flex",
              flexWrap: "nowrap",
              alignItems: "center",
              gap: tlPx(4),
              width: "100%",
              minWidth: 0,
              padding: `${tlPx(0)} ${tlPx(6)} ${tlPx(2)}`,
              borderBottom: `1px solid ${shell.border}`,
              flexShrink: 0,
              background: shell.bgChrome,
            }}
          >
            {onUndo ? (
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  width: tlPx(30),
                  height: tlPx(28),
                  minWidth: tlPx(30),
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: tlPx(14),
                  flexShrink: 0,
                }}
                disabled={undoDisabled}
                title="編集を元に戻す（⌘Z / Ctrl+Z）"
                aria-label="元に戻す"
                onClick={() => onUndo()}
              >
                ◀
              </button>
            ) : (
              <div style={{ width: tlPx(30), flexShrink: 0 }} aria-hidden />
            )}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: tlPx(6),
              }}
            >
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  padding: `${tlPx(4)} ${tlPx(12)}`,
                  minHeight: tlPx(28),
                  fontWeight: 600,
                  flexShrink: 0,
                }}
                disabled={project.viewMode === "view"}
                onClick={togglePlay}
                aria-label={isPlaying ? "一時停止" : "再生"}
                title={isPlaying ? "一時停止" : "再生"}
              >
                {isPlaying ? "一時停止" : "再生"}
              </button>
              <PlaybackClockReadout
                audioRef={audioRef}
                isPlaying={isPlaying}
                idleTimeSec={currentTime}
                durationSec={duration}
                monoFontSizePx={12 * TIMELINE_UI_SCALE}
              />
            </div>
            {onRedo ? (
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  width: tlPx(30),
                  height: tlPx(28),
                  minWidth: tlPx(30),
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: tlPx(14),
                  flexShrink: 0,
                }}
                disabled={redoDisabled}
                title="やり直す（⌘⇧Z / Ctrl+Shift+Z）"
                aria-label="やり直す"
                onClick={() => onRedo()}
              >
                ▶
              </button>
            ) : (
              <div style={{ width: tlPx(30), flexShrink: 0 }} aria-hidden />
            )}
          </div>
        )}
        <div
          ref={waveContainerRef}
          title="波形上でマウスホイール（またはトラックパッドの縦スクロール）で時間軸の拡大・縮小。下の枠線付近をドラッグすると波形の縦の高さを変えられます。"
          style={{
            width: "100%",
            borderRadius: "6px",
            border: "1px solid #334155",
            overflow: "hidden",
            background: "#020617",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "relative",
              height: compactTopDock ? "13px" : "16px",
              fontSize: compactTopDock ? "8px" : "9px",
              color: "#94a3b8",
              borderBottom: "1px solid #1e293b",
              fontVariantNumeric: "tabular-nums",
              userSelect: "none",
              overflow: "hidden",
            }}
            aria-hidden
          >
            {duration > 0
              ? waveRulerTicks(waveView.start, waveView.end, 10).map((tick) => {
                  const span = waveView.span;
                  const p = span > 0 ? ((tick - waveView.start) / span) * 100 : 0;
                  const pRounded = Math.round(p * 10000) / 10000;
                  return (
                    <span
                      key={tick}
                      style={{
                        position: "absolute",
                        top: compactTopDock ? "2px" : "3px",
                        left: `${pRounded}%`,
                        transform: "translate3d(-50%, 0, 0)",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        willChange: "transform",
                      }}
                    >
                      {formatMmSs(tick)}
                    </span>
                  );
                })
              : null}
          </div>
          <canvas
            ref={canvasRef}
            width={800}
            height={waveCanvasCssH * 2}
            tabIndex={0}
            role="application"
            aria-label="楽曲波形・キュー区間"
            onClick={onWaveClick}
            onDoubleClick={onWaveDoubleClick}
            onContextMenu={onWaveContextMenu}
            onPointerDown={onWaveCanvasPointerDown}
            onPointerMove={onWaveCanvasPointerMove}
            onPointerLeave={onWaveCanvasPointerLeave}
            style={{
              display: "block",
              width: "100%",
              height: `${waveCanvasCssH}px`,
              cursor: duration > 0 ? "pointer" : "default",
              touchAction: "none",
              outline: "none",
            }}
            onFocus={(ev) => {
              ev.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(129, 140, 248, 0.6)";
            }}
            onBlur={(ev) => {
              ev.currentTarget.style.boxShadow = "none";
            }}
          />
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="波形の高さを変更"
            onPointerDown={onWaveBorderResizePointerDown}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 10,
              cursor: "ns-resize",
              touchAction: "none",
              zIndex: 4,
            }}
          />
        </div>
        {(() => {
          const cueListContent = (
            <>
        <div
          style={{
            flex: "1 1 0%",
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: "1 1 auto", minHeight: 0 }}>
            {sortCuesByStart(cues).map((c, sortedIdx) => {
                const cueNum = sortedIdx + 1;
                const fname =
                  formations.find((f) => f.id === c.formationId)?.name ?? "?";
                const cueFormation = formations.find((f) => f.id === c.formationId);
                const listTitle =
                  (c.name?.trim() ? `${c.name.trim()} · ` : "") + `形: ${fname}`;
                return (
                  <li
                    key={c.id}
                    title={listTitle}
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => {
                      const t = ev.target as HTMLElement;
                      if (t.closest("input, select, textarea, button")) return;
                      if (ev.metaKey || ev.ctrlKey) {
                        onSelectedCueIdsChange((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((x) => x !== c.id)
                            : [...prev, c.id]
                        );
                      } else {
                        onSelectedCueIdsChange([c.id]);
                      }
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        if (ev.metaKey || ev.ctrlKey) {
                          onSelectedCueIdsChange((prev) =>
                            prev.includes(c.id)
                              ? prev.filter((x) => x !== c.id)
                              : [...prev, c.id]
                          );
                        } else {
                          onSelectedCueIdsChange([c.id]);
                        }
                      }
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      padding: "6px 0",
                      borderBottom: "1px solid #1e293b",
                      borderLeft:
                        selectedCueIds.includes(c.id)
                          ? "3px solid #f472b6"
                          : "3px solid transparent",
                      paddingLeft: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                      }}
                    >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "auto minmax(27px, auto) minmax(27px, auto) auto auto",
                        gap: "8px",
                        alignItems: "end",
                        width: "100%",
                        minWidth: "min(100%, 560px)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          alignItems: "flex-end",
                          justifyContent: "flex-end",
                        }}
                      >
                        <span
                          aria-label={`キュー ${cueNum}`}
                          style={{
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 700,
                            fontSize: "13px",
                            color: "#94a3b8",
                            minWidth: "1.5em",
                            textAlign: "right",
                            lineHeight: 1.25,
                          }}
                        >
                          {cueNum}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <CueTimeInput
                          variant="cueRow"
                          ariaLabel={`キュー${cueNum} 開始時刻`}
                          timeSec={c.tStartSec}
                          disabled={project.viewMode === "view"}
                          onCommit={(v) => {
                            let tEnd = c.tEndSec;
                            let tStart = v;
                            if (tStart >= tEnd) {
                              tEnd = Math.round((tStart + 0.01) * 100) / 100;
                            }
                            updateCue(c.id, { tStartSec: tStart, tEndSec: tEnd });
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <CueTimeInput
                          variant="cueRow"
                          ariaLabel={`キュー${cueNum} 終了時刻`}
                          timeSec={c.tEndSec}
                          disabled={project.viewMode === "view"}
                          onCommit={(v) => {
                            let tStart = c.tStartSec;
                            const tEnd = v;
                            if (tEnd <= tStart) {
                              tStart = Math.round((tEnd - 0.01) * 100) / 100;
                            }
                            updateCue(c.id, { tStartSec: tStart, tEndSec: tEnd });
                          }}
                        />
                      </div>
                      {cueFormation ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                            flexShrink: 0,
                            justifySelf: "start",
                            justifyContent: "flex-end",
                          }}
                        >
                          <div
                            title="人数を増減"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                          <button
                            type="button"
                            aria-label="人数を減らす"
                            disabled={
                              project.viewMode === "view" ||
                              cueFormation.dancers.length <= 1
                            }
                            onClick={() =>
                              adjustFormationDancerCount(c.formationId, -1)
                            }
                            style={{
                              ...btnSecondary,
                              padding: "4px 8px",
                              minWidth: "28px",
                              fontSize: "14px",
                              lineHeight: 1,
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              minWidth: "22px",
                              textAlign: "center",
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 700,
                              color: "#e2e8f0",
                              fontSize: "12px",
                            }}
                          >
                            {cueFormation.dancers.length}
                          </span>
                          <button
                            type="button"
                            aria-label="人数を増やす"
                            disabled={
                              project.viewMode === "view" ||
                              cueFormation.dancers.length >= 80
                            }
                            onClick={() =>
                              adjustFormationDancerCount(c.formationId, 1)
                            }
                            style={{
                              ...btnSecondary,
                              padding: "4px 8px",
                              minWidth: "28px",
                              fontSize: "14px",
                              lineHeight: 1,
                            }}
                          >
                            +
                          </button>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: "11px" }}>—</span>
                      )}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          justifySelf: "end",
                          justifyContent: "flex-end",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            flexWrap: "nowrap",
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          <button
                            type="button"
                            disabled={project.viewMode === "view"}
                            title="同じ長さで複製"
                            style={{ ...btnSecondary, padding: "6px 8px", fontSize: "11px" }}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              duplicateCueSameSettings(c);
                            }}
                          >
                            複製
                          </button>
                          <button
                            type="button"
                            disabled={project.viewMode === "view"}
                            style={{ ...btnSecondary, padding: "6px 8px", fontSize: "11px" }}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              removeCue(c.id);
                            }}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
            </>
          );
          if (!compactTopDock) return cueListContent;
          if (!cueListPortalTarget) return null;
          return createPortal(cueListContent, cueListPortalTarget);
        })()}
        <audio ref={audioRef} style={{ display: "none" }} controls={false} />
      </div>
    );
  }
);

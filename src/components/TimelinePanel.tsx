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
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import type { CSSProperties, Dispatch, RefObject, SetStateAction } from "react";
import type { ChoreographyProjectJson, Cue, DancerSpot } from "../types/choreography";
import {
  cloneFormationForNewCue,
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
  expandShortCuesAfterAudioLoad,
  MIN_CUE_DURATION_SEC,
  PLACEHOLDER_TIMELINE_CAP_SEC,
  resolveCueIntervalNonOverlap,
  sortCuesByStart,
} from "../lib/cueInterval";
import {
  listFormationBoxItemsByCount,
  saveFormationToBox,
} from "../lib/formationBox";
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

/**
 * サーバ `audioAssetId` 用の署名付き Blob URL。TimelinePanel が名簿モード等でアンマウントされても
 * 同じ id なら再利用し、再フェッチ失敗や revoke 競合で音が消えるのを防ぐ。
 */
let persistedServerAudioBlobUrl: string | null = null;
let persistedServerAudioAssetId: number | null = null;

function revokePersistedServerAudioBlob() {
  if (persistedServerAudioBlobUrl) {
    URL.revokeObjectURL(persistedServerAudioBlobUrl);
    persistedServerAudioBlobUrl = null;
    persistedServerAudioAssetId = null;
  }
}

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

/** 上部ドック用：細い円枠＋白の巻き戻し系矢印（Redo は左右反転） */
const WAVE_HISTORY_ARROW = "rgba(255, 255, 255, 0.96)";
const WAVE_HISTORY_RING = "rgba(148, 163, 184, 0.55)";
const WAVE_HISTORY_ICON_PX = 27; /* 18 の 1.5 倍 */
const WAVE_HISTORY_ARROW_STROKE = 2.75;

function WaveHistoryRoundIcon({ kind }: { kind: "undo" | "redo" }) {
  const mirror = kind === "redo";
  return (
    <svg
      width={WAVE_HISTORY_ICON_PX}
      height={WAVE_HISTORY_ICON_PX}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ display: "block" }}
    >
      <g transform={mirror ? "translate(24 0) scale(-1 1)" : undefined}>
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={WAVE_HISTORY_RING}
          strokeWidth="1.15"
        />
        <path
          fill="none"
          stroke={WAVE_HISTORY_ARROW}
          strokeWidth={WAVE_HISTORY_ARROW_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m9 14-5-5 5-5"
        />
        <path
          fill="none"
          stroke={WAVE_HISTORY_ARROW}
          strokeWidth={WAVE_HISTORY_ARROW_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"
        />
      </g>
    </svg>
  );
}

/** 上部ツールバー左：ブランドバナー（作品一覧へ） */
function ChoreoGridHeaderBrand({ compact }: { compact?: boolean }) {
  return (
    <Link
      to="/library"
      title="作品一覧へ"
      aria-label="CHOREOGRID（作品一覧へ）"
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        minWidth: 0,
        maxWidth: compact ? "min(200px, 36vw)" : "min(260px, 44vw)",
        textDecoration: "none",
        borderRadius: tlPx(6),
        overflow: "hidden",
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}choreogrid-header-banner.png`}
        alt="CHOREOGRID"
        width={640}
        height={160}
        style={{
          height: compact ? tlPx(22) : tlPx(26),
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          objectPosition: "left center",
          display: "block",
          filter:
            "drop-shadow(0 0 12px rgba(168, 85, 247, 0.35)) drop-shadow(0 0 18px rgba(34, 211, 238, 0.2))",
        }}
        draggable={false}
      />
    </Link>
  );
}

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

/**
 * 波形の左右に余白を取り、内側に縮小して描く・座標変換する。
 * 端のサンプルや縦ストロークが枠から僅かにはみ出して見えるのを抑える（音源取込直後の全長表示でも収まりやすくする）。
 */
const WAVE_X_INSET_FRAC = 0.035;

function waveTimeToExtentX(
  tSec: number,
  viewStart: number,
  viewSpan: number,
  extentPx: number
): number {
  if (viewSpan <= 0 || extentPx <= 0) return 0;
  const pad = extentPx * WAVE_X_INSET_FRAC;
  const inner = extentPx - 2 * pad;
  const f = clamp((tSec - viewStart) / viewSpan, 0, 1);
  return pad + f * inner;
}

function waveExtentXToTime(
  xPx: number,
  viewStart: number,
  viewSpan: number,
  extentPx: number
): number {
  if (viewSpan <= 0 || extentPx <= 0) return viewStart;
  const pad = extentPx * WAVE_X_INSET_FRAC;
  const inner = extentPx - 2 * pad;
  if (inner <= 1e-6) return viewStart;
  const f = clamp((xPx - pad) / inner, 0, 1);
  return viewStart + f * viewSpan;
}

/** 波形キャンバス表示高さ（CSS px）。下枠ドラッグで変更 */
const WAVE_CANVAS_H_MIN = 24;
const WAVE_CANVAS_H_MAX = 280;
/** 既定は従来の約半分（上部ドック内で波形が収まりやすい） */
const WAVE_CANVAS_H_DEFAULT = 36;
/** 上部ドック時はさらにコンパクト */
const WAVE_CANVAS_H_COMPACT_DOCK = 44;

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
    const x1 = waveTimeToExtentX(Math.max(ts, viewStart), viewStart, viewSpan, w);
    const x2 = waveTimeToExtentX(Math.min(te, viewEnd), viewStart, viewSpan, w);
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
  const x1 = waveTimeToExtentX(Math.max(ts, viewStart), viewStart, viewSpan, w);
  const x2 = waveTimeToExtentX(Math.min(te, viewEnd), viewStart, viewSpan, w);
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  let mode: CueDragEdgeMode = "move";
  if (x <= left + CUE_EDGE_GRAB_PX) mode = "start";
  else if (x >= right - CUE_EDGE_GRAB_PX) mode = "end";
  return { cueId: id, mode };
}

/** 再生ヘッド縦線のドラッグ・クリック用ヒット幅（片側 CSS px）。狭いと掴みにくいので広め */
const PLAYHEAD_SCRUB_HALF_WIDTH_PX = 16;

/** 目盛り行〜波形にかけて再生位置線を少しはみ出して見せる（CSS px） */
const PLAYHEAD_LINE_BLEED_TOP_CSS = 14;
const PLAYHEAD_LINE_BLEED_BOTTOM_CSS = 8;

/** 再生ヘッド（縦線）付近をドラッグしてシーク試聴するためのヒット（CSS ピクセル） */
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
    : waveTimeToExtentX(playheadSec, viewStart, viewSpan, w);
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
    /** 目盛り〜波形にはみ出す再生位置線（キャンバス座標と同期、pointer-events なし） */
    const playheadLineOverlayRef = useRef<HTMLDivElement>(null);
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
    /** アンマウント時に revoke しない（名簿取り込みでタイムラインが外れても音源 URL を無効化しない）。差し替えは fetch / ファイル選択側で行う */
    const blobUrlRef = useRef<string | null>(null);
    /** 1 = 曲全体表示。小さいほど拡大（見える時間幅が狭い） */
    const [viewPortion, setViewPortion] = useState(1);
    const [waveCanvasCssH, setWaveCanvasCssH] = useState(() =>
      compactTopDock ? WAVE_CANVAS_H_COMPACT_DOCK : WAVE_CANVAS_H_DEFAULT
    );
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

    /** ステージページャ・一覧番号・波形ヒットを常に同じ時間順（＋ id タイブレーク）に揃える */
    const cuesSorted = useMemo(() => sortCuesByStart(cues), [cues]);

    const cuesRef = useRef<Cue[]>(cuesSorted);
    cuesRef.current = cuesSorted;

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
    /** 波形上のキュー右クリック: メニュー位置と対象 id */
    const [waveCueMenu, setWaveCueMenu] = useState<{
      cueId: string;
      clientX: number;
      clientY: number;
    } | null>(null);
    /** メニューで選んだ操作の最終確認 */
    const [waveCueConfirm, setWaveCueConfirm] = useState<
      null | { kind: "duplicate" | "formationBox"; cueId: string }
    >(null);
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
        const xTrim = waveTimeToExtentX(trimS, viewStart, viewSpan, w);
        if (xTrim > 0 && xTrim < w) {
          g.fillStyle = "rgba(15,23,42,0.55)";
          g.fillRect(0, 0, xTrim, h);
        }
      }
      if (d > 0 && trimE != null && trimE < d) {
        const xTrim = waveTimeToExtentX(trimE, viewStart, viewSpan, w);
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
        const x = waveTimeToExtentX(t, viewStart, viewSpan, w);
        if (x < -1 || x > w + 1) return;
        const amp = waveAmpRef.current;
        const ph = Math.min(h * 0.45, ((p * h) / 2) * amp);
        g.beginPath();
        g.moveTo(x, mid - ph);
        g.lineTo(x, mid + ph);
        g.stroke();
      });

      const cueList = cuesRef.current;
      const dragCueId = cueDragRef.current?.cueId ?? null;
      const dragPrev = cueDragPreviewRangeRef.current;
      /** 波形枠いっぱいのキュー帯：内側透明・金枠。上下辺の左右端だけ太くして端リサイズしやすくする */
      const drawWaveCueChrome = (
        left: number,
        width: number,
        opts: {
          isDrag: boolean;
          isSel: boolean;
          hoverStart: boolean;
          hoverEnd: boolean;
          isHover: boolean;
        }
      ) => {
        const inset = 0.5;
        const top = inset;
        const boxH = h - inset * 2;
        const edgeSeg = Math.min(18, Math.max(6, width * 0.14));
        const baseLw = opts.isSel ? 1.75 : opts.isDrag ? 1.65 : 1.35;
        const gold =
          opts.isSel || opts.isDrag
            ? "rgba(234, 200, 95, 0.98)"
            : opts.isHover
              ? "rgba(212, 175, 55, 0.92)"
              : "rgba(212, 175, 55, 0.82)";
        const goldEdge =
          opts.hoverStart || opts.hoverEnd
            ? "rgba(250, 230, 160, 0.98)"
            : gold;

        g.strokeStyle = gold;
        g.lineWidth = baseLw;
        g.lineJoin = "miter";
        g.lineCap = "butt";
        g.strokeRect(left + inset, top, width - inset * 2, boxH);

        g.strokeStyle = goldEdge;
        g.lineWidth = 3.25;
        g.beginPath();
        g.moveTo(left + inset, top);
        g.lineTo(left + inset + Math.min(edgeSeg, width * 0.45), top);
        g.stroke();
        g.beginPath();
        g.moveTo(left + width - inset - Math.min(edgeSeg, width * 0.45), top);
        g.lineTo(left + width - inset, top);
        g.stroke();
        g.beginPath();
        g.moveTo(left + inset, top + boxH);
        g.lineTo(left + inset + Math.min(edgeSeg, width * 0.45), top + boxH);
        g.stroke();
        g.beginPath();
        g.moveTo(left + width - inset - Math.min(edgeSeg, width * 0.45), top + boxH);
        g.lineTo(left + width - inset, top + boxH);
        g.stroke();

        g.strokeStyle = goldEdge;
        g.lineWidth = opts.hoverStart || opts.hoverEnd ? 3.6 : 2.4;
        g.lineCap = "butt";
        if (opts.hoverStart) {
          g.beginPath();
          g.moveTo(left + inset, top);
          g.lineTo(left + inset, top + boxH);
          g.stroke();
        }
        if (opts.hoverEnd) {
          g.beginPath();
          g.moveTo(left + width - inset, top);
          g.lineTo(left + width - inset, top + boxH);
          g.stroke();
        }
      };

      if (d > 0 && viewSpan > 0 && cueList.length > 0) {
        for (const cue of cueList) {
          let ts = cue.tStartSec;
          let te = cue.tEndSec;
          if (dragPrev && dragPrev.cueId === cue.id) {
            ts = dragPrev.tStart;
            te = dragPrev.tEnd;
          }
          if (te < viewStart || ts > viewEnd) continue;
          const x1 = waveTimeToExtentX(Math.max(ts, viewStart), viewStart, viewSpan, w);
          const x2 = waveTimeToExtentX(Math.min(te, viewEnd), viewStart, viewSpan, w);
          const left = Math.min(x1, x2);
          const width = Math.max(3, Math.abs(x2 - x1));
          const isDrag = dragCueId === cue.id;
          const isSel = selectedCueIdsRef.current.includes(cue.id);
          const hover = waveHoverCueRef.current;
          const isHover =
            hover?.cueId === cue.id && (!dragCueId || dragCueId !== cue.id);
          const hoverStart = isHover && hover.mode === "start";
          const hoverEnd = isHover && hover.mode === "end";
          drawWaveCueChrome(left, width, {
            isDrag,
            isSel,
            hoverStart,
            hoverEnd,
            isHover,
          });
        }
      }

      const newPrev = newCueRangePreviewRef.current;
      if (d > 0 && viewSpan > 0 && newPrev) {
        let ts = newPrev.tStart;
        let te = newPrev.tEnd;
        if (te < ts) [ts, te] = [te, ts];
        if (te >= viewStart && ts <= viewEnd) {
          const x1 = waveTimeToExtentX(Math.max(ts, viewStart), viewStart, viewSpan, w);
          const x2 = waveTimeToExtentX(Math.min(te, viewEnd), viewStart, viewSpan, w);
          const left = Math.min(x1, x2);
          const width = Math.max(3, Math.abs(x2 - x1));
          const inset = 0.5;
          const top = inset;
          const boxH = h - inset * 2;
          const edgeSeg = Math.min(18, Math.max(6, width * 0.14));
          const teal = "rgba(45, 212, 191, 0.88)";
          const tealHi = "rgba(110, 231, 210, 0.95)";
          g.strokeStyle = teal;
          g.lineWidth = 1.35;
          g.lineJoin = "miter";
          g.lineCap = "butt";
          g.strokeRect(left + inset, top, width - inset * 2, boxH);
          g.strokeStyle = tealHi;
          g.lineWidth = 3.1;
          g.beginPath();
          g.moveTo(left + inset, top);
          g.lineTo(left + inset + Math.min(edgeSeg, width * 0.45), top);
          g.stroke();
          g.beginPath();
          g.moveTo(left + width - inset - Math.min(edgeSeg, width * 0.45), top);
          g.lineTo(left + width - inset, top);
          g.stroke();
          g.beginPath();
          g.moveTo(left + inset, top + boxH);
          g.lineTo(left + inset + Math.min(edgeSeg, width * 0.45), top + boxH);
          g.stroke();
          g.beginPath();
          g.moveTo(left + width - inset - Math.min(edgeSeg, width * 0.45), top + boxH);
          g.lineTo(left + width - inset, top + boxH);
          g.stroke();
        }
      }

      const lineEl = playheadLineOverlayRef.current;
      if (d > 0 && viewSpan > 0) {
        const zoomed = vp < 1 - 1e-9;
        let xPlay: number;
        if (zoomed) {
          xPlay = WAVE_PLAYHEAD_X_FRAC * w;
        } else {
          xPlay = waveTimeToExtentX(playheadTime, viewStart, viewSpan, w);
          if (Number.isFinite(xPlay)) {
            xPlay = Math.min(w, Math.max(0, Math.round(xPlay * 2) / 2));
          } else {
            xPlay = 0;
          }
        }
        g.strokeStyle = "#ef4444";
        g.lineWidth = 2.5;
        g.lineCap = "butt";
        g.beginPath();
        g.moveTo(xPlay + 0.5, 0);
        g.lineTo(xPlay + 0.5, h);
        g.stroke();
        if (lineEl) {
          const pct = ((xPlay + 0.5) / w) * 100;
          lineEl.style.display = "block";
          lineEl.style.left = `${pct}%`;
        }
      } else if (lineEl) {
        lineEl.style.display = "none";
      }
    }, []);

    /**
     * スマホ等では表示幅に合わせてビットマップ幅を抑え、常時 800px 描画より GPU/CPU 負荷を下げる。
     * ワイド時は従来どおり DPR 上限 2。
     */
    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const syncBitmapSize = () => {
        const rect = canvas.getBoundingClientRect();
        const cssW = rect.width;
        if (cssW <= 2) return;
        const dpr =
          typeof window !== "undefined"
            ? Math.min(window.devicePixelRatio || 1, wideWorkbench ? 2 : 1.35)
            : 1;
        const bw = Math.max(280, Math.min(1600, Math.round(cssW * dpr)));
        const bh = Math.round(waveCanvasCssHRef.current * 2);
        if (canvas.width !== bw || canvas.height !== bh) {
          canvas.width = bw;
          canvas.height = bh;
        }
        const pk = peaksRef.current;
        if (!pk) return;
        const a = audioRef.current;
        const tRedraw =
          isPlayingForWaveRef.current &&
          a &&
          !a.paused &&
          Number.isFinite(a.currentTime)
            ? a.currentTime
            : currentTimePropRef.current;
        drawWaveformAt(tRedraw);
      };

      syncBitmapSize();
      const ro = new ResizeObserver(() => {
        syncBitmapSize();
      });
      ro.observe(canvas);
      return () => ro.disconnect();
    }, [wideWorkbench, waveCanvasCssH, drawWaveformAt, peaks]);

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
      cuesSorted,
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
      cuesSorted,
      selectedCueIds,
      project.waveformAmplitudeScale,
      waveCanvasCssH,
    ]);

    useEffect(() => {
      setViewPortion(1);
    }, [peaks]);

    /** 右列→上部ドックへ切り替えた直後など、波形高さが既定より小さいままだと帯が潰れて見えなくなるのを防ぐ */
    useEffect(() => {
      if (!compactTopDock) return;
      setWaveCanvasCssH((h) =>
        Math.min(WAVE_CANVAS_H_MAX, Math.max(h, WAVE_CANVAS_H_COMPACT_DOCK))
      );
    }, [compactTopDock]);

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
      if (!waveCueMenu && !waveCueConfirm) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        setWaveCueConfirm(null);
        setWaveCueMenu(null);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [waveCueMenu, waveCueConfirm]);

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
        if (Number.isFinite(dur) && dur > 0) {
          setDuration(dur);
          setProject((p) => expandShortCuesAfterAudioLoad(p, dur));
        }
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
    }, [setDuration, setIsPlaying, setProject]);

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
      /** `<audio>` の loadedmetadata より確実。立ち位置→後から音源のとき duration が 0 のままだと波形が一切描画されない */
      const durSec = audioBuf.duration;
      if (Number.isFinite(durSec) && durSec > 0) {
        setDuration(durSec);
        setProject((p) => expandShortCuesAfterAudioLoad(p, durSec));
      }
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
    }, [setDuration, setProject]);

    useEffect(() => {
      const aid = project.audioAssetId;
      if (aid == null || !getToken()) {
        if (aid == null) {
          revokePersistedServerAudioBlob();
        }
        return;
      }
      if (
        persistedServerAudioAssetId != null &&
        persistedServerAudioAssetId !== aid
      ) {
        revokePersistedServerAudioBlob();
      }
      let cancelled = false;
      (async () => {
        try {
          const reuseUrl =
            persistedServerAudioAssetId === aid
              ? persistedServerAudioBlobUrl
              : null;
          if (reuseUrl) {
            const cur = blobUrlRef.current;
            if (cur && cur !== reuseUrl) {
              URL.revokeObjectURL(cur);
            }
            blobUrlRef.current = reuseUrl;
            const a0 = audioRef.current;
            if (a0) {
              a0.src = reuseUrl;
              a0.load();
            }
            const res = await fetch(`/api/audio/${aid}`, {
              headers: { Authorization: `Bearer ${getToken()}` },
            });
            const buf = await res.arrayBuffer();
            if (!cancelled) await decodePeaksFromBuffer(buf);
            return;
          }

          const url = await fetchAuthorizedAudioBlobUrl(aid);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          if (blobUrlRef.current && blobUrlRef.current !== persistedServerAudioBlobUrl) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          blobUrlRef.current = url;
          persistedServerAudioBlobUrl = url;
          persistedServerAudioAssetId = aid;
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
      if (blobUrlRef.current) {
        const cur = blobUrlRef.current;
        if (cur === persistedServerAudioBlobUrl) {
          revokePersistedServerAudioBlob();
        } else {
          URL.revokeObjectURL(cur);
        }
      }
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
        peaks != null && cuesSorted.length > 0
          ? pickCueIdAtWave(
              e.clientX,
              e.clientY,
              c,
              cuesSorted,
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
      const t = waveExtentXToTime(x, viewStart, viewSpan, r.width);
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
        cuesSorted,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current
      );
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      onSelectedCueIdsChange([id]);
      setWaveCueConfirm(null);
      setWaveCueMenu({ cueId: id, clientX: e.clientX, clientY: e.clientY });
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
          const d =
            durationRef.current > 0
              ? durationRef.current
              : PLACEHOLDER_TIMELINE_CAP_SEC;
          const trimHi = p.trimEndSec ?? d;
          const trimLo = p.trimStartSec;
          let t0 = Math.round(t0Raw * 100) / 100;
          t0 = Math.max(trimLo, Math.min(trimHi - 0.02, t0));
          let t1 = Math.min(
            trimHi,
            Math.round((t0 + DEFAULT_CUE_SPAN_WITH_AUDIO_SEC) * 100) / 100
          );
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
          if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
            t0 = trimLo;
            t1 = Math.min(
              trimHi,
              Math.round((trimLo + MIN_CUE_DURATION_SEC) * 100) / 100
            );
          }
          if (t1 < t0 + MIN_CUE_DURATION_SEC - 1e-9) {
            t1 = Math.round((t0 + MIN_CUE_DURATION_SEC) * 100) / 100;
            if (t1 > trimHi) {
              t1 = trimHi;
              t0 = Math.round(
                (Math.max(trimLo, t1 - MIN_CUE_DURATION_SEC)) * 100
              ) / 100;
            }
          }
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
        const seekCap =
          durationRef.current > 0
            ? durationRef.current
            : PLACEHOLDER_TIMELINE_CAP_SEC;
        if (a && Number.isFinite(appliedT)) {
          a.currentTime = Math.max(
            trimStartSec,
            Math.min(trimEndSec ?? seekCap, appliedT)
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
      const t = waveExtentXToTime(x, viewStart, viewSpan, r.width);
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
          const trimHi =
            p.trimEndSec ??
            (durationRef.current > 0
              ? durationRef.current
              : PLACEHOLDER_TIMELINE_CAP_SEC);
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
          const d =
            durationRef.current > 0
              ? durationRef.current
              : PLACEHOLDER_TIMELINE_CAP_SEC;
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
        const cap =
          durationRef.current > 0
            ? durationRef.current
            : PLACEHOLDER_TIMELINE_CAP_SEC;
        if (a && Number.isFinite(appliedT)) {
          a.currentTime = Math.max(
            project.trimStartSec,
            Math.min(project.trimEndSec ?? cap, appliedT)
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

    /**
     * 波形から: 指定キューの直後に、同じ長さ・同じ立ち位置の複製を置く（区間は非重複に調整）。
     */
    const duplicateCueAfterSource = useCallback(
      (source: Cue) => {
        if (project.viewMode === "view") return;
        const newCueId = crypto.randomUUID();
        let appliedT = 0;
        setProject((p) => {
          if (p.cues.length >= 100) return p;
          const srcFm = p.formations.find((f) => f.id === source.formationId);
          if (!srcFm) return p;
          const newFm = cloneFormationForNewCue(srcFm);
          const d =
            durationRef.current > 0
              ? durationRef.current
              : PLACEHOLDER_TIMELINE_CAP_SEC;
          const trimHi = p.trimEndSec ?? d;
          const trimLo = p.trimStartSec;
          const dur = Math.max(0.02, source.tEndSec - source.tStartSec);
          let t0 = Math.round(source.tEndSec * 100) / 100;
          let t1 = Math.round((t0 + dur) * 100) / 100;
          if (t1 > trimHi) {
            t1 = trimHi;
            t0 = Math.round((t1 - dur) * 100) / 100;
          }
          if (t0 < trimLo) {
            t0 = trimLo;
            t1 = Math.round(Math.min(trimHi, t0 + dur) * 100) / 100;
          }
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
        const cap =
          durationRef.current > 0
            ? durationRef.current
            : PLACEHOLDER_TIMELINE_CAP_SEC;
        const trimHi = project.trimEndSec ?? cap;
        if (a && Number.isFinite(appliedT)) {
          a.currentTime = Math.max(
            project.trimStartSec,
            Math.min(trimHi, appliedT)
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
        setCurrentTime,
        onFormationChosenFromCueList,
        onSelectedCueIdsChange,
      ]
    );

    const saveCueFormationToBoxList = useCallback(
      (cueId: string) => {
        const c = project.cues.find((x) => x.id === cueId);
        if (!c) return;
        const f = project.formations.find((x) => x.id === c.formationId);
        if (!f || f.dancers.length === 0) {
          window.alert("保存する立ち位置がありません。");
          return;
        }
        const already = listFormationBoxItemsByCount(f.dancers.length).length;
        const suggested = `${f.dancers.length}人の形 ${already + 1}`;
        const result = saveFormationToBox(suggested, f.dancers);
        if (!result.ok) {
          window.alert(result.message);
        }
      },
      [project.cues, project.formations]
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

      const trimLo = trimStartSec;
      const trimHi = trimEndSec ?? duration;

      const timeFromClientX = (clientX: number) => {
        const r = c.getBoundingClientRect();
        const x = clientX - r.left;
        const t = waveExtentXToTime(x, viewStart, viewSpan, r.width);
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

      /** 縦の再生位置線は細いので、キュー帯より先にヒットさせてドラッグシークしやすくする */
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

      const cueHit = pickCueDragKindAtWave(
        e.clientX,
        e.clientY,
        c,
        cuesSorted,
        viewStart,
        viewSpan,
        null
      );
      const cueId = cueHit?.cueId ?? null;

      if (cueId) {
        e.preventDefault();
        e.stopPropagation();
        waveHoverCueRef.current = null;
        const cue = cuesSorted.find((x) => x.id === cueId);
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
              const trimHi =
                p.trimEndSec ??
                (durationRef.current > 0
                  ? durationRef.current
                  : PLACEHOLDER_TIMELINE_CAP_SEC);
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
                let tSeek = waveExtentXToTime(xUp, viewStart, viewSpan, ww);
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
            if (cuesSorted.length >= 100 || formations.length === 0) {
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
            const seekCapEmpty =
              durationRef.current > 0
                ? durationRef.current
                : PLACEHOLDER_TIMELINE_CAP_SEC;
            if (a && Number.isFinite(appliedT)) {
              a.currentTime = Math.max(
                trimStartSec,
                Math.min(trimEndSec ?? seekCapEmpty, appliedT)
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
      const auHit = audioRef.current;
      let phSec = currentTimePropRef.current;
      if (
        isPlayingForWaveRef.current &&
        auHit &&
        !auHit.paused &&
        Number.isFinite(auHit.currentTime)
      ) {
        phSec = quantizePlayheadForWaveView(auHit.currentTime);
      }
      if (
        auHit?.src &&
        hitPlayheadStripForScrub(
          e.clientX,
          cnv,
          viewStart,
          viewSpan,
          phSec,
          duration,
          viewPortionRef.current
        )
      ) {
        waveHoverCueRef.current = null;
        cnv.style.cursor = "col-resize";
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
        return;
      }
      const hit = pickCueDragKindAtWave(
        e.clientX,
        e.clientY,
        cnv,
        cuesSorted,
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

    const waveCueMenuPanel =
      waveCueMenu && !waveCueConfirm ? (
        <>
          <button
            type="button"
            aria-label="メニューを閉じる"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2498,
              border: "none",
              background: "transparent",
              cursor: "default",
            }}
            onClick={() => setWaveCueMenu(null)}
          />
          <div
            role="menu"
            aria-label="キューの操作"
            style={{
              position: "fixed",
              left: Math.max(
                8,
                Math.min(
                  waveCueMenu.clientX,
                  (typeof window !== "undefined" ? window.innerWidth : 800) - 240
                )
              ),
              top: Math.max(
                8,
                Math.min(
                  waveCueMenu.clientY,
                  (typeof window !== "undefined" ? window.innerHeight : 600) - 150
                )
              ),
              zIndex: 2499,
              minWidth: "220px",
              maxWidth: "min(300px, calc(100vw - 16px))",
              padding: "8px",
              borderRadius: "10px",
              border: `1px solid ${shell.border}`,
              background: shell.surface,
              boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
            }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={project.viewMode === "view"}
              style={{
                ...btnSecondary,
                display: "block",
                width: "100%",
                textAlign: "left",
                marginBottom: "6px",
                fontSize: "12px",
                padding: "8px 10px",
                cursor: project.viewMode === "view" ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                if (project.viewMode === "view") return;
                setWaveCueMenu(null);
                setWaveCueConfirm({ kind: "duplicate", cueId: waveCueMenu.cueId });
              }}
            >
              複製する
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={project.viewMode === "view"}
              style={{
                ...btnSecondary,
                display: "block",
                width: "100%",
                textAlign: "left",
                marginBottom: "6px",
                fontSize: "12px",
                padding: "8px 10px",
                cursor: project.viewMode === "view" ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                if (project.viewMode === "view") return;
                setWaveCueMenu(null);
                setWaveCueConfirm({
                  kind: "formationBox",
                  cueId: waveCueMenu.cueId,
                });
              }}
            >
              立ち位置リストに追加
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={project.viewMode === "view"}
              style={{
                ...btnSecondary,
                display: "block",
                width: "100%",
                textAlign: "left",
                fontSize: "12px",
                padding: "8px 10px",
                borderColor: "rgba(248, 113, 113, 0.55)",
                color: "#fecaca",
                cursor: project.viewMode === "view" ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                if (project.viewMode === "view") return;
                removeCue(waveCueMenu.cueId);
                setWaveCueMenu(null);
              }}
            >
              削除
            </button>
          </div>
        </>
      ) : null;

    const waveCueConfirmPanel = waveCueConfirm ? (
      <>
        <button
          type="button"
          aria-label="確認を閉じる"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2500,
            border: "none",
            background: "rgba(2, 6, 23, 0.35)",
            cursor: "pointer",
          }}
          onClick={() => setWaveCueConfirm(null)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wave-cue-confirm-title"
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2501,
            width: "min(360px, calc(100vw - 32px))",
            padding: "18px 20px",
            borderRadius: "12px",
            border: `1px solid ${shell.border}`,
            background: shell.surface,
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
          onClick={(ev) => ev.stopPropagation()}
        >
          <h3
            id="wave-cue-confirm-title"
            style={{
              margin: "0 0 10px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            {waveCueConfirm.kind === "duplicate" ? "キューを複製" : "立ち位置リストへ"}
          </h3>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "13px",
              color: "#cbd5e1",
              lineHeight: 1.55,
            }}
          >
            {waveCueConfirm.kind === "duplicate"
              ? "同じ立ち位置の別区間として、波形上の直後あたりに複製します。"
              : "このキューの立ち位置を「形の箱」（立ち位置リスト）に追加します。名前は人数に応じて自動で付けます。"}
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              style={{
                ...btnSecondary,
                padding: "8px 16px",
                fontSize: "13px",
                minWidth: "88px",
              }}
              onClick={() => setWaveCueConfirm(null)}
            >
              いいえ
            </button>
            <button
              type="button"
              style={{
                ...btnSecondary,
                padding: "8px 16px",
                fontSize: "13px",
                minWidth: "88px",
                borderColor: "#6366f1",
                color: "#e0e7ff",
                fontWeight: 600,
              }}
              onClick={() => {
                const cue = cuesSorted.find((c) => c.id === waveCueConfirm.cueId);
                if (cue) {
                  if (waveCueConfirm.kind === "duplicate") {
                    duplicateCueAfterSource(cue);
                  } else {
                    saveCueFormationToBoxList(waveCueConfirm.cueId);
                  }
                }
                setWaveCueConfirm(null);
              }}
            >
              はい
            </button>
          </div>
        </div>
      </>
    ) : null;

    return (
      <>
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
              {/** 2 行目: 左ブランド／中央に再生・シーク（画像の有無で位置がズレないよう 1fr | auto | 1fr） */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
                  alignItems: "center",
                  columnGap: tlPx(6),
                  width: "100%",
                  minWidth: 0,
                  overflowX: "hidden",
                  overflowY: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                >
                  <ChoreoGridHeaderBrand />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: tlPx(5),
                    rowGap: tlPx(3),
                    flexShrink: 0,
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
                    title="再生を止め、先頭（トリム開始位置）に戻します"
                    aria-label="先頭へ"
                    onClick={stopPlayback}
                  >
                    先頭
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
                  <PlaybackClockReadout
                    audioRef={audioRef}
                    isPlaying={isPlaying}
                    idleTimeSec={currentTime}
                    durationSec={duration}
                    monoFontSizePx={13 * TIMELINE_UI_SCALE}
                  />
                </div>
                <div aria-hidden style={{ minWidth: 0 }} />
              </div>
            </>
          </div>
        ) : (
          <div
            className="wave-compact-time-above-wave"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
              alignItems: "center",
              columnGap: tlPx(6),
              width: "100%",
              minWidth: 0,
              padding: `${tlPx(0)} ${tlPx(6)} ${tlPx(2)}`,
              borderBottom: `1px solid ${shell.border}`,
              flexShrink: 0,
              background: shell.bgChrome,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <ChoreoGridHeaderBrand compact />
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "nowrap",
                alignItems: "center",
                justifyContent: "center",
                gap: tlPx(6),
                flexShrink: 0,
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
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  padding: `${tlPx(4)} ${tlPx(10)}`,
                  minHeight: tlPx(28),
                  fontWeight: 600,
                  flexShrink: 0,
                }}
                disabled={project.viewMode === "view" || duration <= 0}
                title="再生を止め、先頭（トリム開始位置）に戻します"
                aria-label="先頭へ"
                onClick={stopPlayback}
              >
                先頭
              </button>
              <PlaybackClockReadout
                audioRef={audioRef}
                isPlaying={isPlaying}
                idleTimeSec={currentTime}
                durationSec={duration}
                monoFontSizePx={12 * TIMELINE_UI_SCALE}
              />
              {onUndo ? (
                <button
                  type="button"
                  style={{
                    width: tlPx(40),
                    height: tlPx(40),
                    minWidth: tlPx(40),
                    padding: 0,
                    borderRadius: "50%",
                    border: "none",
                    background: "transparent",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    cursor: undoDisabled ? "not-allowed" : "pointer",
                    opacity: undoDisabled ? 0.42 : 1,
                  }}
                  disabled={undoDisabled}
                  title="編集を元に戻す（⌘Z / Ctrl+Z）"
                  aria-label="元に戻す"
                  onClick={() => onUndo()}
                >
                  <WaveHistoryRoundIcon kind="undo" />
                </button>
              ) : null}
              {onRedo ? (
                <button
                  type="button"
                  style={{
                    width: tlPx(40),
                    height: tlPx(40),
                    minWidth: tlPx(40),
                    padding: 0,
                    borderRadius: "50%",
                    border: "none",
                    background: "transparent",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    cursor: redoDisabled ? "not-allowed" : "pointer",
                    opacity: redoDisabled ? 0.42 : 1,
                  }}
                  disabled={redoDisabled}
                  title="やり直す（⌘⇧Z / Ctrl+Shift+Z）"
                  aria-label="やり直す"
                  onClick={() => onRedo()}
                >
                  <WaveHistoryRoundIcon kind="redo" />
                </button>
              ) : null}
            </div>
            <div aria-hidden style={{ minWidth: 0 }} />
          </div>
        )}
        <div
          ref={waveContainerRef}
          title="波形上でマウスホイール（またはトラックパッドの縦スクロール）で時間軸の拡大・縮小。下の枠線付近をドラッグすると波形の縦の高さを変えられます。赤い縦線付近をドラッグすると再生位置を移動できます。"
          style={{
            width: "100%",
            borderRadius: "6px",
            border: "1px solid #334155",
            overflowX: "hidden",
            /**
             * 上部ドック固定シェルでは `visible` だと再生ヘッドのはみ出しが祖先の
             * スクロール可能領域を膨らませ、縦スクロールバーで波形が切れたように見える。
             */
            overflowY: compactTopDock ? "hidden" : "visible",
            background: "#020617",
            position: "relative",
            /** 上部ドック内で兄弟 flex と競合して高さ 0 近くまで潰れ、波形が消えるのを防ぐ */
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", width: "100%" }}>
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
              ref={playheadLineOverlayRef}
              aria-hidden
              style={{
                position: "absolute",
                pointerEvents: "none",
                display: "none",
                left: "0%",
                transform: "translateX(-50%)",
                top:
                  (compactTopDock ? 13 : 16) - PLAYHEAD_LINE_BLEED_TOP_CSS,
                height:
                  PLAYHEAD_LINE_BLEED_TOP_CSS +
                  waveCanvasCssH +
                  PLAYHEAD_LINE_BLEED_BOTTOM_CSS,
                width: 3,
                background: "#ef4444",
                borderRadius: 1,
                boxShadow: "0 0 5px rgba(239, 68, 68, 0.55)",
                zIndex: 2,
              }}
            />
          </div>
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
            {cuesSorted.map((c, sortedIdx) => {
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
                          ? "3px solid #ef4444"
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
      {waveCueMenuPanel}
      {waveCueConfirmPanel}
      </>
    );
  }
);

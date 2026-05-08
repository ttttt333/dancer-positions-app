import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { formatMmSsClock } from "../lib/timeFormat";
import { preloadFFmpeg } from "../lib/extractVideoAudio";
import { playbackEngine } from "../core/playbackEngine";
import { btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";

/* ─── Neon glow helper ─── */
const neonGlow = (c: string) =>
  `drop-shadow(0 0 3px ${c}99) drop-shadow(0 0 7px ${c}55)`;

/* ─── Playback icon SVGs — neon colors matching NeonIconPanel ─── */
function IconPlay() {
  const c = "#c084fc"; // purple neon
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <polygon points="5,3 20,12 5,21" fill={c} />
    </svg>
  );
}
function IconPause() {
  const c = "#c084fc";
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <rect x="4" y="3" width="5" height="18" rx="1.5" fill={c} />
      <rect x="15" y="3" width="5" height="18" rx="1.5" fill={c} />
    </svg>
  );
}
function IconStop() {
  const c = "#818cf8"; // indigo neon
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill={c} />
    </svg>
  );
}
function IconSeekBack() {
  const c = "#60a5fa"; // blue neon
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <polygon points="14,4 3,12 14,20" fill={c} />
      <rect x="15" y="4" width="6" height="16" rx="1.5" fill={c} />
    </svg>
  );
}
function IconSeekFwd() {
  const c = "#60a5fa";
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <polygon points="10,4 21,12 10,20" fill={c} />
      <rect x="3" y="4" width="6" height="16" rx="1.5" fill={c} />
    </svg>
  );
}
function IconSave() {
  const c = "#818cf8"; // indigo neon — matches NeonIconPanel save
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
        fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <polyline points="17,21 17,13 7,13 7,21" fill="none" stroke={c} strokeWidth="1.8" />
      <polyline points="7,3 7,8 15,8" fill="none" stroke={c} strokeWidth="1.8" />
    </svg>
  );
}
function IconAudioImport() {
  // 音符 + プラス、ピンクネオン
  const c = "#f472b6";
  return (
    <svg width="17" height="17" viewBox="0 0 28 28" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      {/* 音符の縦棒 */}
      <line x1="9" y1="5" x2="9" y2="17" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      {/* 音符の旗 */}
      <path d="M9 5 L18 3 L18 11 L9 13" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      {/* 音符の丸 */}
      <ellipse cx="7" cy="18" rx="3" ry="2" fill={c} opacity="0.9" />
      {/* プラス記号 */}
      <line x1="20" y1="17" x2="20" y2="25" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="21" x2="24" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** タイムライン上部ツールバー用（再生・波形周りの縦スペース節約） */
export const TIMELINE_UI_SCALE = 1.2;
export function tlPx(n: number): string {
  return `${Math.round(n * TIMELINE_UI_SCALE * 10) / 10}px`;
}

/**
 * 再生ツールバー左右レール（左＝ロゴ領域、右＝同幅のダミーでバランス）。
 * 中央を `minmax(0,1fr)` にし、再生・時計を画面中央付近に固定する。
 */
export const TIMELINE_BRAND_RAIL_CSS = "clamp(200px, 28vw, 340px)";

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
const WAVE_HISTORY_ICON_PX = 27;
const WAVE_HISTORY_ARROW_STROKE = 2.75;

function WaveHistoryRoundIcon({
  kind,
  sizePx = WAVE_HISTORY_ICON_PX,
}: {
  kind: "undo" | "redo";
  sizePx?: number;
}) {
  const mirror = kind === "redo";
  return (
    <svg
      width={sizePx}
      height={sizePx}
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

function ChoreoCoreHeaderBrand({ compact }: { compact?: boolean }) {
  return (
    <Link
      to="/library"
      title="作品一覧へ"
      aria-label="CHOREOGRID（作品一覧へ）"
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        minHeight: compact ? tlPx(30) : tlPx(34),
        flexShrink: 0,
        textDecoration: "none",
        borderRadius: tlPx(6),
        overflow: "hidden",
        padding: compact ? `${tlPx(1)} ${tlPx(2)}` : `${tlPx(2)} ${tlPx(3)}`,
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}choreogrid-header-banner.png`}
        alt="CHOREOGRID"
        width={640}
        height={160}
        style={{
          width: "100%",
          height: "100%",
          maxHeight: compact ? tlPx(32) : tlPx(40),
          objectFit: "contain",
          objectPosition: "center center",
          display: "block",
          filter:
            "drop-shadow(0 0 12px rgba(168, 85, 247, 0.35)) drop-shadow(0 0 18px rgba(34, 211, 238, 0.2))",
        }}
        draggable={false}
      />
    </Link>
  );
}

const PlaybackClockReadout = memo(function PlaybackClockReadout({
  isPlaying,
  idleTimeSec,
  durationSec,
  monoFontSizePx = 13,
}: {
  isPlaying: boolean;
  idleTimeSec: number;
  durationSec: number;
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

  useLayoutEffect(() => {
    if (!isPlaying) return;
    const el = liveRef.current;
    if (!el) return;
    const t =
      !playbackEngine.isPaused() && Number.isFinite(playbackEngine.getCurrentTime())
        ? playbackEngine.getCurrentTime()
        : idleTimeSecRef.current;
    el.textContent = formatMmSsClock(t);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    let id = 0;
    const loop = () => {
      const t =
        !playbackEngine.isPaused() && Number.isFinite(playbackEngine.getCurrentTime())
          ? playbackEngine.getCurrentTime()
          : idleTimeSecRef.current;
      const el = liveRef.current;
      if (el) el.textContent = formatMmSsClock(t);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [isPlaying]);

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
      <span ref={liveRef} />
      <span>
        {" / "}
        {durPart}
      </span>
    </span>
  );
});

export type TimelineToolbarProps = {
  compactTopDock: boolean;
  brandRailCss: string;
  wideWorkbench: boolean;
  waveTimelineDockTop: boolean;
  onWaveTimelineDockTopChange?: (top: boolean) => void;
  viewMode: ChoreographyProjectJson["viewMode"];
  duration: number;
  isPlaying: boolean;
  currentTime: number;
  togglePlay: () => void;
  stopPlayback: () => void;
  seekForward5Sec: () => void;
  seekBackward5Sec: () => void;
  onSave?: () => void;
  onOpenAudioImport?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  undoDisabled: boolean;
  redoDisabled: boolean;
  /** スマホ縦積み: 再生行を詰め、ラベルを短くする */
  editorMobileStack?: boolean;
  /** スマホ: 「波形・再生」＋たたむなど、再生行先頭に同一行で並べる */
  compactDockLeading?: ReactNode;
};

export function TimelineToolbar({
  compactTopDock,
  brandRailCss,
  wideWorkbench,
  waveTimelineDockTop,
  onWaveTimelineDockTopChange,
  viewMode,
  duration,
  isPlaying,
  currentTime,
  togglePlay,
  stopPlayback,
  seekForward5Sec,
  seekBackward5Sec,
  onSave,
  onOpenAudioImport,
  onUndo,
  onRedo,
  undoDisabled,
  redoDisabled,
  editorMobileStack = false,
  compactDockLeading,
}: TimelineToolbarProps) {
  if (!compactTopDock) {
    return (
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
                  background: "linear-gradient(90deg, transparent, #020617 28%, #020617)",
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
                  disabled={viewMode === "view"}
                  title="画面上部の波形エリアを閉じ、タイムラインを右列の通常位置に戻します"
                  aria-label="上部の波形エリアを閉じる"
                  onClick={() => onWaveTimelineDockTopChange(false)}
                />
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${brandRailCss} minmax(0, 1fr) ${brandRailCss}`,
              alignItems: "stretch",
              columnGap: tlPx(6),
              width: "100%",
              minWidth: 0,
              overflowX: "hidden",
              overflowY: "hidden",
            }}
          >
            <div
              style={{
                minWidth: 0,
                maxWidth: "100%",
                overflow: "hidden",
                display: "flex",
                alignItems: "stretch",
              }}
            >
              <ChoreoCoreHeaderBrand />
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
                minWidth: 0,
              }}
            >
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  padding: `${tlPx(4)} ${tlPx(8)}`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                disabled={viewMode === "view" || duration <= 0}
                title="5 秒戻す"
                aria-label="5秒戻す"
                onClick={seekBackward5Sec}
              >
                <IconSeekBack />
              </button>
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  padding: `${tlPx(4)} ${tlPx(8)}`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                disabled={viewMode === "view" || duration <= 0}
                title="5 秒進む"
                aria-label="5秒進む"
                onClick={seekForward5Sec}
              >
                <IconSeekFwd />
              </button>
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  padding: `${tlPx(4)} ${tlPx(10)}`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={togglePlay}
                aria-label={isPlaying ? "一時停止" : "再生"}
                title={isPlaying ? "一時停止" : "再生"}
              >
                {isPlaying ? <IconPause /> : <IconPlay />}
              </button>
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  padding: `${tlPx(4)} ${tlPx(8)}`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                disabled={viewMode === "view" || duration <= 0}
                title="再生を止め、先頭（トリム開始位置）に戻します"
                aria-label="先頭へ"
                onClick={stopPlayback}
              >
                <IconStop />
              </button>
              {onSave && (
                <button
                  type="button"
                  style={{
                    ...timelineToolbarBtn,
                    padding: `${tlPx(4)} ${tlPx(8)}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  disabled={viewMode === "view"}
                  title="立ち位置をライブラリに保存"
                  aria-label="保存"
                  onClick={onSave}
                >
                  <IconSave />
                </button>
              )}
              {onOpenAudioImport && (
                <button
                  type="button"
                  style={{
                    ...timelineToolbarBtn,
                    padding: `${tlPx(4)} ${tlPx(8)}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="音源を取り込む"
                  aria-label="音源取込"
                  onClick={onOpenAudioImport}
                  onPointerEnter={() => { void preloadFFmpeg(); }}
                >
                  <IconAudioImport />
                </button>
              )}
              <PlaybackClockReadout
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
    );
  }

  if (editorMobileStack) {
    const mobileScrollBtn: CSSProperties = {
      ...timelineToolbarBtn,
      padding: `${tlPx(2)} ${tlPx(4)}`,
      minHeight: tlPx(24),
      minWidth: tlPx(26),
      fontSize: tlPx(9),
      fontWeight: 600,
      flexShrink: 0,
    };
    return (
      <div
        className="wave-compact-time-above-wave editor-timeline-mobile-dock"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: tlPx(4),
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: 0,
          padding: `${tlPx(1)} ${tlPx(6)} ${tlPx(2)}`,
          borderBottom: `1px solid ${shell.border}`,
          flexShrink: 0,
          background: shell.bgChrome,
        }}
      >
        {compactDockLeading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            {compactDockLeading}
          </div>
        ) : null}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: tlPx(3),
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            flexWrap: "nowrap",
            touchAction: "manipulation",
          }}
        >
          <button
            type="button"
            style={{ ...mobileScrollBtn, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            disabled={viewMode === "view" || duration <= 0}
            title="5 秒戻す"
            aria-label="5秒戻す"
            onClick={seekBackward5Sec}
          >
            <IconSeekBack />
          </button>
          <button
            type="button"
            style={{ ...mobileScrollBtn, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            disabled={viewMode === "view" || duration <= 0}
            title="5 秒進む"
            aria-label="5秒進む"
            onClick={seekForward5Sec}
          >
            <IconSeekFwd />
          </button>
          <button
            type="button"
            style={{
              ...timelineToolbarBtn,
              padding: `${tlPx(2)} ${tlPx(8)}`,
              minHeight: tlPx(26),
              minWidth: tlPx(36),
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            disabled={viewMode === "view"}
            onClick={togglePlay}
            aria-label={isPlaying ? "一時停止" : "再生"}
            title={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            style={{ ...mobileScrollBtn, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            disabled={viewMode === "view" || duration <= 0}
            title="再生を止め、先頭（トリム開始位置）に戻します"
            aria-label="先頭へ"
            onClick={stopPlayback}
          >
            <IconStop />
          </button>
          {onSave ? (
            <button
              type="button"
              style={{ ...mobileScrollBtn, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              disabled={viewMode === "view"}
              title="立ち位置をライブラリに保存"
              aria-label="保存"
              onClick={onSave}
            >
              <IconSave />
            </button>
          ) : null}
          {onOpenAudioImport ? (
            <button
              type="button"
              style={{ ...mobileScrollBtn, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              title="音源を取り込む"
              aria-label="音源取込"
              onClick={onOpenAudioImport}
              onPointerEnter={() => { void preloadFFmpeg(); }}
            >
              <IconAudioImport />
            </button>
          ) : null}
          {onUndo ? (
            <button
              type="button"
              style={{
                width: tlPx(30),
                height: tlPx(30),
                minWidth: tlPx(30),
                padding: 0,
                borderRadius: tlPx(6),
                border: `1px solid ${shell.border}`,
                background: "rgba(15,23,42,0.9)",
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
              <WaveHistoryRoundIcon kind="undo" sizePx={18 * TIMELINE_UI_SCALE} />
            </button>
          ) : null}
          {onRedo ? (
            <button
              type="button"
              style={{
                width: tlPx(30),
                height: tlPx(30),
                minWidth: tlPx(30),
                padding: 0,
                borderRadius: tlPx(6),
                border: `1px solid ${shell.border}`,
                background: "rgba(15,23,42,0.9)",
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
              <WaveHistoryRoundIcon kind="redo" sizePx={18 * TIMELINE_UI_SCALE} />
            </button>
          ) : null}
        </div>
        <div style={{ flexShrink: 0, marginLeft: tlPx(2) }}>
          <PlaybackClockReadout
            isPlaying={isPlaying}
            idleTimeSec={currentTime}
            durationSec={duration}
            monoFontSizePx={10.5 * TIMELINE_UI_SCALE}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="wave-compact-time-above-wave"
      style={{
        display: "grid",
        gridTemplateColumns: `${brandRailCss} minmax(0, 1fr) ${brandRailCss}`,
        alignItems: "stretch",
        columnGap: tlPx(6),
        width: "100%",
        minWidth: 0,
        marginTop: 0,
        padding: `${tlPx(0)} ${tlPx(6)} ${tlPx(2)}`,
        borderBottom: `1px solid ${shell.border}`,
        flexShrink: 0,
        background: shell.bgChrome,
      }}
    >
      <div
        style={{
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <ChoreoCoreHeaderBrand compact />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
          justifyContent: "center",
          gap: tlPx(6),
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        <button
          type="button"
          style={{
            ...timelineToolbarBtn,
            padding: `${tlPx(4)} ${tlPx(9)}`,
            minHeight: tlPx(28),
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          disabled={viewMode === "view" || duration <= 0}
          title="5 秒戻す"
          aria-label="5秒戻す"
          onClick={seekBackward5Sec}
        >
          <IconSeekBack />
        </button>
        <button
          type="button"
          style={{
            ...timelineToolbarBtn,
            padding: `${tlPx(4)} ${tlPx(9)}`,
            minHeight: tlPx(28),
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          disabled={viewMode === "view" || duration <= 0}
          title="5 秒進む"
          aria-label="5秒進む"
          onClick={seekForward5Sec}
        >
          <IconSeekFwd />
        </button>
        <button
          type="button"
          style={{
            ...timelineToolbarBtn,
            padding: `${tlPx(4)} ${tlPx(12)}`,
            minHeight: tlPx(28),
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={togglePlay}
          aria-label={isPlaying ? "一時停止" : "再生"}
          title={isPlaying ? "一時停止" : "再生"}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          style={{
            ...timelineToolbarBtn,
            padding: `${tlPx(4)} ${tlPx(9)}`,
            minHeight: tlPx(28),
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          disabled={viewMode === "view" || duration <= 0}
          title="再生を止め、先頭（トリム開始位置）に戻します"
          aria-label="先頭へ"
          onClick={stopPlayback}
        >
          <IconStop />
        </button>
        {onSave ? (
          <button
            type="button"
            style={{
              ...timelineToolbarBtn,
              padding: `${tlPx(4)} ${tlPx(9)}`,
              minHeight: tlPx(28),
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            disabled={viewMode === "view"}
            title="立ち位置をライブラリに保存"
            aria-label="保存"
            onClick={onSave}
          >
            <IconSave />
          </button>
        ) : null}
        {onOpenAudioImport ? (
          <button
            type="button"
            style={{
              ...timelineToolbarBtn,
              padding: `${tlPx(4)} ${tlPx(9)}`,
              minHeight: tlPx(28),
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="音源を取り込む"
            aria-label="音源取込"
            onClick={onOpenAudioImport}
            onPointerEnter={() => { void preloadFFmpeg(); }}
          >
            <IconAudioImport />
          </button>
        ) : null}
        <PlaybackClockReadout
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
  );
}

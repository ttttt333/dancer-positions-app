import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { formatMmSsClock } from "../lib/timeFormat";
import { preloadFFmpeg } from "../lib/extractVideoAudio";
import { playbackEngine } from "../core/playbackEngine";
import { btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";

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
  onUndo?: () => void;
  onRedo?: () => void;
  undoDisabled: boolean;
  redoDisabled: boolean;
  /** スマホ縦積み: 再生行を詰め、ラベルを短くする */
  editorMobileStack?: boolean;
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
  onUndo,
  onRedo,
  undoDisabled,
  redoDisabled,
  editorMobileStack = false,
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
                  fontSize: tlPx(10),
                  padding: `${tlPx(3)} ${tlPx(7)}`,
                  letterSpacing: "0.01em",
                }}
                disabled={viewMode === "view" || duration <= 0}
                title="5 秒戻す"
                aria-label="5秒戻す"
                onClick={seekBackward5Sec}
              >
                «5s
              </button>
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  fontSize: tlPx(10),
                  padding: `${tlPx(3)} ${tlPx(7)}`,
                  letterSpacing: "0.01em",
                }}
                disabled={viewMode === "view" || duration <= 0}
                title="5 秒進む"
                aria-label="5秒進む"
                onClick={seekForward5Sec}
              >
                5s»
              </button>
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
                disabled={viewMode === "view" || duration <= 0}
                title="再生を止め、先頭（トリム開始位置）に戻します"
                aria-label="先頭へ"
                onClick={stopPlayback}
              >
                先頭
              </button>
              {onSave && (
                <button
                  type="button"
                  style={timelineToolbarBtn}
                  disabled={viewMode === "view"}
                  title="立ち位置をライブラリに保存"
                  aria-label="保存"
                  onClick={onSave}
                >
                  保存
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

  return (
    <div
      className="wave-compact-time-above-wave"
      style={{
        display: "grid",
        gridTemplateColumns: `${brandRailCss} minmax(0, 1fr) ${brandRailCss}`,
        alignItems: "stretch",
        columnGap: tlPx(editorMobileStack ? 4 : 6),
        width: "100%",
        minWidth: 0,
        marginTop: 0,
        padding: `${tlPx(0)} ${tlPx(editorMobileStack ? 4 : 6)} ${tlPx(
          editorMobileStack ? 1 : 2
        )}`,
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
        {editorMobileStack ? (
          <div aria-hidden style={{ minWidth: 0, width: "100%" }} />
        ) : (
          <ChoreoCoreHeaderBrand compact />
        )}
      </div>
      {editorMobileStack ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: tlPx(3),
            flexShrink: 0,
            minWidth: 0,
            width: "100%",
          }}
        >
          <PlaybackClockReadout
            isPlaying={isPlaying}
            idleTimeSec={currentTime}
            durationSec={duration}
            monoFontSizePx={11.5 * TIMELINE_UI_SCALE}
          />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: tlPx(4),
              rowGap: tlPx(3),
              width: "100%",
              minWidth: 0,
            }}
          >
            <button
              type="button"
              style={{
                ...timelineToolbarBtn,
                padding: `${tlPx(2)} ${tlPx(5)}`,
                minHeight: tlPx(22),
                fontSize: tlPx(10),
                letterSpacing: "0.02em",
                flexShrink: 0,
              }}
              disabled={viewMode === "view" || duration <= 0}
              title="5 秒戻す"
              aria-label="5秒戻す"
              onClick={seekBackward5Sec}
            >
              −5s
            </button>
            <button
              type="button"
              style={{
                ...timelineToolbarBtn,
                padding: `${tlPx(2)} ${tlPx(5)}`,
                minHeight: tlPx(22),
                fontSize: tlPx(10),
                letterSpacing: "0.02em",
                flexShrink: 0,
              }}
              disabled={viewMode === "view" || duration <= 0}
              title="5 秒進む"
              aria-label="5秒進む"
              onClick={seekForward5Sec}
            >
              ＋5s
            </button>
            <button
              type="button"
              style={{
                ...timelineToolbarBtn,
                padding: `${tlPx(3)} ${tlPx(10)}`,
                minHeight: tlPx(26),
                minWidth: tlPx(44),
                fontWeight: 700,
                flexShrink: 0,
              }}
              disabled={viewMode === "view"}
              onClick={togglePlay}
              aria-label={isPlaying ? "一時停止" : "再生"}
              title={isPlaying ? "一時停止" : "再生"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              style={{
                ...timelineToolbarBtn,
                padding: `${tlPx(2)} ${tlPx(6)}`,
                minHeight: tlPx(22),
                fontSize: tlPx(9),
                fontWeight: 600,
                flexShrink: 0,
              }}
              disabled={viewMode === "view" || duration <= 0}
              title="再生を止め、先頭（トリム開始位置）に戻します"
              aria-label="先頭へ"
              onClick={stopPlayback}
            >
              ⏹
            </button>
            {onSave ? (
              <button
                type="button"
                style={{
                  ...timelineToolbarBtn,
                  padding: `${tlPx(2)} ${tlPx(6)}`,
                  minHeight: tlPx(22),
                  fontSize: tlPx(9),
                  fontWeight: 600,
                  flexShrink: 0,
                }}
                disabled={viewMode === "view"}
                title="立ち位置をライブラリに保存"
                aria-label="保存"
                onClick={onSave}
              >
                保存
              </button>
            ) : null}
            {onUndo ? (
              <button
                type="button"
                style={{
                  width: tlPx(32),
                  height: tlPx(32),
                  minWidth: tlPx(32),
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
                <WaveHistoryRoundIcon kind="undo" sizePx={22 * TIMELINE_UI_SCALE} />
              </button>
            ) : null}
            {onRedo ? (
              <button
                type="button"
                style={{
                  width: tlPx(32),
                  height: tlPx(32),
                  minWidth: tlPx(32),
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
                <WaveHistoryRoundIcon kind="redo" sizePx={22 * TIMELINE_UI_SCALE} />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
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
              padding: `${tlPx(3)} ${tlPx(7)}`,
              minHeight: tlPx(24),
              fontSize: tlPx(10),
              letterSpacing: "0.01em",
              flexShrink: 0,
            }}
            disabled={viewMode === "view" || duration <= 0}
            title="5 秒戻す"
            aria-label="5秒戻す"
            onClick={seekBackward5Sec}
          >
            «5s
          </button>
          <button
            type="button"
            style={{
              ...timelineToolbarBtn,
              padding: `${tlPx(3)} ${tlPx(7)}`,
              minHeight: tlPx(24),
              fontSize: tlPx(10),
              letterSpacing: "0.01em",
              flexShrink: 0,
            }}
            disabled={viewMode === "view" || duration <= 0}
            title="5 秒進む"
            aria-label="5秒進む"
            onClick={seekForward5Sec}
          >
            5s»
          </button>
          <button
            type="button"
            style={{
              ...timelineToolbarBtn,
              padding: `${tlPx(4)} ${tlPx(12)}`,
              minHeight: tlPx(28),
              fontWeight: 600,
              flexShrink: 0,
            }}
            disabled={viewMode === "view"}
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
            disabled={viewMode === "view" || duration <= 0}
            title="再生を止め、先頭（トリム開始位置）に戻します"
            aria-label="先頭へ"
            onClick={stopPlayback}
          >
            先頭
          </button>
          {onSave && (
            <button
              type="button"
              style={{
                ...timelineToolbarBtn,
                padding: `${tlPx(4)} ${tlPx(10)}`,
                minHeight: tlPx(28),
                fontWeight: 600,
                flexShrink: 0,
              }}
              disabled={viewMode === "view"}
              title="立ち位置をライブラリに保存"
              aria-label="保存"
              onClick={onSave}
            >
              保存
            </button>
          )}
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
      )}
      <div aria-hidden style={{ minWidth: 0 }} />
    </div>
  );
}

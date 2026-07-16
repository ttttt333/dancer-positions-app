import { Link, useNavigate } from "react-router-dom";
import { flushEditorAutoSaveBeforeLeave } from "../lib/editorAutoSaveBridge";
import type { CSSProperties, ReactNode, PointerEvent } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { formatMmSsClock } from "../lib/timeFormat";
import { preloadFFmpeg } from "../lib/extractVideoAudio";
import { playbackEngine } from "../core/playbackEngine";
import { btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import { useI18n } from "../i18n/I18nContext";

/* ─── Neon glow helper ─── */
const neonGlow = (c: string) =>
  `drop-shadow(0 0 3px ${c}99) drop-shadow(0 0 7px ${c}55)`;

/* ─── Playback icon SVGs — neon colors matching NeonIconPanel ─── */
function IconPlay() {
  const c = "#c084fc"; // purple neon
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <polygon points="5,3 20,12 5,21" fill={c} />
    </svg>
  );
}
function IconPause() {
  const c = "#c084fc";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <rect x="4" y="3" width="5" height="18" rx="1.5" fill={c} />
      <rect x="15" y="3" width="5" height="18" rx="1.5" fill={c} />
    </svg>
  );
}
function IconStop() {
  const c = "#818cf8"; // indigo neon
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill={c} />
    </svg>
  );
}
function IconZoomIn() {
  const c = "#34d399";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <circle cx="10" cy="10" r="6.5" fill="none" stroke={c} strokeWidth="2" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="10" x2="12" y2="10" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="8" x2="10" y2="12" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconZoomOut() {
  const c = "#34d399";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <circle cx="10" cy="10" r="6.5" fill="none" stroke={c} strokeWidth="2" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="10" x2="12" y2="10" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconSeekBack() {
  const c = "#60a5fa"; // blue neon
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <polygon points="14,4 3,12 14,20" fill={c} />
      <rect x="15" y="4" width="6" height="16" rx="1.5" fill={c} />
    </svg>
  );
}
function IconSeekFwd() {
  const c = "#60a5fa";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <polygon points="10,4 21,12 10,20" fill={c} />
      <rect x="3" y="4" width="6" height="16" rx="1.5" fill={c} />
    </svg>
  );
}

function FormationChangeButton({
  disabled,
  onClick,
  style,
}: {
  disabled: boolean;
  onClick: () => void;
  style: CSSProperties;
}) {
  return (
    <button
      type="button"
      style={{
        ...style,
        borderColor: "#d4af37",
        color: "#fef3c7",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
      disabled={disabled}
      title="立ち位置の雛形を選ぶ"
      aria-label="立ち位置の雛形を選ぶ"
      onClick={onClick}
    >
      Change
    </button>
  );
}

function UpdateLogToolbarButton({ style }: { style: CSSProperties }) {
  return (
    <Link
      to="/update-log"
      target="_blank"
      rel="noopener noreferrer"
      title="お知らせ・アップデートログ"
      aria-label="UPDATE LOG（お知らせ）を開く"
      style={{
        ...style,
        borderColor: "rgba(96, 165, 250, 0.55)",
        color: "#dbeafe",
        background: "rgba(30, 58, 138, 0.35)",
        fontWeight: 750,
        letterSpacing: "0.06em",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      UPDATE LOG
    </Link>
  );
}
function IconSave() {
  const c = "#818cf8"; // indigo neon — matches NeonIconPanel save
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ display: "block", filter: neonGlow(c) }}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
        fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <polyline points="17,21 17,13 7,13 7,21" fill="none" stroke={c} strokeWidth="1.8" />
      <polyline points="7,3 7,8 15,8" fill="none" stroke={c} strokeWidth="1.8" />
    </svg>
  );
}
function IconAudioImport() {
  const pink = "#f472b6";
  const yellow = "#facc15";
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden style={{ display: "block" }}>
      <defs>
        <filter id="glow-pink" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-yellow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── 音符（ピンク） ── */}
      <g filter="url(#glow-pink)">
        {/* 縦棒 */}
        <line x1="8" y1="3.5" x2="8" y2="17" stroke={pink} strokeWidth="2.8" strokeLinecap="round" />
        {/* 旗（塗り＋縁） */}
        <path d="M8 3.5 L19 1.5 L19 11.5 L8 13.5 Z" fill={pink} fillOpacity="0.3" stroke={pink} strokeWidth="1.8" strokeLinejoin="round" />
        {/* 玉（大きめ楕円） */}
        <ellipse cx="6" cy="18.5" rx="4.5" ry="3" fill={pink} />
      </g>

      {/* ── プラスボタン（黄色・右下・円バッジ風） ── */}
      <g filter="url(#glow-yellow)">
        {/* 背景の円 */}
        <circle cx="21" cy="21" r="6.5" fill="#1e293b" stroke={yellow} strokeWidth="1.8" />
        {/* プラスの縦棒 */}
        <line x1="21" y1="17.2" x2="21" y2="24.8" stroke={yellow} strokeWidth="2.6" strokeLinecap="round" />
        {/* プラスの横棒 */}
        <line x1="17.2" y1="21" x2="24.8" y2="21" stroke={yellow} strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** タイムライン上部ツールバー用（再生・波形周りの縦スペース節約） */
export const TIMELINE_UI_SCALE = 1.2;
export function tlPx(n: number): string {
  return `${Math.round(n * TIMELINE_UI_SCALE * 10) / 10}px`;
}

function useHoldRepeatAction(action: () => void, disabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (disabled || e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      action();
      stop();
      timerRef.current = setInterval(action, 75);
    },
    [action, disabled, stop]
  );

  return {
    onPointerDown,
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
  };
}

function WaveZoomToolbarButtons({
  disabled,
  onZoomIn,
  onZoomOut,
  buttonStyle,
  zoomInTitle,
  zoomOutTitle,
  zoomInLabel,
  zoomOutLabel,
}: {
  disabled: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  buttonStyle: CSSProperties;
  zoomInTitle: string;
  zoomOutTitle: string;
  zoomInLabel: string;
  zoomOutLabel: string;
}) {
  const zoomInHold = useHoldRepeatAction(onZoomIn ?? (() => {}), disabled || !onZoomIn);
  const zoomOutHold = useHoldRepeatAction(onZoomOut ?? (() => {}), disabled || !onZoomOut);

  if (!onZoomIn || !onZoomOut) return null;

  return (
    <>
      <button
        type="button"
        style={{
          ...buttonStyle,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.42 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        disabled={disabled}
        title={zoomInTitle}
        aria-label={zoomInLabel}
        {...zoomInHold}
      >
        <IconZoomIn />
      </button>
      <button
        type="button"
        style={{
          ...buttonStyle,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.42 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        disabled={disabled}
        title={zoomOutTitle}
        aria-label={zoomOutLabel}
        {...zoomOutHold}
      >
        <IconZoomOut />
      </button>
    </>
  );
}

/**
 * 再生ツールバー左右レール（左＝ロゴ領域、右＝同幅のダミーでバランス）。
 * 中央を `minmax(0,1fr)` にし、再生・時計を画面中央付近に固定する。
 */
export const TIMELINE_BRAND_RAIL_CSS = "clamp(200px, 28vw, 340px)";

/** PC ワイド上部ドック: 左右レール幅（HOME + ロゴ用に少し広め） */
export const TIMELINE_BRAND_RAIL_WIDE_CSS = "clamp(210px, 24vw, 300px)";

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
  const { t } = useI18n();
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

function TimelineHomeButton({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Link
      to="/"
      title={t("editor.homeTitle")}
      aria-label={t("editor.homeTitle")}
      onClick={(e) => {
        e.preventDefault();
        void flushEditorAutoSaveBeforeLeave().finally(() => navigate("/"));
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tlPx(4),
        flexShrink: 0,
        textDecoration: "none",
        borderRadius: 999,
        color: shell.text,
        background: "rgba(148, 163, 184, 0.14)",
        border: `1px solid ${shell.border}`,
        padding: compact
          ? `${tlPx(4)} ${tlPx(8)} ${tlPx(4)} ${tlPx(6)}`
          : `${tlPx(5)} ${tlPx(10)} ${tlPx(5)} ${tlPx(8)}`,
        fontSize: compact ? tlPx(11) : tlPx(12),
        fontWeight: 700,
        letterSpacing: "0.02em",
        lineHeight: 1,
        touchAction: "manipulation",
        whiteSpace: "nowrap",
      }}
    >
      <svg
        width={compact ? 14 : 15}
        height={compact ? 14 : 15}
        viewBox="0 0 24 24"
        aria-hidden
        style={{ display: "block", flexShrink: 0 }}
      >
        <path
          d="M4.5 11.2 12 4.8l7.5 6.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 10.8V19h10v-8.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{t("editor.homeLabel")}</span>
    </Link>
  );
}

function ChoreoCoreHeaderBrand({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Link
      to="/"
      title={t("editor.comp.k051")}
      aria-label={t("editor.comp.k007")}
      onClick={(e) => {
        e.preventDefault();
        void flushEditorAutoSaveBeforeLeave().finally(() => navigate("/"));
      }}
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        minHeight: compact ? tlPx(30) : tlPx(34),
        flexShrink: 1,
        minWidth: 0,
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

function BrandRailWithHome({
  compact,
  showHome,
}: {
  compact?: boolean;
  showHome?: boolean;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: showHome ? tlPx(6) : 0,
      }}
    >
      {showHome ? <TimelineHomeButton compact={compact} /> : null}
      <div
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          alignSelf: "stretch",
          display: "flex",
        }}
      >
        <ChoreoCoreHeaderBrand compact={compact} />
      </div>
    </div>
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
  const { t } = useI18n();
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
  onWaveZoomIn?: () => void;
  onWaveZoomOut?: () => void;
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
  /** PC: 立ち位置雛形（Change）。5秒戻すの左に出す */
  showFormationChange?: boolean;
  onOpenFormationChange?: () => void;
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
  onWaveZoomIn,
  onWaveZoomOut,
  onSave,
  onOpenAudioImport,
  onUndo,
  onRedo,
  undoDisabled,
  redoDisabled,
  editorMobileStack = false,
  compactDockLeading,
  showFormationChange = false,
  onOpenFormationChange,
}: TimelineToolbarProps) {
  const { t } = useI18n();
  const waveZoomDisabled = duration <= 0;
  const waveZoomLabels = {
    zoomInTitle: t("editor.layout.waveZoomIn"),
    zoomOutTitle: t("editor.layout.waveZoomOut"),
    zoomInLabel: t("editor.layout.waveZoomIn"),
    zoomOutLabel: t("editor.layout.waveZoomOut"),
  };
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
              aria-label={t("editor.comp.k122")}
              title={t("editor.comp.k089")}
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
                  title={t("editor.comp.k097")}
                  aria-label={t("editor.comp.k083")}
                  onClick={() => onUndo()}
                />
                <button
                  type="button"
                  style={timelineToolbarBtn}
                  disabled={redoDisabled}
                  title={t("editor.comp.k015")}
                  aria-label={t("editor.comp.k108")}
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
                  title={t("editor.comp.k094")}
                  aria-label={t("editor.comp.k042")}
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
            <BrandRailWithHome showHome={wideWorkbench && !editorMobileStack} />
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
              {wideWorkbench && !editorMobileStack ? (
                <UpdateLogToolbarButton
                  style={{
                    ...timelineToolbarBtn,
                    padding: `${tlPx(4)} ${tlPx(8)}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: tlPx(10),
                  }}
                />
              ) : null}
              {showFormationChange && onOpenFormationChange ? (
                <FormationChangeButton
                  disabled={viewMode === "view"}
                  onClick={onOpenFormationChange}
                  style={{
                    ...timelineToolbarBtn,
                    padding: `${tlPx(4)} ${tlPx(8)}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              ) : null}
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
                title={t("editor.comp.k002")}
                aria-label={t("editor.comp.k004")}
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
                title={t("editor.comp.k003")}
                aria-label={t("editor.comp.k005")}
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
                title={t("editor.comp.k060")}
                aria-label={t("editor.comp.k057")}
                onClick={stopPlayback}
              >
                <IconStop />
              </button>
              <WaveZoomToolbarButtons
                disabled={waveZoomDisabled}
                onZoomIn={onWaveZoomIn}
                onZoomOut={onWaveZoomOut}
                buttonStyle={{
                  ...timelineToolbarBtn,
                  padding: `${tlPx(4)} ${tlPx(8)}`,
                }}
                {...waveZoomLabels}
              />
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
                  title={t("editor.comp.k095")}
                  aria-label={t("editor.comp.k052")}
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
                  title={t("editor.comp.k120")}
                  aria-label={t("editor.comp.k121")}
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
            title={t("editor.comp.k002")}
            aria-label={t("editor.comp.k004")}
            onClick={seekBackward5Sec}
          >
            <IconSeekBack />
          </button>
          <button
            type="button"
            style={{ ...mobileScrollBtn, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            disabled={viewMode === "view" || duration <= 0}
            title={t("editor.comp.k003")}
            aria-label={t("editor.comp.k005")}
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
            title={t("editor.comp.k060")}
            aria-label={t("editor.comp.k057")}
            onClick={stopPlayback}
          >
            <IconStop />
          </button>
          <WaveZoomToolbarButtons
            disabled={waveZoomDisabled}
            onZoomIn={onWaveZoomIn}
            onZoomOut={onWaveZoomOut}
            buttonStyle={{
              ...mobileScrollBtn,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            {...waveZoomLabels}
          />
          {onSave ? (
            <button
              type="button"
              style={{ ...mobileScrollBtn, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              disabled={viewMode === "view"}
              title={t("editor.comp.k095")}
              aria-label={t("editor.comp.k052")}
              onClick={onSave}
            >
              <IconSave />
            </button>
          ) : null}
          {onOpenAudioImport ? (
            <button
              type="button"
              style={{ ...mobileScrollBtn, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              title={t("editor.comp.k120")}
              aria-label={t("editor.comp.k121")}
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
              title={t("editor.comp.k097")}
              aria-label={t("editor.comp.k056")}
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
              title={t("editor.comp.k015")}
              aria-label={t("editor.comp.k014")}
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
      <BrandRailWithHome
        compact
        showHome={wideWorkbench && !editorMobileStack}
      />
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
        {wideWorkbench && !editorMobileStack ? (
          <UpdateLogToolbarButton
            style={{
              ...timelineToolbarBtn,
              padding: `${tlPx(4)} ${tlPx(9)}`,
              minHeight: tlPx(28),
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: tlPx(10),
            }}
          />
        ) : null}
        {showFormationChange && onOpenFormationChange ? (
          <FormationChangeButton
            disabled={viewMode === "view"}
            onClick={onOpenFormationChange}
            style={{
              ...timelineToolbarBtn,
              padding: `${tlPx(4)} ${tlPx(9)}`,
              minHeight: tlPx(28),
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        ) : null}
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
          title={t("editor.comp.k002")}
          aria-label={t("editor.comp.k004")}
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
          title={t("editor.comp.k003")}
          aria-label={t("editor.comp.k005")}
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
          title={t("editor.comp.k060")}
          aria-label={t("editor.comp.k057")}
          onClick={stopPlayback}
        >
          <IconStop />
        </button>
        <WaveZoomToolbarButtons
          disabled={waveZoomDisabled}
          onZoomIn={onWaveZoomIn}
          onZoomOut={onWaveZoomOut}
          buttonStyle={{
            ...timelineToolbarBtn,
            padding: `${tlPx(4)} ${tlPx(9)}`,
            minHeight: tlPx(28),
            flexShrink: 0,
          }}
          {...waveZoomLabels}
        />
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
            title={t("editor.comp.k095")}
            aria-label={t("editor.comp.k052")}
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
            title={t("editor.comp.k120")}
            aria-label={t("editor.comp.k121")}
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
            title={t("editor.comp.k097")}
            aria-label={t("editor.comp.k056")}
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
            title={t("editor.comp.k015")}
            aria-label={t("editor.comp.k014")}
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

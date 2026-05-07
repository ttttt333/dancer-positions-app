import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { formatMmSsClock } from "../lib/timeFormat";
import { preloadFFmpeg } from "../lib/extractVideoAudio";
import { playbackEngine } from "../core/playbackEngine";
import { shell } from "../theme/choreoShell";

export const TIMELINE_UI_SCALE = 1.2;
export function tlPx(n: number): string {
  return `${Math.round(n * TIMELINE_UI_SCALE * 10) / 10}px`;
}
export const TIMELINE_BRAND_RAIL_CSS = "clamp(200px, 28vw, 340px)";

// ── Shared icon button style ──────────────────────────────────────────────────
function iconBtn(
  color: string,
  sizePx: number,
  disabled: boolean,
  active = false
): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: sizePx,
    height: sizePx,
    minWidth: sizePx,
    padding: 0,
    borderRadius: Math.round(sizePx * 0.28),
    border: `1px solid ${active ? color + "80" : color + "35"}`,
    background: active ? color + "22" : "rgba(255,255,255,0.04)",
    backdropFilter: "blur(6px)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.38 : 1,
    transition: "all 0.14s ease",
    flexShrink: 0,
  };
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function IconPlay({ color = "#22c55e", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "18"}/>
      <path d="M10 8.5 L17 12 L10 15.5 Z" fill={color} stroke={color} strokeWidth="0.5" strokeLinejoin="round"/>
    </svg>
  );
}

function IconPause({ color = "#f59e0b", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "18"}/>
      <path d="M9 8 L9 16 M15 8 L15 16" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

function IconStop({ color = "#94a3b8", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "14"}/>
      <rect x="8" y="8" width="8" height="8" rx="1.5" fill={color} opacity="0.85"/>
    </svg>
  );
}

function IconSeekBack({ color = "#38bdf8", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "14"}/>
      <path d="M14.5 9 L10 12 L14.5 15 Z" fill={color} opacity="0.5" strokeLinejoin="round"/>
      <path d="M10.5 9 L6 12 L10.5 15 Z" fill={color} strokeLinejoin="round"/>
      <path d="M16 9.5 V14.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconSeekFwd({ color = "#38bdf8", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "14"}/>
      <path d="M9.5 9 L14 12 L9.5 15 Z" fill={color} opacity="0.5" strokeLinejoin="round"/>
      <path d="M13.5 9 L18 12 L13.5 15 Z" fill={color} strokeLinejoin="round"/>
      <path d="M8 9.5 V14.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconUndo({ size = 20, disabled = false }: { size?: number; disabled?: boolean }) {
  const c = disabled ? "rgba(148,163,184,0.3)" : "rgba(148,163,184,0.9)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.15" fill="none"/>
      <path d="M4.5 9.5 C4.5 5.8 7.8 3 12 3 C16.2 3 19.5 6.3 19.5 10.5 C19.5 14.7 16.2 18 12 18" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M4.5 9.5 L4.5 5 M4.5 9.5 L9 9.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function IconRedo({ size = 20, disabled = false }: { size?: number; disabled?: boolean }) {
  const c = disabled ? "rgba(148,163,184,0.3)" : "rgba(148,163,184,0.9)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.15" fill="none"/>
      <path d="M19.5 9.5 C19.5 5.8 16.2 3 12 3 C7.8 3 4.5 6.3 4.5 10.5 C4.5 14.7 7.8 18 12 18" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M19.5 9.5 L19.5 5 M19.5 9.5 L15 9.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function IconAddAudio({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <path d="M3 12 Q6 6 9 12 Q12 18 15 12 Q18 6 21 12" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <circle cx="18.5" cy="18.5" r="4" fill="#0f172a" stroke="#ef4444" strokeWidth="1.4"/>
      <path d="M17 18.5 H20 M18.5 17 V20" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function IconSave({ size = 20, disabled = false }: { size?: number; disabled?: boolean }) {
  const c = disabled ? "rgba(148,163,184,0.3)" : "#22c55e";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={c} strokeWidth="1.5" fill={c + "18"}/>
      <path d="M7 3 L7 9 L17 9 L17 3" stroke={c} strokeWidth="1.4" fill="none"/>
      <rect x="14" y="3.5" width="2.5" height="4" rx="0.5" fill={c} opacity="0.7"/>
      <rect x="6" y="13" width="12" height="7" rx="1.5" stroke={c} strokeWidth="1.3" fill="none"/>
      <path d="M9.5 16 L11.5 18 L14.5 14.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconDockToggle({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <rect x="2" y="4" width="20" height="16" rx="2.5" stroke="rgba(148,163,184,0.7)" strokeWidth="1.4" fill="none"/>
      <path d="M2 10 L22 10" stroke="rgba(148,163,184,0.5)" strokeWidth="1.2"/>
      <path d="M11 14 L8 17 M11 14 L14 17 M11 14 L11 20" stroke="rgba(148,163,184,0.8)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── PlaybackClockReadout ──────────────────────────────────────────────────────
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

// ── Brand ─────────────────────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
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
  editorMobileStack?: boolean;
  compactDockLeading?: ReactNode;
};

// ── Playbar center cluster (shared between layouts) ───────────────────────────
function PlaybarCenter({
  viewMode, duration, isPlaying, currentTime,
  togglePlay, stopPlayback, seekForward5Sec, seekBackward5Sec,
  onSave, onUndo, onRedo, undoDisabled, redoDisabled,
  btnSz = 34,
}: Pick<TimelineToolbarProps,
  | "viewMode" | "duration" | "isPlaying" | "currentTime"
  | "togglePlay" | "stopPlayback" | "seekForward5Sec" | "seekBackward5Sec"
  | "onSave" | "onUndo" | "onRedo" | "undoDisabled" | "redoDisabled"
> & { btnSz?: number }) {
  const noAudio = viewMode === "view" || duration <= 0;
  const noEdit  = viewMode === "view";
  const bigSz = Math.round(btnSz * 1.25);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: tlPx(6), flexWrap: "nowrap", minWidth: 0 }}>

      {/* 5s back */}
      <button type="button"
        style={iconBtn("#38bdf8", btnSz, noAudio)}
        disabled={noAudio}
        title="5 秒戻す" aria-label="5秒戻す"
        onClick={seekBackward5Sec}
      >
        <IconSeekBack color="#38bdf8" size={Math.round(btnSz * 0.62)} />
      </button>

      {/* play / pause — bigger */}
      <button type="button"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: bigSz, height: bigSz, minWidth: bigSz, padding: 0,
          borderRadius: Math.round(bigSz * 0.5),
          border: `1.5px solid ${isPlaying ? "#f59e0b70" : "#22c55e70"}`,
          background: isPlaying ? "#f59e0b20" : "#22c55e20",
          backdropFilter: "blur(8px)",
          cursor: noEdit ? "not-allowed" : "pointer",
          opacity: noEdit ? 0.38 : 1,
          transition: "all 0.14s ease",
          flexShrink: 0,
          boxShadow: isPlaying
            ? "0 0 14px rgba(245,158,11,0.25)"
            : "0 0 14px rgba(34,197,94,0.2)",
        }}
        disabled={noEdit}
        onClick={togglePlay}
        aria-label={isPlaying ? "一時停止" : "再生"}
        title={isPlaying ? "一時停止" : "再生"}
      >
        {isPlaying
          ? <IconPause color="#f59e0b" size={Math.round(bigSz * 0.62)} />
          : <IconPlay  color="#22c55e" size={Math.round(bigSz * 0.62)} />
        }
      </button>

      {/* stop / top */}
      <button type="button"
        style={iconBtn("#94a3b8", btnSz, noAudio)}
        disabled={noAudio}
        title="先頭へ戻す" aria-label="先頭へ"
        onClick={stopPlayback}
      >
        <IconStop color="#94a3b8" size={Math.round(btnSz * 0.62)} />
      </button>

      {/* 5s fwd */}
      <button type="button"
        style={iconBtn("#38bdf8", btnSz, noAudio)}
        disabled={noAudio}
        title="5 秒進む" aria-label="5秒進む"
        onClick={seekForward5Sec}
      >
        <IconSeekFwd color="#38bdf8" size={Math.round(btnSz * 0.62)} />
      </button>

      {/* clock */}
      <PlaybackClockReadout
        isPlaying={isPlaying}
        idleTimeSec={currentTime}
        durationSec={duration}
        monoFontSizePx={12 * TIMELINE_UI_SCALE}
      />

      {/* save */}
      {onSave ? (
        <button type="button"
          style={iconBtn("#22c55e", btnSz, noEdit)}
          disabled={noEdit}
          title="立ち位置をライブラリに保存" aria-label="保存"
          onClick={onSave}
        >
          <IconSave size={Math.round(btnSz * 0.62)} disabled={noEdit} />
        </button>
      ) : null}

      {/* undo */}
      {onUndo ? (
        <button type="button"
          style={{ ...iconBtn("#94a3b8", btnSz, undoDisabled), border: "none", background: "transparent" }}
          disabled={undoDisabled}
          title="編集を元に戻す（⌘Z / Ctrl+Z）" aria-label="元に戻す"
          onClick={() => onUndo?.()}
        >
          <IconUndo size={btnSz} disabled={undoDisabled} />
        </button>
      ) : null}

      {/* redo */}
      {onRedo ? (
        <button type="button"
          style={{ ...iconBtn("#94a3b8", btnSz, redoDisabled), border: "none", background: "transparent" }}
          disabled={redoDisabled}
          title="やり直す（⌘⇧Z / Ctrl+Shift+Z）" aria-label="やり直す"
          onClick={() => onRedo?.()}
        >
          <IconRedo size={btnSz} disabled={redoDisabled} />
        </button>
      ) : null}

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
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
  compactDockLeading,
}: TimelineToolbarProps) {
  const noAudio = viewMode === "view" || duration <= 0;
  const noEdit  = viewMode === "view";

  // ── Non-compact (tall) layout ───────────────────────────────────────────
  if (!compactTopDock) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: tlPx(4), minWidth: 0, width: "100%", contain: "layout", scrollbarWidth: "thin" }}>
        {/* top row: audio add + undo/redo + dock close */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: tlPx(5), alignItems: "center", rowGap: tlPx(3), width: "100%", minWidth: 0 }}>
          <label
            htmlFor="choreogrid-timeline-audio-file"
            style={{ ...iconBtn("#ef4444", Math.round(32 * TIMELINE_UI_SCALE), false), cursor: "pointer" }}
            aria-label="音源追加"
            title="楽曲または動画から音声を読み込み"
            onPointerEnter={() => { void preloadFFmpeg(); }}
            onFocus={() => { void preloadFFmpeg(); }}
          >
            <IconAddAudio size={Math.round(18 * TIMELINE_UI_SCALE)} />
          </label>

          {onUndo && onRedo && (
            <>
              <div style={{ width: "1px", height: tlPx(16), background: "#334155", flexShrink: 0 }} aria-hidden />
              <button type="button"
                style={{ ...iconBtn("#94a3b8", Math.round(32 * TIMELINE_UI_SCALE), undoDisabled), border: "none", background: "transparent" }}
                disabled={undoDisabled}
                title="編集を元に戻す（⌘Z / Ctrl+Z）" aria-label="戻る"
                onClick={() => onUndo()}
              >
                <IconUndo size={Math.round(30 * TIMELINE_UI_SCALE)} disabled={undoDisabled} />
              </button>
              <button type="button"
                style={{ ...iconBtn("#94a3b8", Math.round(32 * TIMELINE_UI_SCALE), redoDisabled), border: "none", background: "transparent" }}
                disabled={redoDisabled}
                title="やり直す（⌘⇧Z / Ctrl+Shift+Z）" aria-label="進む"
                onClick={() => onRedo()}
              >
                <IconRedo size={Math.round(30 * TIMELINE_UI_SCALE)} disabled={redoDisabled} />
              </button>
            </>
          )}

          {waveTimelineDockTop && wideWorkbench && onWaveTimelineDockTopChange ? (
            <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: tlPx(4), position: "sticky", right: 0, zIndex: 3, paddingLeft: tlPx(10), background: "linear-gradient(90deg, transparent, #020617 28%, #020617)" }}>
              <button type="button"
                style={iconBtn("#94a3b8", Math.round(32 * TIMELINE_UI_SCALE), noEdit)}
                disabled={noEdit}
                title="上部の波形エリアを閉じる" aria-label="上部の波形エリアを閉じる"
                onClick={() => onWaveTimelineDockTopChange(false)}
              >
                <IconDockToggle size={Math.round(18 * TIMELINE_UI_SCALE)} />
              </button>
            </div>
          ) : null}
        </div>

        {/* main row: brand + playback center */}
        <div style={{ display: "grid", gridTemplateColumns: `${brandRailCss} minmax(0, 1fr) ${brandRailCss}`, alignItems: "stretch", columnGap: tlPx(6), width: "100%", minWidth: 0, overflowX: "hidden" }}>
          <div style={{ minWidth: 0, maxWidth: "100%", overflow: "hidden", display: "flex", alignItems: "stretch" }}>
            <ChoreoCoreHeaderBrand />
          </div>
          <PlaybarCenter
            viewMode={viewMode} duration={duration} isPlaying={isPlaying} currentTime={currentTime}
            togglePlay={togglePlay} stopPlayback={stopPlayback}
            seekForward5Sec={seekForward5Sec} seekBackward5Sec={seekBackward5Sec}
            onSave={onSave} onUndo={onUndo} onRedo={onRedo}
            undoDisabled={undoDisabled} redoDisabled={redoDisabled}
            btnSz={Math.round(32 * TIMELINE_UI_SCALE)}
          />
          <div aria-hidden style={{ minWidth: 0 }} />
        </div>
      </div>
    );
  }

  // ── Mobile stack layout ─────────────────────────────────────────────────
  if (editorMobileStack) {
    const mSz = Math.round(26 * TIMELINE_UI_SCALE);
    const mBigSz = Math.round(32 * TIMELINE_UI_SCALE);
    return (
      <div
        className="wave-compact-time-above-wave editor-timeline-mobile-dock"
        style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: tlPx(4), width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", marginTop: 0, padding: `${tlPx(1)} ${tlPx(6)} ${tlPx(2)}`, borderBottom: `1px solid ${shell.border}`, flexShrink: 0, background: shell.bgChrome }}
      >
        {compactDockLeading ? (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {compactDockLeading}
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "row", alignItems: "center", gap: tlPx(3), overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", flexWrap: "nowrap", touchAction: "manipulation" }}>
          <button type="button" style={iconBtn("#38bdf8", mSz, noAudio)} disabled={noAudio} title="5 秒戻す" aria-label="5秒戻す" onClick={seekBackward5Sec}>
            <IconSeekBack color="#38bdf8" size={Math.round(mSz * 0.62)} />
          </button>
          <button type="button"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: mBigSz, height: mBigSz, minWidth: mBigSz, padding: 0, borderRadius: mBigSz, border: `1.5px solid ${isPlaying ? "#f59e0b70" : "#22c55e70"}`, background: isPlaying ? "#f59e0b20" : "#22c55e20", backdropFilter: "blur(6px)", cursor: noEdit ? "not-allowed" : "pointer", opacity: noEdit ? 0.38 : 1, flexShrink: 0 }}
            disabled={noEdit} onClick={togglePlay} aria-label={isPlaying ? "一時停止" : "再生"} title={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? <IconPause color="#f59e0b" size={Math.round(mBigSz * 0.62)} /> : <IconPlay color="#22c55e" size={Math.round(mBigSz * 0.62)} />}
          </button>
          <button type="button" style={iconBtn("#94a3b8", mSz, noAudio)} disabled={noAudio} title="先頭へ" aria-label="先頭へ" onClick={stopPlayback}>
            <IconStop color="#94a3b8" size={Math.round(mSz * 0.62)} />
          </button>
          <button type="button" style={iconBtn("#38bdf8", mSz, noAudio)} disabled={noAudio} title="5 秒進む" aria-label="5秒進む" onClick={seekForward5Sec}>
            <IconSeekFwd color="#38bdf8" size={Math.round(mSz * 0.62)} />
          </button>
          {onSave ? (
            <button type="button" style={iconBtn("#22c55e", mSz, noEdit)} disabled={noEdit} title="保存" aria-label="保存" onClick={onSave}>
              <IconSave size={Math.round(mSz * 0.62)} disabled={noEdit} />
            </button>
          ) : null}
          {onUndo ? (
            <button type="button" style={{ ...iconBtn("#94a3b8", mSz, undoDisabled), border: "none", background: "transparent" }} disabled={undoDisabled} title="元に戻す" aria-label="元に戻す" onClick={() => onUndo?.()}>
              <IconUndo size={mSz} disabled={undoDisabled} />
            </button>
          ) : null}
          {onRedo ? (
            <button type="button" style={{ ...iconBtn("#94a3b8", mSz, redoDisabled), border: "none", background: "transparent" }} disabled={redoDisabled} title="やり直す" aria-label="やり直す" onClick={() => onRedo?.()}>
              <IconRedo size={mSz} disabled={redoDisabled} />
            </button>
          ) : null}
        </div>
        <div style={{ flexShrink: 0, marginLeft: tlPx(2) }}>
          <PlaybackClockReadout isPlaying={isPlaying} idleTimeSec={currentTime} durationSec={duration} monoFontSizePx={10.5 * TIMELINE_UI_SCALE} />
        </div>
      </div>
    );
  }

  // ── Compact top-dock layout ──────────────────────────────────────────────
  return (
    <div
      className="wave-compact-time-above-wave"
      style={{ display: "grid", gridTemplateColumns: `${brandRailCss} minmax(0, 1fr) ${brandRailCss}`, alignItems: "stretch", columnGap: tlPx(6), width: "100%", minWidth: 0, marginTop: 0, padding: `${tlPx(0)} ${tlPx(6)} ${tlPx(2)}`, borderBottom: `1px solid ${shell.border}`, flexShrink: 0, background: shell.bgChrome }}
    >
      <div style={{ minWidth: 0, maxWidth: "100%", overflow: "hidden", display: "flex", alignItems: "stretch" }}>
        <ChoreoCoreHeaderBrand compact />
      </div>
      <PlaybarCenter
        viewMode={viewMode} duration={duration} isPlaying={isPlaying} currentTime={currentTime}
        togglePlay={togglePlay} stopPlayback={stopPlayback}
        seekForward5Sec={seekForward5Sec} seekBackward5Sec={seekBackward5Sec}
        onSave={onSave} onUndo={onUndo} onRedo={onRedo}
        undoDisabled={undoDisabled} redoDisabled={redoDisabled}
        btnSz={Math.round(28 * TIMELINE_UI_SCALE)}
      />
      <div aria-hidden style={{ minWidth: 0 }} />
    </div>
  );
}

/**
 * MobilePlaybar — 再生コントロールストリップ（波形の下）
 *
 * 高さ 60px。5つの再生ボタン + 時刻表示。
 * 既存 TimelineToolbar の SVG アイコンと同じ言語で統一。
 */
import type { CSSProperties } from "react";
import { shell } from "../../theme/choreoShell";
import { formatMmSsClock } from "../../lib/timeFormat";

// ── Icons (same SVG style as TimelineToolbar) ─────────────────────────────

function IconPlay({ color = "#22c55e", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "18"} />
      <path d="M10 8.5 L17 12 L10 15.5 Z" fill={color} stroke={color} strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconPause({ color = "#f59e0b", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "18"} />
      <path d="M9 8 L9 16 M15 8 L15 16" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconStop({ color = "#94a3b8", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "14"} />
      <rect x="8" y="8" width="8" height="8" rx="1.5" fill={color} opacity="0.85" />
    </svg>
  );
}

function IconSeekBack({ color = "#38bdf8", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "14"} />
      <path d="M14.5 9 L10 12 L14.5 15 Z" fill={color} opacity="0.5" strokeLinejoin="round" />
      <path d="M10.5 9 L6 12 L10.5 15 Z" fill={color} strokeLinejoin="round" />
      <path d="M16 9.5 V14.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconSeekFwd({ color = "#38bdf8", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill={color + "14"} />
      <path d="M9.5 9 L14 12 L9.5 15 Z" fill={color} opacity="0.5" strokeLinejoin="round" />
      <path d="M13.5 9 L18 12 L13.5 15 Z" fill={color} strokeLinejoin="round" />
      <path d="M8 9.5 V14.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

export type MobilePlaybarProps = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  hasAudio: boolean;
  isView?: boolean;
  togglePlay: () => void;
  stopPlayback: () => void;
  seekForward5Sec: () => void;
  seekBackward5Sec: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────

export function MobilePlaybar({
  isPlaying,
  currentTime,
  duration,
  hasAudio,
  isView = false,
  togglePlay,
  stopPlayback,
  seekForward5Sec,
  seekBackward5Sec,
}: MobilePlaybarProps) {
  const noAudio = !hasAudio;
  const noEdit = isView;

  const sz = 32;
  const bigSz = 42;

  const iconBtn = (color: string, disabled: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: sz,
    height: sz,
    minWidth: sz,
    padding: 0,
    borderRadius: sz,
    border: `1px solid ${disabled ? "transparent" : color + "40"}`,
    background: disabled ? "transparent" : color + "14",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.32 : 1,
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  });

  const bigBtn = (playing: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: bigSz,
    height: bigSz,
    minWidth: bigSz,
    padding: 0,
    borderRadius: bigSz,
    border: `1.5px solid ${playing ? "#f59e0b70" : "#22c55e70"}`,
    background: playing ? "#f59e0b20" : "#22c55e20",
    backdropFilter: "blur(6px)",
    cursor: noEdit ? "not-allowed" : "pointer",
    opacity: noEdit ? 0.38 : 1,
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 60,
        padding: "0 16px",
        background: shell.bgChrome,
        borderTop: `1px solid ${shell.border}`,
        flexShrink: 0,
      }}
    >
      {/* ← 5秒 */}
      <button
        type="button"
        style={iconBtn("#38bdf8", noAudio)}
        disabled={noAudio}
        title="5 秒戻す"
        aria-label="5秒戻す"
        onClick={seekBackward5Sec}
      >
        <IconSeekBack color="#38bdf8" size={Math.round(sz * 0.62)} />
      </button>

      {/* ▶/⏸ */}
      <button
        type="button"
        style={bigBtn(isPlaying)}
        disabled={noEdit}
        aria-label={isPlaying ? "一時停止" : "再生"}
        title={isPlaying ? "一時停止" : "再生"}
        onClick={togglePlay}
      >
        {isPlaying
          ? <IconPause color="#f59e0b" size={Math.round(bigSz * 0.55)} />
          : <IconPlay color="#22c55e" size={Math.round(bigSz * 0.55)} />
        }
      </button>

      {/* ■ 先頭 */}
      <button
        type="button"
        style={iconBtn("#94a3b8", noAudio)}
        disabled={noAudio}
        title="先頭へ"
        aria-label="先頭へ"
        onClick={stopPlayback}
      >
        <IconStop color="#94a3b8" size={Math.round(sz * 0.62)} />
      </button>

      {/* → 5秒 */}
      <button
        type="button"
        style={iconBtn("#38bdf8", noAudio)}
        disabled={noAudio}
        title="5 秒進む"
        aria-label="5秒進む"
        onClick={seekForward5Sec}
      >
        <IconSeekFwd color="#38bdf8" size={Math.round(sz * 0.62)} />
      </button>

      {/* 時刻 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 0,
        }}
      >
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: 13,
            fontWeight: 600,
            color: shell.text,
            letterSpacing: "0.03em",
            lineHeight: 1,
          }}
        >
          {formatMmSsClock(currentTime)}
        </span>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: 11,
            color: shell.textMuted,
            letterSpacing: "0.02em",
            lineHeight: 1.4,
          }}
        >
          / {formatMmSsClock(duration)}
        </span>
      </div>
    </div>
  );
}

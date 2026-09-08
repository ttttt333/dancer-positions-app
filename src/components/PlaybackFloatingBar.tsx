/**
 * 画面下部中央に浮遊する再生コントロール（Glass pill）。
 */

import type { CSSProperties } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import {
  normalizePracticePlaybackRate,
  PRACTICE_PLAYBACK_RATES,
  usePracticePlaybackStore,
} from "../store/practicePlaybackStore";
import { shell } from "../theme/choreoShell";
import { editorGlass, glassPillStyle } from "../theme/editorGlass";
import { formatMmSsClock } from "../lib/timeFormat";
import { playbackEngine } from "../core/playbackEngine";
import { memo, useEffect, useLayoutEffect, useRef } from "react";

type Props = {
  viewMode: ChoreographyProjectJson["viewMode"];
  duration: number;
  isPlaying: boolean;
  currentTime: number;
  togglePlay: () => void;
  stopPlayback: () => void;
  seekForward5Sec: () => void;
  seekBackward5Sec: () => void;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  /** 波形パネル高さに合わせ、その直上に載せるオフセット */
  bottomOffsetPx?: number;
  /**
   * parent の上端に載せる（波形ドック直上）。
   * true のとき bottomOffsetPx は無視。
   */
  anchorAboveParent?: boolean;
};

const iconBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: `1px solid ${shell.border}`,
  background: "rgba(255,255,255,0.04)",
  color: shell.text,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};

function IconSeekBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M11.5 12 18 7v10l-6.5-5Zm-7 0L11 7v10l-6.5-5Z"
      />
    </svg>
  );
}
function IconSeekFwd() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12.5 12 6 7v10l6.5-5Zm7 0L13 7v10l6.5-5Z"
      />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
    </svg>
  );
}
function IconStop() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

const FloatingClock = memo(function FloatingClock({
  isPlaying,
  idleTimeSec,
  durationSec,
}: {
  isPlaying: boolean;
  idleTimeSec: number;
  durationSec: number;
}) {
  const liveRef = useRef<HTMLSpanElement>(null);
  const idleRef = useRef(idleTimeSec);
  idleRef.current = idleTimeSec;

  useLayoutEffect(() => {
    if (isPlaying) return;
    const el = liveRef.current;
    if (el) el.textContent = formatMmSsClock(idleTimeSec);
  }, [isPlaying, idleTimeSec]);

  useEffect(() => {
    if (!isPlaying) return;
    let id = 0;
    const loop = () => {
      const t =
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
          ? playbackEngine.getCurrentTime()
          : idleRef.current;
      const el = liveRef.current;
      if (el) el.textContent = formatMmSsClock(t);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [isPlaying]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 4,
        fontVariantNumeric: "tabular-nums",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        fontWeight: 700,
        color: shell.text,
        minWidth: 108,
        justifyContent: "center",
      }}
      aria-live="off"
    >
      <span ref={liveRef}>{formatMmSsClock(idleTimeSec)}</span>
      <span style={{ color: shell.textSubtle, fontWeight: 600 }}>/</span>
      <span style={{ color: shell.textMuted, fontWeight: 600 }}>
        {formatMmSsClock(durationSec)}
      </span>
    </span>
  );
});

export function PlaybackFloatingBar({
  viewMode,
  duration,
  isPlaying,
  currentTime,
  togglePlay,
  stopPlayback,
  seekForward5Sec,
  seekBackward5Sec,
  playbackRate = 1,
  onPlaybackRateChange,
  bottomOffsetPx = 0,
  anchorAboveParent = false,
}: Props) {
  const isCountingIn = usePracticePlaybackStore((s) => s.isCountingIn);
  const countInEnabled = usePracticePlaybackStore((s) => s.countInEnabled);
  const setCountInEnabled = usePracticePlaybackStore((s) => s.setCountInEnabled);
  const rate = normalizePracticePlaybackRate(playbackRate);
  const disabled = viewMode === "view";
  const active = isPlaying || isCountingIn;

  return (
    <div
      role="toolbar"
      aria-label="再生コントロール"
      style={{
        position: "absolute",
        left: "50%",
        ...(anchorAboveParent
          ? {
              bottom: "100%",
              marginBottom: 12,
            }
          : {
              bottom: `calc(${bottomOffsetPx}px + ${editorGlass.safeBottom})`,
            }),
        transform: "translateX(-50%)",
        zIndex: 40,
        pointerEvents: "auto",
        maxWidth: "calc(100% - 24px)",
      }}
    >
      <div style={{ ...glassPillStyle, gap: 6 }}>
        <button
          type="button"
          style={iconBtn}
          disabled={disabled || duration <= 0}
          title="5秒戻す"
          aria-label="5秒戻す"
          onClick={seekBackward5Sec}
        >
          <IconSeekBack />
        </button>
        <button
          type="button"
          style={{
            ...iconBtn,
            width: 44,
            height: 44,
            background: active
              ? "linear-gradient(180deg, #e8d48b, #d4af37)"
              : "linear-gradient(180deg, rgba(212,175,55,0.35), rgba(212,175,55,0.18))",
            borderColor: shell.accent,
            color: active ? "#0a0908" : shell.text,
          }}
          title={
            isCountingIn
              ? "カウントイン中（再押下で中止）"
              : isPlaying
                ? "一時停止"
                : "再生"
          }
          aria-label={
            isCountingIn ? "カウントインを中止" : isPlaying ? "一時停止" : "再生"
          }
          onClick={togglePlay}
        >
          {active ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          style={iconBtn}
          disabled={disabled || duration <= 0}
          title="停止"
          aria-label="停止"
          onClick={stopPlayback}
        >
          <IconStop />
        </button>
        <button
          type="button"
          style={iconBtn}
          disabled={disabled || duration <= 0}
          title="5秒進む"
          aria-label="5秒進む"
          onClick={seekForward5Sec}
        >
          <IconSeekFwd />
        </button>

        <div
          aria-hidden
          style={{
            width: 1,
            height: 22,
            background: "rgba(255,255,255,0.12)",
            margin: "0 2px",
          }}
        />

        <FloatingClock
          isPlaying={active}
          idleTimeSec={currentTime}
          durationSec={duration}
        />

        <button
          type="button"
          disabled={disabled}
          title={
            countInEnabled
              ? "カウントイン ON（再生前に 5-6-7-8）"
              : "カウントイン OFF"
          }
          aria-label="カウントイン 5-6-7-8"
          aria-pressed={countInEnabled}
          onClick={() => setCountInEnabled(!countInEnabled)}
          style={{
            ...iconBtn,
            width: "auto",
            padding: "0 10px",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: countInEnabled ? "#0a0908" : shell.textMuted,
            background: countInEnabled
              ? "linear-gradient(180deg, #7dd3fc, #0ea5e9)"
              : "rgba(255,255,255,0.04)",
            borderColor: countInEnabled ? "#38bdf8" : shell.border,
          }}
        >
          5-6-7-8
        </button>

        {onPlaybackRateChange ? (
          <select
            value={String(rate)}
            disabled={disabled}
            aria-label="再生速度（ピッチ固定）"
            title="ピッチ固定の再生速度"
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) onPlaybackRateChange(next);
            }}
            style={{
              height: 32,
              borderRadius: 999,
              border: `1px solid ${shell.border}`,
              background: "rgba(255,255,255,0.04)",
              color: shell.text,
              fontSize: 11,
              fontWeight: 700,
              padding: "0 8px",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {PRACTICE_PLAYBACK_RATES.map((r) => (
              <option key={r} value={String(r)}>
                {r === 1 ? "1x" : `${r}x`}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

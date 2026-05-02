// src/components/mobile/MobileBottomNav.tsx
import { useEditorStore } from "../../store/useEditorStore";

interface MobileBottomNavProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onOpenTimeline: () => void;
  currentIndex: number;
  totalCues: number;
}

export function MobileBottomNav({
  isPlaying,
  onPlay,
  onPause,
  onOpenTimeline,
  currentIndex,
  totalCues,
}: MobileBottomNavProps) {
  const selectCueByIndex = useEditorStore((s: any) => s.selectCueByIndex);
  const project = useEditorStore((s: any) => s.project);
  const cues = project?.cues ?? [];

  const goPrev = () => {
    const idx = Math.max(0, currentIndex - 1);
    if (cues[idx]) selectCueByIndex?.(idx);
    navigator.vibrate?.(10);
  };

  const goNext = () => {
    const idx = Math.min(totalCues - 1, currentIndex + 1);
    if (cues[idx]) selectCueByIndex?.(idx);
    navigator.vibrate?.(10);
  };

  const togglePlay = () => {
    isPlaying ? onPause() : onPlay();
    navigator.vibrate?.(15);
  };

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < totalCues - 1;

  // シーン名取得
  const currentCue = cues[currentIndex];
  const cueName = currentCue?.name ?? currentCue?.label ?? `シーン ${currentIndex + 1}`;

  return (
    <div style={{
      background: "#13161C",
      borderTop: "0.5px solid rgba(255,255,255,0.08)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      flexShrink: 0,
    }}>
      {/* シーン名表示バー */}
      <div style={{
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
      }}>
        {/* プログレスバー */}
        <div style={{
          flex: 1,
          height: 2,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 1,
          margin: "0 16px",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: totalCues > 0 ? `${((currentIndex + 1) / totalCues) * 100}%` : "0%",
            background: "#6C63FF",
            borderRadius: 1,
            transition: "width 0.3s ease",
          }} />
        </div>
        <span style={{
          position: "absolute",
          fontFamily: "monospace",
          fontSize: 11,
          color: "#555B6A",
        }}>
          {cueName}
        </span>
      </div>

      {/* ボタン列 */}
      <div style={{
        height: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "0 16px",
      }}>

        {/* 前のシーン */}
        <NavBtn
          onPress={goPrev}
          disabled={!canPrev}
          label="前へ"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 4v12M14 4L8 10l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </NavBtn>

        {/* 再生・停止（メイン） */}
        <button
          onClick={togglePlay}
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: isPlaying
              ? "rgba(245,158,11,0.15)"
              : "#6C63FF",
            border: isPlaying
              ? "1.5px solid #F59E0B"
              : "none",
            color: isPlaying ? "#F59E0B" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          } as React.CSSProperties}
          aria-label={isPlaying ? "一時停止" : "再生"}
        >
          {isPlaying ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
              <rect x="4" y="3" width="5" height="16" rx="1.5"/>
              <rect x="13" y="3" width="5" height="16" rx="1.5"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
              <path d="M5 3.5l14 7.5-14 7.5V3.5z"/>
            </svg>
          )}
        </button>

        {/* 次のシーン */}
        <NavBtn
          onPress={goNext}
          disabled={!canNext}
          label="次へ"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 4v12M6 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </NavBtn>

        {/* スペーサー */}
        <div style={{ flex: 1 }} />

        {/* タイムライン */}
        <NavBtn onPress={onOpenTimeline} label="タイムライン">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="5" width="16" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="9" width="10" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="13" width="13" height="2" rx="1" fill="currentColor"/>
            <circle cx="15" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </NavBtn>
      </div>
    </div>
  );
}

// ── サブコンポーネント：汎用ナビボタン ──────────────────────
function NavBtn({
  children,
  onPress,
  disabled = false,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: "rgba(255,255,255,0.05)",
        border: "0.5px solid rgba(255,255,255,0.1)",
        color: disabled ? "#3A3F4D" : "#8B909E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s ease",
        WebkitTapHighlightColor: "transparent",
        flexShrink: 0,
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}

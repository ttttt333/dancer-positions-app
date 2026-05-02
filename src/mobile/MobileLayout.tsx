import { useState } from "react";
import { MobileStage } from "./MobileStage";
import { BottomNav } from "./BottomNav";
import { MobileTimelineModal } from "./MobileTimelineModal";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { useEditorStore } from "../store/useEditorStore";

export function MobileLayout() {
  const [timelineOpen, setTimelineOpen] = useState(false);

  const { isPlaying, setIsPlaying } = usePlaybackUiStore();
  const selectedCueId = useEditorStore((state: any) => state.selectedCueId);

  return (
    <div style={styles.container}>
      {/* 🔹 ヘッダー（最小） */}
      <div style={styles.header}>
        <span>Cue: {selectedCueId || "-"}</span>
        <span>{isPlaying ? "▶︎ 再生中" : "⏸ 停止"}</span>
      </div>

      {/* 🔥 メイン（ステージ） */}
      <div style={styles.stage}>
        <MobileStage />
      </div>

      {/* 🔻 ボトム操作 */}
      <BottomNav
        isPlaying={isPlaying}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onOpenTimeline={() => setTimelineOpen(true)}
      />

      {/* 📊 タイムライン（隠す） */}
      {timelineOpen && (
        <MobileTimelineModal onClose={() => setTimelineOpen(false)} />
      )}
    </div>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0f172a",
    color: "#fff",
  },
  header: {
    height: 40,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 12px",
    fontSize: 14,
    opacity: 0.8,
    borderBottom: "1px solid #333",
  },
  stage: {
    flex: 1,
    position: "relative",
    touchAction: "none",
  },
};

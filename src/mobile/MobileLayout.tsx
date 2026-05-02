import { useState } from "react";
import { MobileStage } from "./MobileStage";
import { BottomNav } from "./BottomNav";
import { MobileTimelineModal } from "./MobileTimelineModal";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { useEditorStore } from "../store/useEditorStore";

export function MobileLayout() {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [uiCollapsed, setUiCollapsed] = useState(false);

  const { isPlaying, setIsPlaying } = usePlaybackUiStore();
  const selectedCueId = useEditorStore((state: any) => state.selectedCueId);

  return (
    <div style={styles.container}>
      {/* 🔹 ヘッダー（最小） - 折りたたみ可能 */}
      {!uiCollapsed && (
        <div style={styles.header}>
          <span>Cue: {selectedCueId || "-"}</span>
          <span>{isPlaying ? "▶︎ 再生中" : "⏸ 停止"}</span>
        </div>
      )}

      {/* 🔥 メイン（ステージ） */}
      <div style={styles.stage}>
        <MobileStage />
        
        {/* 🔘 折りたたみボタン（常に表示） */}
        <button
          onClick={() => setUiCollapsed(!uiCollapsed)}
          style={{
            position: "absolute",
            top: uiCollapsed ? 16 : 56,
            right: 16,
            width: 48,
            height: 48,
            background: "rgba(15, 23, 42, 0.9)",
            border: "2px solid #475569",
            borderRadius: "50%",
            color: "#f1f5f9",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(10px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 1000,
            transition: "all 0.3s ease"
          }}
        >
          {uiCollapsed ? "☰" : "✕"}
        </button>
      </div>

      {/* 🔻 ボトム操作 - 折りたたみ可能 */}
      {!uiCollapsed && (
        <BottomNav
          isPlaying={isPlaying}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onOpenTimeline={() => setTimelineOpen(true)}
        />
      )}

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

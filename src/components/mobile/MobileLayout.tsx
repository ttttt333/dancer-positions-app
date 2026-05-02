import { useState } from "react";
import { MobileStage } from "./MobileStage";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileHeader } from "./MobileHeader";
import { usePlaybackUiStore } from "../../store/usePlaybackUiStore";
import { useEditorStore } from "../../store/useEditorStore";

export function MobileLayout() {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const { isPlaying, setIsPlaying } = usePlaybackUiStore();
  const selectedCueId = useEditorStore((state: any) => state.selectedCueId);
  const project = useEditorStore((state: any) => state.project);

  const cues = project?.cues ?? [];
  const currentIndex = cues.findIndex((c: any) => c.id === selectedCueId);
  const totalCues = cues.length;

  return (
    <div style={{
      width: "100dvw",
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "#0A0C10",
      color: "#F0F2F8",
      overflow: "hidden",
      position: "fixed",
      inset: 0,
    }}>
      {/* ヘッダー */}
      <MobileHeader
        currentIndex={currentIndex}
        totalCues={totalCues}
        isPlaying={isPlaying}
        projectName={project?.name ?? "ChoreoCore"}
      />

      {/* ステージ（メイン） */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <MobileStage />
      </div>

      {/* ボトムナビ */}
      <MobileBottomNav
        isPlaying={isPlaying}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onOpenTimeline={() => setTimelineOpen(true)}
        currentIndex={currentIndex}
        totalCues={totalCues}
      />
    </div>
  );
}

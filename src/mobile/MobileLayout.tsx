import { useState } from "react";
import { BottomNav } from "./BottomNav";
import { MobileStage } from "./MobileStageEnhanced";
import { MobileTimelineModal } from "./MobileTimelineModal";

export function MobileLayout() {
  const [timelineOpen, setTimelineOpen] = useState(false);

  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      background: "#020617",
      overflow: "hidden",
      position: "relative"
    }}>
      
      {/* ステージ（メイン） */}
      <MobileStage />

      {/* タイムライン（モーダル） */}
      <MobileTimelineModal
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
      />

      {/* 下ナビ */}
      <BottomNav onOpenTimeline={() => setTimelineOpen(true)} />
    </div>
  );
}

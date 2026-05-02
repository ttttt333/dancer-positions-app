import { useRef, useState } from "react";
import { StageBoard } from "../components/StageBoard";
import { useEditorStore } from "../store/useEditorStore";

export function MobileStage() {
  const project = useEditorStore((state) => state.project);
  const selectedCueId = useEditorStore((state) => state.selectedCueId);
  const setSelectedDancerIds = useEditorStore((state) => state.setSelectedDancerIds);
  const setDragState = useEditorStore((state) => state.setDragState);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const swipeStartX = useRef(0);

  const selectedCue = project?.cues.find(c => c.id === selectedCueId);
  const formation = project?.formations.find(f => f.id === selectedCue?.formationId);

  // 🚀 タッチドラッグ完全対応
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    dragStartPos.current = { x, y };
    swipeStartX.current = x;
    setIsDragging(true);
    
    // ダンサー判定ロジック呼ぶ
    const element = document.elementFromPoint(x, y);
    if (element?.closest('[data-dancer-id]')) {
      const dancerId = element.closest('[data-dancer-id]')?.getAttribute('data-dancer-id');
      if (dancerId) {
        setDragState({ isDragging: true, target: dancerId });
        setSelectedDancerIds([dancerId]);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartPos.current.x;
    const deltaY = touch.clientY - dragStartPos.current.y;
    
    // TODO: 既存のドラッグロジックを呼ぶ
    // moveDrag(touch.clientX, touch.clientY);
    
    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    setDragState({ isDragging: false, target: null });
    
    // 🚀 スワイプでキュー移動
    const endX = e.changedTouches[0].clientX;
    const diff = endX - swipeStartX.current;
    
    if (Math.abs(diff) > 80) {
      if (diff > 0) {
        // prevCue();
        console.log("👈 Swipe left - Previous cue");
      } else {
        // nextCue();
        console.log("👉 Swipe right - Next cue");
      }
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 70, // BottomNav分
        overflow: "hidden",
        touchAction: "none" // スクロール競合解消
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <StageBoard
        project={project}
        selectedCueId={selectedCueId}
        // TODO: 他のpropsは後で接続
      />
    </div>
  );
}

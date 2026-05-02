import { useRef, useState } from "react";
import { useEditorStore } from "../store/useEditorStore";

export function MobileStage() {
  const project = useEditorStore((state: any) => state.project);
  const selectedCueId = useEditorStore((state: any) => state.selectedCueId);
  const setSelectedDancerIds = useEditorStore((state: any) => state.setSelectedDancerIds);
  const setDragState = useEditorStore((state: any) => state.setDragState);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const swipeStartX = useRef(0);

  const selectedCue = project?.cues.find((c: any) => c.id === selectedCueId);
  const formation = project?.formations.find((f: any) => f.id === selectedCue?.formationId);

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
        // 🚀 振動フィードバック
        navigator.vibrate?.(10);
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
        navigator.vibrate?.(15);
      } else {
        // nextCue();
        console.log("👉 Swipe right - Next cue");
        navigator.vibrate?.(15);
      }
    }
  };

  // 🚀 簡易ステージ表示（StageBoardが複雑なため）
  const renderSimpleStage = () => {
    if (!formation) {
      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#94a3b8",
          fontSize: 18
        }}>
          No formation selected
        </div>
      );
    }

    return (
      <div style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "linear-gradient(45deg, #1e293b 25%, #334155 25%, #334155 50%, #1e293b 50%, #1e293b 75%, #334155 75%, #334155)",
        backgroundSize: "40px 40px",
        borderRadius: 12
      }}>
        {formation.dancers.map((dancer: any, index: number) => (
          <div
            key={dancer.id}
            data-dancer-id={dancer.id}
            style={{
              position: "absolute",
              left: `${dancer.x * 50 + 50}%`,
              top: `${dancer.y * 50 + 50}%`,
              transform: "translate(-50%, -50%)",
              width: 48,
              height: 48,
              background: selectedCueId ? "#4f46e5" : "#0891b2",
              border: "3px solid #f1f5f9",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 20,
              fontWeight: "bold",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            {index + 1}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 80, // BottomNav分（拡大）
        overflow: "hidden",
        touchAction: "none", // スクロール競合解消
        background: "#0f172a", // より明るい背景
        padding: 16, // 余白を追加
        boxSizing: "border-box"
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{
        width: "100%",
        height: "100%",
        background: "#1e293b",
        borderRadius: 16,
        border: "2px solid #475569",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        overflow: "hidden",
        position: "relative"
      }}>
        {/* ヘッダー情報 */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          background: "rgba(15,23,42,0.9)",
          backdropFilter: "blur(10px)",
          padding: "12px 16px",
          borderBottom: "1px solid #475569",
          zIndex: 10
        }}>
          <div style={{
            color: "#f1f5f9",
            fontSize: 16,
            fontWeight: 600
          }}>
            {selectedCue?.name || "No Cue Selected"}
          </div>
          <div style={{
            color: "#94a3b8",
            fontSize: 12,
            marginTop: 2
          }}>
            {formation?.dancers.length || 0} dancers
          </div>
        </div>

        {/* ステージエリア */}
        <div style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16
        }}>
          {renderSimpleStage()}
        </div>
      </div>
    </div>
  );
}

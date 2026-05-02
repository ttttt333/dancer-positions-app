import { useRef } from "react";
import { useEditorStore } from "../store/useEditorStore";

export function MobileStage() {
  const startX = useRef(0);
  const project = useEditorStore((state: any) => state.project);
  const selectedCueId = useEditorStore((state: any) => state.selectedCueId);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - startX.current;

    if (Math.abs(diff) > 80) {
      if (diff > 0) {
        console.log("← 前のキュー");
        navigator.vibrate?.(15);
      } else {
        console.log("→ 次のキュー");
        navigator.vibrate?.(15);
      }
    }
  };

  // 簡易ステージ表示
  const selectedCue = project?.cues.find((c: any) => c.id === selectedCueId);
  const formation = project?.formations.find((f: any) => f.id === selectedCue?.formationId);

  const renderStage = () => {
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
        width: "100%",
        height: "100%",
        background: "linear-gradient(45deg, #1e293b 25%, #334155 25%, #334155 50%, #1e293b 50%, #1e293b 75%, #334155 75%, #334155)",
        backgroundSize: "40px 40px",
        position: "relative"
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
      style={styles.stage}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 👇 ここに既存のStageBoardView入れる */}
      {renderStage()}
    </div>
  );
}

const styles = {
  stage: {
    width: "100%",
    height: "100%",
  },
};

// src/components/mobile/MobileStage.tsx
import { useRef, useCallback } from "react";
import { useEditorStore } from "../../store/useEditorStore";

const DANCER_COLORS = [
  "#6C63FF", "#F59E0B", "#10B981", "#EF4444",
  "#38BDF8", "#F472B6", "#A78BFA", "#34D399",
];

export function MobileStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dancerId: string | null; offsetX: number; offsetY: number }>({
    dancerId: null, offsetX: 0, offsetY: 0,
  });
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const isDragging = useRef(false);

  const project = useEditorStore((s: any) => s.project);
  const selectedCueId = useEditorStore((s: any) => s.selectedCueId);
  const updateDancerPosition = useEditorStore((s: any) => s.updateDancerPosition);
  const selectCue = useEditorStore((s: any) => s.selectCue);

  const cues = project?.cues ?? [];
  const selectedCue = cues.find((c: any) => c.id === selectedCueId);
  const formation = project?.formations?.find((f: any) => f.id === selectedCue?.formationId);
  const dancers = formation?.dancers ?? [];

  // ── タッチ開始 ────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    swipeStartX.current = touch.clientX;
    swipeStartY.current = touch.clientY;
    isDragging.current = false;

    // ダンサーをタップしたか判定
    const target = e.target as HTMLElement;
    const dancerId = target.closest("[data-dancer-id]")?.getAttribute("data-dancer-id");

    if (dancerId && stageRef.current) {
      isDragging.current = true;
      dragRef.current.dancerId = dancerId;
      e.stopPropagation();

      const rect = stageRef.current.getBoundingClientRect();
      const dancer = dancers.find((d: any) => d.id === dancerId);
      if (dancer) {
        const dancerX = (dancer.x * 0.5 + 0.5) * rect.width;
        const dancerY = (dancer.y * 0.5 + 0.5) * rect.height;
        dragRef.current.offsetX = touch.clientX - rect.left - dancerX;
        dragRef.current.offsetY = touch.clientY - rect.top  - dancerY;
      }
    }
  }, [dancers]);

  // ── タッチ移動 ────────────────────────────────────────────
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.dancerId || !stageRef.current) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = stageRef.current.getBoundingClientRect();

    const rawX = (touch.clientX - rect.left - dragRef.current.offsetX) / rect.width;
    const rawY = (touch.clientY - rect.top  - dragRef.current.offsetY) / rect.height;

    // -1〜1 の範囲にクランプ
    const x = Math.max(-1, Math.min(1, (rawX - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, (rawY - 0.5) * 2));

    updateDancerPosition?.(dragRef.current.dancerId, x, y);
  }, [updateDancerPosition]);

  // ── タッチ終了（スワイプ判定） ────────────────────────────
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];

    if (dragRef.current.dancerId) {
      // ダンサーをドラッグしていた場合はスワイプ判定しない
      dragRef.current.dancerId = null;
      navigator.vibrate?.(10);
      return;
    }

    const dx = touch.clientX - swipeStartX.current;
    const dy = touch.clientY - swipeStartY.current;

    // 横スワイプ（縦移動が少ない場合のみ）
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
      const currentIndex = cues.findIndex((c: any) => c.id === selectedCueId);
      if (dx < 0 && currentIndex < cues.length - 1) {
        selectCue?.(cues[currentIndex + 1].id);
        navigator.vibrate?.(15);
      } else if (dx > 0 && currentIndex > 0) {
        selectCue?.(cues[currentIndex - 1].id);
        navigator.vibrate?.(15);
      }
    }
  }, [cues, selectedCueId, selectCue]);

  return (
    <div
      ref={stageRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#080A0D",
        touchAction: "none",
        overflow: "hidden",
      }}
    >
      {/* グリッドライン */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        preserveAspectRatio="none"
      >
        {/* 縦線 */}
        {[25, 50, 75].map(p => (
          <line key={`v${p}`} x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%"
            stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
        ))}
        {/* 横線 */}
        {[33, 66].map(p => (
          <line key={`h${p}`} x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
        ))}
        {/* センターライン（紫） */}
        <line x1="50%" y1="0" x2="50%" y2="100%"
          stroke="rgba(108,99,255,0.15)" strokeWidth="1" strokeDasharray="4 4"/>
        {/* ステージ前ライン */}
        <line x1="5%" y1="90%" x2="95%" y2="90%"
          stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
        <text x="50%" y="95%" textAnchor="middle"
          fill="rgba(255,255,255,0.15)" fontSize="11" fontFamily="monospace">
          STAGE FRONT
        </text>
      </svg>

      {/* フォーメーションなし */}
      {dancers.length === 0 && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 8, color: "#3A3F4D",
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke="#3A3F4D" strokeWidth="1.5" strokeDasharray="4 3"/>
            <circle cx="20" cy="15" r="5" stroke="#3A3F4D" strokeWidth="1.5"/>
            <path d="M10 32c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="#3A3F4D" strokeWidth="1.5"/>
          </svg>
          <span style={{ fontSize: 13, fontFamily: "monospace" }}>フォーメーションなし</span>
          <span style={{ fontSize: 11, color: "#2C2C2A" }}>左右スワイプでシーンを切替</span>
        </div>
      )}

      {/* ダンサードット */}
      {dancers.map((dancer: any, index: number) => {
        const color = dancer.color ?? DANCER_COLORS[index % DANCER_COLORS.length];
        const label = dancer.label ?? dancer.name?.slice(0, 2) ?? String(index + 1);

        return (
          <div
            key={dancer.id}
            data-dancer-id={dancer.id}
            style={{
              position: "absolute",
              left: `${dancer.x * 50 + 50}%`,
              top:  `${dancer.y * 50 + 50}%`,
              transform: "translate(-50%, -50%)",
              width: 48,
              height: 48,
              background: color,
              border: "2px solid rgba(255,255,255,0.3)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "monospace",
              boxShadow: `0 0 0 4px ${color}30, 0 4px 12px rgba(0,0,0,0.4)`,
              cursor: "grab",
              userSelect: "none",
              touchAction: "none",
              transition: "box-shadow 0.15s ease",
              zIndex: 10,
            }}
          >
            {label}
          </div>
        );
      })}

      {/* スワイプヒント（ダンサーなし時のみ非表示） */}
      {dancers.length > 0 && (
        <div style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10,
          color: "rgba(255,255,255,0.15)",
          fontFamily: "monospace",
          letterSpacing: "0.08em",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          ← スワイプでシーン切替 →
        </div>
      )}
    </div>
  );
}

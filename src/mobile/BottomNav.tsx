import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

export function BottomNav({ onOpenTimeline }: { onOpenTimeline: () => void }) {
  const { isPlaying, setIsPlaying } = usePlaybackUiStore();

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: 80,
      background: "#1e293b",
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      borderTop: "2px solid #475569",
      zIndex: 100,
      paddingBottom: "env(safe-area-inset-bottom, 0)"
    }}>
      <button 
        onClick={() => {/* TODO: prev */}}
        style={{
          fontSize: 28,
          padding: 16,
          minWidth: 60,
          height: 60,
          background: "#334155",
          color: "#f1f5f9",
          border: "none",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
        }}
      >
        ⏮
      </button>

      {!isPlaying ? (
        <button 
          onClick={() => setIsPlaying(true)}
          style={{
            fontSize: 32,
            padding: 20,
            minWidth: 72,
            height: 72,
            background: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(79,70,229,0.4)"
          }}
        >
          ▶
        </button>
      ) : (
        <button 
          onClick={() => setIsPlaying(false)}
          style={{
            fontSize: 32,
            padding: 20,
            minWidth: 72,
            height: 72,
            background: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(239,68,68,0.4)"
          }}
        >
          ⏸
        </button>
      )}

      <button 
        onClick={() => {/* TODO: next */}}
        style={{
          fontSize: 28,
          padding: 16,
          minWidth: 60,
          height: 60,
          background: "#334155",
          color: "#f1f5f9",
          border: "none",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
        }}
      >
        ⏭
      </button>

      <button 
        onClick={onOpenTimeline}
        style={{
          fontSize: 28,
          padding: 16,
          minWidth: 60,
          height: 60,
          background: "#0891b2",
          color: "white",
          border: "none",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(8,145,178,0.4)"
        }}
      >
        🎵
      </button>
    </div>
  );
}

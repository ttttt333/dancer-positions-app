import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

export function BottomNav({ onOpenTimeline }: { onOpenTimeline: () => void }) {
  const { isPlaying, play, pause } = usePlaybackUiStore();

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: 70,
      background: "#0f172a",
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      borderTop: "1px solid #334155",
      zIndex: 100
    }}>
      <button 
        onClick={() => {/* TODO: prev */}}
        style={{ fontSize: 20, padding: 10 }}
      >
        ⏮
      </button>

      {!isPlaying ? (
        <button 
          onClick={play}
          style={{ fontSize: 20, padding: 10 }}
        >
          ▶
        </button>
      ) : (
        <button 
          onClick={pause}
          style={{ fontSize: 20, padding: 10 }}
        >
          ⏸
        </button>
      )}

      <button 
        onClick={() => {/* TODO: next */}}
        style={{ fontSize: 20, padding: 10 }}
      >
        ⏭
      </button>

      <button 
        onClick={onOpenTimeline}
        style={{ fontSize: 20, padding: 10 }}
      >
        🎵
      </button>
    </div>
  );
}

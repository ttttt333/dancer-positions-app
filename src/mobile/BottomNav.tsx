export function BottomNav({
  isPlaying,
  onPlay,
  onPause,
  onOpenTimeline,
}: any) {
  return (
    <div style={styles.nav}>
      <button onClick={() => console.log("prev")} style={styles.btn}>⏮</button>

      <button
        onClick={isPlaying ? onPause : onPlay}
        style={styles.play}
      >
        {isPlaying ? "⏸" : "▶︎"}
      </button>

      <button onClick={() => console.log("next")} style={styles.btn}>⏭</button>

      <button onClick={onOpenTimeline} style={styles.btn}>☰</button>
    </div>
  );
}

const styles = {
  nav: {
    height: 70,
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    background: "#111827",
    borderTop: "1px solid #333",
  },
  btn: {
    fontSize: 22,
    padding: 10,
  },
  play: {
    fontSize: 28,
    padding: 12,
    borderRadius: 50,
    background: "#4f46e5",
    color: "#fff",
  },
};

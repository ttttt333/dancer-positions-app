import type { RealtimePeer } from "../hooks/useSupabaseProjectRealtime";
import { shell } from "../theme/choreoShell";

const PEER_COLORS = ["#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#c084fc", "#facc15"];

/** 同じ作品を同時に開いている他のアカウント */
export function EditorRealtimePeersBadge({ peers }: { peers: RealtimePeer[] }) {
  if (peers.length === 0) return null;
  const names = peers.map((p) => p.name || "ゲスト");
  return (
    <div
      role="status"
      data-realtime-peers={peers.length}
      title={`同時編集中: ${names.join("、")}`}
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px 5px 6px",
        borderRadius: 999,
        background: "rgba(10, 9, 8, 0.88)",
        border: `1px solid ${shell.borderStrong}`,
        color: shell.text,
        fontSize: 11,
        pointerEvents: "auto",
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
      }}
    >
      <span style={{ display: "flex" }}>
        {peers.slice(0, 4).map((p, i) => (
          <span
            key={p.clientId}
            aria-hidden
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              marginLeft: i === 0 ? 0 : -6,
              background: PEER_COLORS[i % PEER_COLORS.length],
              color: "#0b0b0b",
              fontWeight: 700,
              fontSize: 10,
              display: "grid",
              placeItems: "center",
              border: "2px solid #0a0908",
            }}
          >
            {(names[i] ?? "?").slice(0, 1).toUpperCase()}
          </span>
        ))}
      </span>
      <span style={{ whiteSpace: "nowrap" }}>
        {peers.length === 1 ? `${names[0]} と同時編集中` : `${peers.length}人と同時編集中`}
      </span>
    </div>
  );
}

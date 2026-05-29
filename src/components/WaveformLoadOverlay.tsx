import { useWaveformLoadProgressStore } from "../store/waveformLoadProgressStore";

type Props = {
  /** 波形ピークがまだ無いときだけ表示 */
  visible: boolean;
  className?: string;
  compact?: boolean;
};

/**
 * 波形キャンバス上の読み込みオーバーレイ（メッセージ + ％表示）
 */
export function WaveformLoadOverlay({ visible, className, compact = false }: Props) {
  const progress = useWaveformLoadProgressStore((s) => s.progress);
  if (!visible) return null;

  const ratio = progress?.ratio ?? 0;
  const pct = Math.round(ratio * 100);
  const isError = progress?.error === true;
  const message =
    progress?.message ?? (isError ? "読み込みに失敗しました" : "波形を読み込み中…");

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 6 : 8,
        padding: compact ? "8px 10px" : "12px 16px",
        background: isError ? "rgba(69, 10, 10, 0.88)" : "rgba(2, 6, 23, 0.82)",
        color: isError ? "#fecaca" : "#cbd5e1",
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 3,
      }}
      aria-live="polite"
      aria-busy={!isError}
    >
      <span>{message}</span>
      {!isError ? (
        <>
          <span style={{ fontVariantNumeric: "tabular-nums", color: "#fbbf24" }}>{pct}%</span>
          <div
            style={{
              width: compact ? "min(160px, 72%)" : "min(220px, 70%)",
              height: compact ? 4 : 5,
              borderRadius: 999,
              background: "rgba(51, 65, 85, 0.85)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(4, pct)}%`,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
                transition: "width 0.15s ease-out",
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

type Props = {
  open: boolean;
  sectionCount: number;
  onConfirm: () => void;
  onCancel: () => void;
};

/** AI セクション頭キーフレーム適用の確認ダイアログ */
export function ApplyAiSectionKeyframesDialog({
  open,
  sectionCount,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-kf-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(2, 6, 23, 0.72)",
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          borderRadius: 12,
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#e2e8f0",
          padding: "18px 18px 14px",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="ai-kf-title"
          style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}
        >
          AIセクションからキーフレームを配置
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.55, color: "#94a3b8" }}>
          現在のキュー（{sectionCount > 0 ? `解析セクション ${sectionCount} 本分` : "セクション"}）を、
          AIが検出したイントロ／Aメロ／サビなどの頭（ダウンビート）に合わせ直します。
          既存のキーフレームは置き換わります。
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              borderRadius: 8,
              border: "1px solid #475569",
              background: "transparent",
              color: "#cbd5e1",
              padding: "8px 12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              borderRadius: 8,
              border: "1px solid #f59e0b",
              background: "linear-gradient(180deg, #f59e0b, #d97706)",
              color: "#0f172a",
              padding: "8px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            配置する
          </button>
        </div>
      </div>
    </div>
  );
}

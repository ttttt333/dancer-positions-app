import { useCallback, useEffect, useRef, useState } from "react";
import { btnSecondary } from "./stageButtonStyles";
import {
  buildCommitFromRows,
  readImageNaturalSize,
  runImageSpotOcr,
  type ImageSpotImportCommit,
  type OcrSpotRow,
} from "../lib/imageSpotImport";

type Props = {
  open: boolean;
  onClose: () => void;
  disabled: boolean;
  onCommit: (payload: ImageSpotImportCommit) => void;
};

export function ImageSpotImportDialog({
  open,
  onClose,
  disabled,
  onCommit,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crewName, setCrewName] = useState("画像取込");
  const [rows, setRows] = useState<OcrSpotRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setFile(null);
    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setCrewName("画像取込");
    setRows([]);
    setBusy(false);
    setProgress(0);
    setError(null);
    setDims(null);
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const onPickFile = useCallback(
    async (f: File | null) => {
      if (!f || !f.type.startsWith("image/")) {
        setError("画像ファイル（PNG / JPEG / WebP など）を選んでください。");
        return;
      }
      setError(null);
      setRows([]);
      setFile(f);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(f);
      });
      try {
        const d = await readImageNaturalSize(f);
        setDims(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : "画像を開けませんでした。");
      }
    },
    []
  );

  const runOcr = useCallback(async () => {
    if (!file || disabled) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const { rows: next } = await runImageSpotOcr(file, {
        onProgress: (r) => setProgress(r),
      });
      setRows(next);
      if (next.length === 0) {
        setError(
          "読み取れた文字がありません。印刷に近い画像・はっきりした文字で再度お試しください。"
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "文字認識に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [file, disabled]);

  const toggleRow = useCallback((rowId: string) => {
    setRows((rs) =>
      rs.map((r) => (r.rowId === rowId ? { ...r, selected: !r.selected } : r))
    );
  }, []);

  const updateRow = useCallback((rowId: string, patch: Partial<OcrSpotRow>) => {
    setRows((rs) => rs.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }, []);

  const handleCommit = useCallback(() => {
    const c = buildCommitFromRows(crewName, rows);
    if (!c) {
      setError("取り込む行を 1 行以上選び、名前を入れてください。");
      return;
    }
    onCommit(c);
    onClose();
  }, [crewName, rows, onCommit, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 65,
        background: "rgba(15, 23, 42, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-spot-import-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "720px",
          maxHeight: "min(92vh, 760px)",
          overflow: "auto",
          background: "#0f172a",
          borderRadius: "12px",
          border: "1px solid #334155",
          padding: "16px 18px 18px",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <h3
            id="image-spot-import-title"
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            画像から立ち位置を読み込む
          </h3>
          <button
            type="button"
            aria-label="閉じる"
            disabled={busy}
            onClick={() => !busy && onClose()}
            style={{
              ...btnSecondary,
              fontSize: "18px",
              lineHeight: 1,
              padding: "4px 12px",
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            margin: "0 0 12px",
            fontSize: "11px",
            color: "#64748b",
            lineHeight: 1.55,
          }}
        >
          画像内の文字の位置を立ち位置（%）にし、名前は新しい名簿として追加します。アプリ側では小さい画像の拡大・グレースケール・コントラスト調整のうえで OCR
          します。精度を上げるには、
          <strong style={{ color: "#94a3b8" }}>解像度の高い原稿</strong>、
          <strong style={{ color: "#94a3b8" }}>まっすぐ正面からの撮影</strong>、
          <strong style={{ color: "#94a3b8" }}>影の少ない均一な明るさ</strong>、
          <strong style={{ color: "#94a3b8" }}>背景とのコントラストがはっきりした文字</strong>
          が有効です。手書きより印刷・PDF
          出力に近いほど読みやすくなります。初回は言語データのダウンロードがあり数十秒かかることがあります。
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onPickFile(f);
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => fileInputRef.current?.click()}
            style={{
              ...btnSecondary,
              padding: "6px 12px",
              fontSize: "12px",
            }}
          >
            画像を選ぶ
          </button>
          <button
            type="button"
            disabled={disabled || busy || !file}
            onClick={() => void runOcr()}
            style={{
              ...btnSecondary,
              padding: "6px 12px",
              fontSize: "12px",
              borderColor: "#1e3a8a",
              color: "#bfdbfe",
            }}
          >
            {busy ? `読み取り中… ${Math.round(progress * 100)}%` : "文字を読み取り"}
          </button>
        </div>

        {previewUrl ? (
          <div
            style={{
              marginBottom: "12px",
              borderRadius: "8px",
              border: "1px solid #1e293b",
              overflow: "hidden",
              background: "#020617",
              maxHeight: "220px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={previewUrl}
              alt="取り込みプレビュー"
              style={{
                maxWidth: "100%",
                maxHeight: "220px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        ) : null}
        {dims ? (
          <p style={{ margin: "0 0 10px", fontSize: "10px", color: "#475569" }}>
            画像サイズ {dims.w} × {dims.h} px（座標はこの範囲に対する割合でステージに載せます）
          </p>
        ) : null}

        <label
          style={{
            display: "block",
            marginBottom: "10px",
            fontSize: "12px",
            color: "#94a3b8",
          }}
        >
          追加する名簿の名前
          <input
            type="text"
            value={crewName}
            disabled={disabled || busy}
            onChange={(e) => setCrewName(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: "4px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#020617",
              color: "#e2e8f0",
              fontSize: "13px",
            }}
          />
        </label>

        {error ? (
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#fca5a5" }}>{error}</p>
        ) : null}

        {rows.length > 0 ? (
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              候補（チェックした行だけ名簿＋ステージに追加）
            </div>
            <div
              style={{
                maxHeight: "240px",
                overflowY: "auto",
                border: "1px solid #1e293b",
                borderRadius: "8px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "11px",
                  color: "#cbd5e1",
                }}
              >
                <thead>
                  <tr style={{ background: "#020617", textAlign: "left" }}>
                    <th style={{ padding: "6px", width: "36px" }} />
                    <th style={{ padding: "6px" }}>名前</th>
                    <th style={{ padding: "6px", width: "56px" }}>X%</th>
                    <th style={{ padding: "6px", width: "56px" }}>Y%</th>
                    <th style={{ padding: "6px", width: "52px" }}>信頼度</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowId} style={{ borderTop: "1px solid #1e293b" }}>
                      <td style={{ padding: "4px 6px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={r.selected}
                          disabled={disabled || busy}
                          onChange={() => toggleRow(r.rowId)}
                          aria-label={`${r.label} を取り込む`}
                        />
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <input
                          type="text"
                          value={r.label}
                          disabled={disabled || busy}
                          onChange={(e) =>
                            updateRow(r.rowId, { label: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "4px 6px",
                            borderRadius: "4px",
                            border: "1px solid #334155",
                            background: "#0f172a",
                            color: "#e2e8f0",
                            fontSize: "11px",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <input
                          type="number"
                          step={0.5}
                          value={Math.round(r.xPct * 10) / 10}
                          disabled={disabled || busy}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (Number.isFinite(v))
                              updateRow(r.rowId, { xPct: v });
                          }}
                          style={{
                            width: "100%",
                            padding: "4px",
                            borderRadius: "4px",
                            border: "1px solid #334155",
                            background: "#0f172a",
                            color: "#e2e8f0",
                            fontSize: "11px",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <input
                          type="number"
                          step={0.5}
                          value={Math.round(r.yPct * 10) / 10}
                          disabled={disabled || busy}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (Number.isFinite(v))
                              updateRow(r.rowId, { yPct: v });
                          }}
                          style={{
                            width: "100%",
                            padding: "4px",
                            borderRadius: "4px",
                            border: "1px solid #334155",
                            background: "#0f172a",
                            color: "#e2e8f0",
                            fontSize: "11px",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 6px", color: "#64748b" }}>
                        {Math.round(r.confidence)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onClose()}
            style={{ ...btnSecondary, padding: "6px 14px", fontSize: "12px" }}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={disabled || busy || rows.filter((r) => r.selected).length === 0}
            onClick={handleCommit}
            style={{
              ...btnSecondary,
              padding: "6px 14px",
              fontSize: "12px",
              borderColor: "#14532d",
              background: "#166534",
              color: "#ecfccb",
              fontWeight: 600,
            }}
          >
            名簿に追加してステージへ配置
          </button>
        </div>
      </div>
    </div>
  );
}

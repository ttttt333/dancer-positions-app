import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { applyParsedPositionsAsCue } from "../lib/applyParsedPositionsAsCue";
import type { ParsedPosition } from "../lib/parsePositionTypes";
import { usePositionParser } from "../hooks/usePositionParser";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  currentTimeSec: number;
  durationSec: number;
  onCueCreated?: (cueId: string, startSec: number) => void;
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9200,
  background: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))",
};

const dialog: CSSProperties = {
  width: "min(520px, calc(100vw - 32px))",
  maxHeight: "min(640px, calc(100dvh - 48px))",
  background: shell.bgDeep,
  border: `1px solid ${shell.border}`,
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
};

function formatSec(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00.0";
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
}

function PositionPreviewThumb({ positions }: { positions: ParsedPosition[] }) {
  return (
    <svg
      viewBox="0 0 100 60"
      width="100%"
      height={120}
      aria-hidden
      style={{
        display: "block",
        background: "#0a0f1e",
        borderRadius: 8,
        border: "1px solid #334155",
      }}
    >
      <rect x="0" y="48" width="100" height="12" fill="#94a3b8" fillOpacity={0.12} rx="2" />
      {positions.map((p, i) => (
        <g key={`${p.name}-${i}`}>
          <circle
            cx={Math.max(4, Math.min(96, p.x))}
            cy={2 + (Math.max(0, Math.min(100, p.y)) / 100) * 56}
            r={3.2}
            fill="#d4af37"
            fillOpacity={0.95}
          />
        </g>
      ))}
    </svg>
  );
}

export function ParsePositionFromPhotoDialog({
  open,
  onClose,
  project,
  setProject,
  currentTimeSec,
  durationSec,
  onCueCreated,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loading, error, clearError, parseImageFile } = usePositionParser();
  const [preview, setPreview] = useState<ParsedPosition[] | null>(null);
  const [formationName, setFormationName] = useState("写真から取込");
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setPreview(null);
    setFormationName("写真から取込");
    setSourceFileName(null);
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const handlePickClick = () => {
    if (loading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSourceFileName(file.name);
    const result = await parseImageFile(file);
    if (result?.positions.length) {
      setPreview(result.positions);
    }
  };

  const handleConfirm = () => {
    if (!preview?.length) return;
    if (project.cues.length >= 100) {
      window.alert("キューは最大 100 件までです。");
      return;
    }
    let appliedCueId: string | null = null;
    let appliedStart = currentTimeSec;
    setProject((p) => {
      const applied = applyParsedPositionsAsCue(p, {
        positions: preview,
        tStartSec: currentTimeSec,
        durationSec,
        formationName,
      });
      if (!applied) {
        window.alert("キューを追加できませんでした。");
        return p;
      }
      appliedCueId = applied.result.cueId;
      appliedStart = applied.result.tStartSec;
      return applied.project;
    });
    if (appliedCueId) {
      onCueCreated?.(appliedCueId, appliedStart);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="parse-position-photo-title"
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: `1px solid ${shell.border}`,
          }}
        >
          <h2
            id="parse-position-photo-title"
            style={{ margin: 0, fontSize: 16, fontWeight: 700, color: shell.text }}
          >
            写真から立ち位置を取込
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            disabled={loading}
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: shell.textMuted,
              fontSize: 20,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {!preview ? (
            <>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: shell.textMuted, lineHeight: 1.5 }}>
                立ち位置図や方眼紙の手書き名簿の写真をアップロードすると、AI が名前と座標（0〜100%）を読み取ります。
                結果を確認してからキューとして追加できます。
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                style={{ display: "none" }}
                onChange={(e) => void handleFileChange(e)}
              />
              <button
                type="button"
                onClick={handlePickClick}
                disabled={loading || project.viewMode === "view"}
                style={{
                  ...btnAccent,
                  width: "100%",
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "画像を解析中…" : "画像を選ぶ"}
              </button>
              {loading ? (
                <p
                  role="status"
                  style={{
                    margin: "12px 0 0",
                    fontSize: 12,
                    color: "#93c5fd",
                    textAlign: "center",
                  }}
                >
                  OpenAI で立ち位置を読み取っています。数十秒かかることがあります…
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: shell.textMuted }}>
                {sourceFileName ? `ファイル: ${sourceFileName}` : null}
                {" · "}
                キュー開始: {formatSec(currentTimeSec)} · {preview.length} 人
              </p>
              <PositionPreviewThumb positions={preview} />
              <label
                style={{
                  display: "block",
                  marginTop: 12,
                  fontSize: 12,
                  color: shell.textMuted,
                }}
              >
                フォーメーション名
                <input
                  type="text"
                  value={formationName}
                  onChange={(e) => setFormationName(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #334155",
                    background: "#0a0f1e",
                    color: shell.text,
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </label>
              <div
                style={{
                  marginTop: 12,
                  maxHeight: 220,
                  overflow: "auto",
                  border: "1px solid #334155",
                  borderRadius: 8,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#0f172a", color: "#94a3b8" }}>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>#</th>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>名前</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>X%</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Y%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p, i) => (
                      <tr key={`${p.name}-${i}`} style={{ borderTop: "1px solid #1e293b" }}>
                        <td style={{ padding: "6px 10px", color: "#64748b" }}>{i + 1}</td>
                        <td style={{ padding: "6px 10px", color: shell.text }}>{p.name}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{p.x.toFixed(1)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{p.y.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error ? (
            <p
              role="alert"
              style={{
                margin: "12px 0 0",
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#fecaca",
                fontSize: 12,
                lineHeight: 1.45,
                whiteSpace: "pre-line",
              }}
            >
              {error}
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "12px 20px 16px",
            borderTop: `1px solid ${shell.border}`,
          }}
        >
          {preview ? (
            <>
              <button
                type="button"
                style={btnSecondary}
                disabled={loading}
                onClick={() => {
                  resetState();
                }}
              >
                別の画像
              </button>
              <button
                type="button"
                style={btnAccent}
                disabled={loading}
                onClick={handleConfirm}
              >
                確定してキューに追加
              </button>
            </>
          ) : (
            <button type="button" style={btnSecondary} disabled={loading} onClick={onClose}>
              キャンセル
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

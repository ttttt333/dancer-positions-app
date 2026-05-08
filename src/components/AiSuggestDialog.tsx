/**
 * AiSuggestDialog.tsx — AI提案ダイアログ
 * 楽曲解析 → Claude API → フォーメーション自動生成
 */

import { useEffect, useCallback, type CSSProperties } from "react";
import { shell } from "../theme/choreoShell";
import { useAiFormationSuggest } from "../hooks/useAiFormationSuggest";
import type { ChoreographyProjectJson } from "../types/choreography";

interface AiSuggestDialogProps {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  peaks: number[] | null;
  durationSec: number;
  onClose: () => void;
}

/* ─── Styles ─── */
const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9000,
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dialog: CSSProperties = {
  width: "min(520px, calc(100vw - 32px))",
  maxHeight: "min(680px, calc(100vh - 48px))",
  background: shell.bgDeep,
  border: `1px solid ${shell.border}`,
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  borderBottom: `1px solid ${shell.border}`,
  flexShrink: 0,
};

const body: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "16px 20px",
};

const btnClose: CSSProperties = {
  background: "none",
  border: "none",
  color: shell.textMuted,
  fontSize: 20,
  cursor: "pointer",
  padding: "2px 8px",
  borderRadius: 6,
};

const btnPrimary: CSSProperties = {
  padding: "10px 24px",
  borderRadius: 10,
  border: "none",
  background: "#6366f1",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  transition: "background 0.2s",
};

const btnSecondary: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: `1px solid ${shell.border}`,
  background: "rgba(255,255,255,0.04)",
  color: shell.textMuted,
  fontSize: 12,
  cursor: "pointer",
};

const sectionBox: CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: `1px solid ${shell.border}`,
  borderRadius: 10,
  padding: "10px 14px",
  marginBottom: 10,
};

/* ─── Spinner ─── */
function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 0" }}>
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(99,102,241,0.2)",
          borderTop: "3px solid #6366f1",
          borderRadius: "50%",
          animation: "ai-spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes ai-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Main ─── */
export function AiSuggestDialog({
  project,
  setProject,
  peaks,
  durationSec,
  onClose,
}: AiSuggestDialogProps) {
  const { status, result, error, suggest, reset } = useAiFormationSuggest(project);

  // 自動開始
  useEffect(() => {
    if (peaks && peaks.length > 0 && durationSec > 0 && status === "idle") {
      suggest(peaks, durationSec);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = useCallback(() => {
    if (!result) return;
    const confirmed = window.confirm(
      "AI提案を適用します。\n既存のキュー（タイムライン）は上書きされます。\n元に戻す（Ctrl+Z）で戻せます。\n\n適用しますか？"
    );
    if (!confirmed) return;

    setProject((prev) => {
      // 既存フォーメーションのうち AI提案と id が被らないものを保持
      const existingFormations = prev.formations.filter(
        (f) => !result.formations.some((rf) => rf.id === f.id)
      );
      return {
        ...prev,
        formations: [...existingFormations, ...result.formations],
        cues: result.cues,
        activeFormationId: result.formations[0]?.id ?? prev.activeFormationId,
      };
    });
    onClose();
  }, [result, setProject, onClose]);

  const handleRetry = useCallback(() => {
    reset();
    if (peaks && peaks.length > 0 && durationSec > 0) {
      suggest(peaks, durationSec);
    }
  }, [peaks, durationSec, reset, suggest]);

  const noPeaks = !peaks || peaks.length === 0 || durationSec <= 0;

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={dialog}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg viewBox="0 0 32 32" style={{ width: 22, height: 22, filter: "drop-shadow(0 0 4px #e879f960)" }}>
              <path d="M16 4 L18 10 L24 10 L19 14 L21 20 L16 16 L11 20 L13 14 L8 10 L14 10 Z" fill="none" stroke="#e879f9" strokeWidth="1.5" strokeLinejoin="round" />
              <text x="13.5" y="30" fontSize="5" fontWeight="bold" fill="#e879f9" fontFamily="sans-serif" opacity="0.7">AI</text>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
              AI フォーメーション提案
            </span>
          </div>
          <button type="button" style={btnClose} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={body}>
          {/* 音源なし */}
          {noPeaks ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <p style={{ fontSize: 14, color: "#fbbf24", marginBottom: 8 }}>
                ⚠ 楽曲が読み込まれていません
              </p>
              <p style={{ fontSize: 12, color: shell.textMuted }}>
                先にタイムラインに楽曲を取り込んでください。
              </p>
            </div>
          ) : status === "analyzing" ? (
            <div style={{ textAlign: "center" }}>
              <Spinner />
              <p style={{ fontSize: 13, color: "#c084fc" }}>音楽を解析しています…</p>
              <p style={{ fontSize: 11, color: shell.textSubtle, marginTop: 4 }}>
                BPM・セクション・エネルギーを推定中
              </p>
            </div>
          ) : status === "requesting" ? (
            <div style={{ textAlign: "center" }}>
              <Spinner />
              <p style={{ fontSize: 13, color: "#e879f9" }}>Claude がフォーメーションを考えています…</p>
              <p style={{ fontSize: 11, color: shell.textSubtle, marginTop: 4 }}>
                楽曲構造に最適なフォーメーションとキューを生成中
              </p>
            </div>
          ) : status === "error" ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontSize: 14, color: "#f87171", marginBottom: 12 }}>
                エラーが発生しました
              </p>
              <p style={{ fontSize: 12, color: shell.textMuted, marginBottom: 16, whiteSpace: "pre-wrap" }}>
                {error}
              </p>
              <button type="button" style={btnSecondary} onClick={handleRetry}>
                やり直す
              </button>
            </div>
          ) : status === "done" && result ? (
            <div>
              {/* 解析サマリー */}
              <div style={sectionBox}>
                <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>
                  楽曲解析結果
                </p>
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#e2e8f0" }}>
                  <span>
                    <span style={{ color: shell.textSubtle, fontSize: 10 }}>BPM</span>{" "}
                    <strong>{result.analysis.bpm}</strong>
                  </span>
                  <span>
                    <span style={{ color: shell.textSubtle, fontSize: 10 }}>長さ</span>{" "}
                    <strong>{Math.floor(result.analysis.durationSec / 60)}:{String(Math.floor(result.analysis.durationSec % 60)).padStart(2, "0")}</strong>
                  </span>
                  <span>
                    <span style={{ color: shell.textSubtle, fontSize: 10 }}>セクション</span>{" "}
                    <strong>{result.analysis.sections.length}</strong>
                  </span>
                </div>
              </div>

              {/* フォーメーション一覧 */}
              <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>
                提案フォーメーション ({result.formations.length}件)
              </p>
              {result.formations.map((f, idx) => (
                <div key={f.id} style={sectionBox}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6,
                      background: "rgba(99,102,241,0.2)", color: "#818cf8",
                      fontSize: 10, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: 10, color: shell.textSubtle }}>
                      {f.dancers.length}人
                    </span>
                  </div>
                  {/* ミニステージプレビュー */}
                  <div style={{
                    position: "relative",
                    width: "100%",
                    height: 60,
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 6,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    {f.dancers.map((d) => {
                      const colors = ["#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#e879f9", "#94a3b8", "#fcd34d"];
                      return (
                        <div
                          key={d.id}
                          title={d.label}
                          style={{
                            position: "absolute",
                            left: `${d.xPct}%`,
                            top: `${d.yPct}%`,
                            transform: "translate(-50%, -50%)",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: colors[d.colorIndex % colors.length],
                            boxShadow: `0 0 4px ${colors[d.colorIndex % colors.length]}60`,
                          }}
                        />
                      );
                    })}
                    {/* 客席ラベル */}
                    <div style={{
                      position: "absolute",
                      bottom: 2,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 7,
                      color: "rgba(255,255,255,0.2)",
                      letterSpacing: 2,
                    }}>
                      客席
                    </div>
                  </div>
                </div>
              ))}

              {/* 推論理由 */}
              {result.reasoning.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>
                    AIの考え
                  </p>
                  {result.reasoning.map((r, i) => (
                    <p key={i} style={{ fontSize: 11, color: shell.textMuted, marginBottom: 4, lineHeight: 1.5 }}>
                      • {r}
                    </p>
                  ))}
                </div>
              ) : null}

              {/* キュー一覧 */}
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>
                  タイムライン ({result.cues.length}キュー)
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {result.cues.map((c, idx) => (
                    <span key={c.id} style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      fontSize: 10,
                      color: "#a5b4fc",
                    }}>
                      {idx + 1}. {c.name || `キュー${idx + 1}`}
                      <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 4 }}>
                        {Math.floor(c.tStartSec / 60)}:{String(Math.floor(c.tStartSec % 60)).padStart(2, "0")}
                        –{Math.floor(c.tEndSec / 60)}:{String(Math.floor(c.tEndSec % 60)).padStart(2, "0")}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* アクションボタン */}
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button" style={btnSecondary} onClick={handleRetry}>
                  やり直す
                </button>
                <button
                  type="button"
                  style={btnPrimary}
                  onClick={handleApply}
                  onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "#4f46e5"; }}
                  onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "#6366f1"; }}
                >
                  プロジェクトに適用
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default AiSuggestDialog;

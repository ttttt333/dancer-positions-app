import { useCallback, useEffect, useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { useAiFormationSuggest, type SuggestResult } from "../hooks/useAiFormationSuggest";
import { btnPrimary, btnSecondary } from "./stageButtonStyles";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  peaks: number[] | null;
  onClose: () => void;
};

export function AiSuggestDialog({ project, setProject, peaks, onClose }: Props) {
  const durationSec = usePlaybackUiStore((s) => s.durationSec);
  const { status, result, error, suggest, reset } = useAiFormationSuggest(project);
  const hasStarted = useRef(false);

  // 開いた瞬間に自動で解析を開始
  useEffect(() => {
    if (hasStarted.current) return;
    if (!peaks || peaks.length === 0 || !durationSec || durationSec <= 0) return;
    hasStarted.current = true;
    void suggest(peaks, durationSec);
  }, [peaks, durationSec, suggest]);

  const handleApply = useCallback(() => {
    if (!result) return;
    setProject((prev) => {
      // 既存フォーメーションを保持しつつ AI 提案分を追加
      // キューは AI 提案で上書き（タイムラインを再構築）
      const existingFormations = prev.formations.filter(
        (f) => !result.formations.some((rf) => rf.id === f.id)
      );
      return {
        ...prev,
        formations: [...existingFormations, ...result.formations],
        cues: result.cues,
        activeFormationId:
          result.formations[0]?.id ?? prev.activeFormationId,
      };
    });
    onClose();
  }, [result, setProject, onClose]);

  const handleRetry = useCallback(() => {
    if (!peaks || !durationSec) return;
    reset();
    hasStarted.current = false;
    setTimeout(() => {
      hasStarted.current = true;
      void suggest(peaks, durationSec);
    }, 50);
  }, [peaks, durationSec, reset, suggest]);

  const noPeaks = !peaks || peaks.length === 0 || !durationSec || durationSec <= 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AIフォーメーション提案"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(560px, calc(100vw - 24px))",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          borderRadius: "14px",
          border: "1px solid #334155",
          background: "#0f172a",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: "14px 16px 12px",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
              AIフォーメーション提案
            </h2>
          </div>
          <button
            type="button"
            style={{ ...btnSecondary, padding: "4px 10px", fontSize: 12 }}
            onClick={onClose}
          >
            閉じる
          </button>
        </div>

        {/* コンテンツ */}
        <div style={{ padding: "16px", flex: 1 }}>
          {/* 音源なしの警告 */}
          {noPeaks && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "#451a03",
                border: "1px solid #92400e",
                color: "#fcd34d",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              ⚠️ 先に楽曲を読み込んでください。タイムライン下部の「楽曲」から音源を追加できます。
            </div>
          )}

          {/* 解析中 */}
          {(status === "analyzing" || status === "requesting") && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                padding: "32px 0",
              }}
            >
              <Spinner />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
                  {status === "analyzing" ? "音楽を解析しています…" : "Claudeがフォーメーションを考えています…"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {status === "analyzing"
                    ? "BPM・セクション・エネルギーを検出中"
                    : "曲の構造に合わせて立ち位置を設計中"}
                </div>
              </div>
            </div>
          )}

          {/* エラー */}
          {status === "error" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "#450a0a",
                  border: "1px solid #991b1b",
                  color: "#fca5a5",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <strong>エラーが発生しました:</strong>
                <br />
                {error}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" style={btnPrimary} onClick={handleRetry}>
                  やり直す
                </button>
              </div>
            </div>
          )}

          {/* 結果表示 */}
          {status === "done" && result && (
            <ResultView result={result} onApply={handleApply} onRetry={handleRetry} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 結果表示コンポーネント
// ---------------------------------------------------------------------------

function ResultView({
  result,
  onApply,
  onRetry,
}: {
  result: SuggestResult;
  onApply: () => void;
  onRetry: () => void;
}) {
  const { analysis, formations, cues, reasoning } = result;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 解析サマリー */}
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "#0b1220",
          border: "1px solid #1e293b",
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <InfoBadge label="BPM" value={String(analysis.bpm)} />
        <InfoBadge
          label="曲の長さ"
          value={formatSec(analysis.durationSec)}
        />
        <InfoBadge
          label="セクション数"
          value={`${analysis.sections.length}個`}
        />
        <InfoBadge
          label="提案フォーメーション"
          value={`${formations.length}個`}
        />
      </div>

      {/* 警告 */}
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "#1c1917",
          border: "1px solid #44403c",
          fontSize: 12,
          color: "#a8a29e",
          lineHeight: 1.5,
        }}
      >
        ⚠️ 適用すると既存のキュー（タイムライン）はすべて置き換えられます。フォーメーション自体は残ります。
      </div>

      {/* フォーメーション一覧 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#64748b",
            letterSpacing: "0.06em",
            marginBottom: 2,
          }}
        >
          提案内容
        </div>
        {formations.map((f, i) => {
          const cue = cues.find((c) => c.formationId === f.id);
          return (
            <div
              key={f.id}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: "#020617",
                border: "1px solid #1e293b",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#1e3a5f",
                  color: "#7dd3fc",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#e2e8f0",
                    marginBottom: 2,
                  }}
                >
                  {f.name}
                </div>
                {cue && (
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>
                    {formatSec(cue.tStartSec)} 〜 {formatSec(cue.tEndSec)}
                    　{f.dancers.length}人
                  </div>
                )}
                {reasoning[i] && (
                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                    {reasoning[i]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* アクションボタン */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          paddingTop: 4,
          borderTop: "1px solid #1e293b",
          marginTop: 4,
        }}
      >
        <button type="button" style={btnSecondary} onClick={onRetry}>
          やり直す
        </button>
        <button
          type="button"
          style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}
          onClick={onApply}
        >
          <span>✨</span> プロジェクトに適用
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 小コンポーネント
// ---------------------------------------------------------------------------

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{value}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "3px solid #1e293b",
        borderTopColor: "#6366f1",
        animation: "spin 0.8s linear infinite",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

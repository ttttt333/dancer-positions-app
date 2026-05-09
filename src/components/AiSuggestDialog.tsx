/**
 * AiSuggestDialog.tsx — AI提案ダイアログ（v2: 曲情報入力 → 提案生成）
 */

import { useState, useCallback, useRef, type CSSProperties, type ChangeEvent } from "react";
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
  background: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dialog: CSSProperties = {
  width: "min(560px, calc(100vw - 32px))",
  maxHeight: "min(720px, calc(100vh - 48px))",
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

const label: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: shell.textSubtle,
  marginBottom: 6,
  letterSpacing: "0.04em",
};

const textarea: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${shell.border}`,
  borderRadius: 8,
  color: shell.text,
  fontSize: 12,
  padding: "8px 10px",
  resize: "vertical",
  outline: "none",
  fontFamily: "inherit",
  lineHeight: 1.6,
  minHeight: 80,
};

/* ─── 曲のイメージ選択肢 ─── */
const VIBES = [
  { id: "energetic",   label: "⚡ エネルギッシュ",  desc: "激しい・パワフル" },
  { id: "emotional",   label: "💜 エモーショナル",  desc: "感動・叙情的" },
  { id: "cute",        label: "🌸 キュート",        desc: "かわいい・ポップ" },
  { id: "cool",        label: "🌙 クール",          desc: "スタイリッシュ・洗練" },
  { id: "mysterious",  label: "✨ ミステリアス",    desc: "幻想的・神秘的" },
  { id: "upbeat",      label: "🎉 アップビート",    desc: "明るい・楽しい" },
  { id: "serious",     label: "🎭 シリアス",        desc: "重厚・ドラマチック" },
  { id: "romantic",    label: "🌹 ロマンチック",    desc: "甘い・優雅" },
] as const;

type VibeId = (typeof VIBES)[number]["id"];

/* ─── フォーメーションスタイル ─── */
const FORMATION_STYLES = [
  { id: "dynamic",    label: "ダイナミック",  desc: "大きな移動・変化重視" },
  { id: "symmetric",  label: "シンメトリー",  desc: "左右対称・整然" },
  { id: "freestyle",  label: "フリースタイル",desc: "自由・個性的" },
  { id: "wave",       label: "ウェーブ",      desc: "流れるような配置" },
] as const;

type FormationStyleId = (typeof FORMATION_STYLES)[number]["id"];

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

/* ─── Step indicator ─── */
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["曲の情報", "生成中", "結果確認"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
      {steps.map((s, i) => {
        const n = i + 1 as 1 | 2 | 3;
        const active = n === step;
        const done = n < step;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: active ? "#6366f1" : done ? "#4ade80" : "rgba(255,255,255,0.07)",
                border: `2px solid ${active ? "#6366f1" : done ? "#4ade80" : "rgba(255,255,255,0.15)"}`,
                color: active || done ? "#fff" : shell.textMuted,
                fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}>
                {done ? "✓" : n}
              </div>
              <span style={{ fontSize: 10, color: active ? "#a5b4fc" : shell.textSubtle, whiteSpace: "nowrap" }}>
                {s}
              </span>
            </div>
            {i < 2 && (
              <div style={{
                flex: 1, height: 2, margin: "0 6px", marginBottom: 16,
                background: done ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.07)",
                transition: "background 0.2s",
              }} />
            )}
          </div>
        );
      })}
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
  /* ── 入力状態 ── */
  const [lyrics, setLyrics] = useState("");
  const [lyricsFileName, setLyricsFileName] = useState<string | null>(null);
  const [vibes, setVibes] = useState<Set<VibeId>>(new Set());
  const [formationStyle, setFormationStyle] = useState<FormationStyleId>("dynamic");
  const [additionalNote, setAdditionalNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { status, result, error, suggest, reset } = useAiFormationSuggest(project);

  const noPeaks = !peaks || peaks.length === 0 || durationSec <= 0;

  /* 現在のステップ */
  const step: 1 | 2 | 3 =
    status === "idle" ? 1
    : status === "analyzing" || status === "requesting" ? 2
    : 3;

  /* ── 歌詞ファイル読み込み ── */
  const handleLyricsFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLyricsFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") setLyrics(text);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }, []);

  /* ── vibe トグル ── */
  const toggleVibe = useCallback((id: VibeId) => {
    setVibes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ── 提案実行 ── */
  const handleSuggest = useCallback(() => {
    if (!peaks || peaks.length === 0) return;
    const extra = [
      vibes.size > 0 ? `曲のイメージ: ${[...vibes].join(", ")}` : "",
      formationStyle ? `フォーメーションスタイル: ${formationStyle}` : "",
      lyrics.trim() ? `歌詞:\n${lyrics.trim()}` : "",
      additionalNote.trim() ? `その他メモ: ${additionalNote.trim()}` : "",
    ].filter(Boolean).join("\n");
    suggest(peaks, durationSec, extra || undefined);
  }, [peaks, durationSec, vibes, formationStyle, lyrics, additionalNote, suggest]);

  /* ── 適用 ── */
  const handleApply = useCallback(() => {
    if (!result) return;
    const confirmed = window.confirm(
      "AI提案を適用します。\n既存のキュー（タイムライン）は上書きされます。\n元に戻す（Ctrl+Z）で戻せます。\n\n適用しますか？"
    );
    if (!confirmed) return;
    setProject((prev) => {
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

  /* ── やり直し ── */
  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

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
          <StepIndicator step={step} />

          {/* ── Step 1: 曲情報入力 ── */}
          {step === 1 && (
            <div>
              {noPeaks && (
                <div style={{ ...sectionBox, borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)", marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: "#fbbf24", margin: 0 }}>
                    ⚠ 楽曲が読み込まれていません。先にタイムラインに楽曲を取り込んでください。
                  </p>
                </div>
              )}

              {/* 曲のイメージ */}
              <div style={{ marginBottom: 16 }}>
                <span style={label}>曲のイメージ（複数選択OK）</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {VIBES.map((v) => {
                    const selected = vibes.has(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => toggleVibe(v.id)}
                        title={v.desc}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 20,
                          border: `1px solid ${selected ? "#6366f1" : shell.border}`,
                          background: selected ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                          color: selected ? "#a5b4fc" : shell.textMuted,
                          fontSize: 12,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          fontWeight: selected ? 600 : 400,
                        }}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* フォーメーションスタイル */}
              <div style={{ marginBottom: 16 }}>
                <span style={label}>フォーメーションスタイル</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {FORMATION_STYLES.map((fs) => {
                    const selected = formationStyle === fs.id;
                    return (
                      <button
                        key={fs.id}
                        type="button"
                        onClick={() => setFormationStyle(fs.id)}
                        title={fs.desc}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 8,
                          border: `1px solid ${selected ? "#a78bfa" : shell.border}`,
                          background: selected ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                          color: selected ? "#c4b5fd" : shell.textMuted,
                          fontSize: 12,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        {fs.label}
                        <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>{fs.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 歌詞アップロード */}
              <div style={{ marginBottom: 16 }}>
                <span style={label}>歌詞（任意）</span>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <textarea
                      style={textarea}
                      placeholder={"歌詞をここに貼り付け...\n（セクション構成の把握に使われます）"}
                      value={lyrics}
                      onChange={(e) => { setLyrics(e.target.value); setLyricsFileName(null); }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        ...btnSecondary,
                        padding: "7px 12px",
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      ファイル
                    </button>
                    {lyrics && (
                      <button
                        type="button"
                        onClick={() => { setLyrics(""); setLyricsFileName(null); }}
                        style={{ ...btnSecondary, padding: "5px 10px", fontSize: 10, color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
                      >
                        クリア
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.lrc,.srt,.vtt"
                  style={{ display: "none" }}
                  onChange={handleLyricsFile}
                />
                {lyricsFileName && (
                  <p style={{ fontSize: 10, color: "#4ade80", marginTop: 4 }}>
                    ✓ {lyricsFileName} を読み込みました
                  </p>
                )}
              </div>

              {/* 追加メモ */}
              <div style={{ marginBottom: 20 }}>
                <span style={label}>その他・AIへの指示（任意）</span>
                <textarea
                  style={{ ...textarea, minHeight: 56 }}
                  placeholder="例：サビで全員が前に出てくる演出にしたい、Aメロはばらけた配置で…"
                  value={additionalNote}
                  onChange={(e) => setAdditionalNote(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  style={{ ...btnPrimary, opacity: noPeaks ? 0.4 : 1, cursor: noPeaks ? "not-allowed" : "pointer" }}
                  disabled={noPeaks}
                  onClick={handleSuggest}
                >
                  ✨ フォーメーションを提案してもらう
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: 生成中 ── */}
          {step === 2 && (
            <div style={{ textAlign: "center" }}>
              <Spinner />
              {status === "analyzing" ? (
                <>
                  <p style={{ fontSize: 13, color: "#c084fc" }}>音楽を解析しています…</p>
                  <p style={{ fontSize: 11, color: shell.textSubtle, marginTop: 4 }}>BPM・セクション・エネルギーを推定中</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "#e879f9" }}>Claude がフォーメーションを考えています…</p>
                  <p style={{ fontSize: 11, color: shell.textSubtle, marginTop: 4 }}>
                    {vibes.size > 0 ? `[${[...vibes].join(" / ")}] のイメージで生成中` : "楽曲構造に最適なフォーメーションを生成中"}
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: 結果 ── */}
          {step === 3 && (
            <div>
              {status === "error" ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ fontSize: 14, color: "#f87171", marginBottom: 12 }}>エラーが発生しました</p>
                  <p style={{ fontSize: 12, color: shell.textMuted, marginBottom: 16, whiteSpace: "pre-wrap" }}>{error}</p>
                  <button type="button" style={btnSecondary} onClick={handleRetry}>← 入力に戻る</button>
                </div>
              ) : result ? (
                <>
                  {/* 解析サマリー */}
                  <div style={sectionBox}>
                    <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>楽曲解析結果</p>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#e2e8f0" }}>
                      <span><span style={{ color: shell.textSubtle, fontSize: 10 }}>BPM</span>{" "}<strong>{result.analysis.bpm}</strong></span>
                      <span><span style={{ color: shell.textSubtle, fontSize: 10 }}>長さ</span>{" "}<strong>{Math.floor(result.analysis.durationSec / 60)}:{String(Math.floor(result.analysis.durationSec % 60)).padStart(2, "0")}</strong></span>
                      <span><span style={{ color: shell.textSubtle, fontSize: 10 }}>セクション</span>{" "}<strong>{result.analysis.sections.length}</strong></span>
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
                        }}>{idx + 1}</span>
                        <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{f.name}</span>
                        <span style={{ fontSize: 10, color: shell.textSubtle }}>{f.dancers.length}人</span>
                      </div>
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
                          const colors = ["#f87171","#fb923c","#fbbf24","#a3e635","#34d399","#22d3ee","#60a5fa","#a78bfa","#f472b6","#e879f9","#94a3b8","#fcd34d"];
                          return (
                            <div key={d.id} title={d.label} style={{
                              position: "absolute",
                              left: `${d.xPct}%`,
                              top: `${d.yPct}%`,
                              transform: "translate(-50%, -50%)",
                              width: 8, height: 8, borderRadius: "50%",
                              background: colors[d.colorIndex % colors.length],
                              boxShadow: `0 0 4px ${colors[d.colorIndex % colors.length]}60`,
                            }} />
                          );
                        })}
                        <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", fontSize: 7, color: "rgba(255,255,255,0.2)", letterSpacing: 2 }}>
                          客席
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* AIの考え */}
                  {result.reasoning.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>AIの考え</p>
                      {result.reasoning.map((r, i) => (
                        <p key={i} style={{ fontSize: 11, color: shell.textMuted, marginBottom: 4, lineHeight: 1.5 }}>• {r}</p>
                      ))}
                    </div>
                  )}

                  {/* キュー一覧 */}
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>
                      タイムライン ({result.cues.length}キュー)
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {result.cues.map((c, idx) => (
                        <span key={c.id} style={{
                          padding: "3px 8px", borderRadius: 6,
                          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                          fontSize: 10, color: "#a5b4fc",
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
                      ← 入力に戻る
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
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AiSuggestDialog;

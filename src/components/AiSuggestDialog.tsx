/**
 * AiSuggestDialog.tsx — AI提案ダイアログ（v2: 曲情報入力 → 提案生成）
 */

import { useState, useCallback, useRef, useMemo, useEffect, type CSSProperties, type ChangeEvent } from "react";
import { shell } from "../theme/choreoShell";
import { useAiFormationSuggest } from "../hooks/useAiFormationSuggest";
import { playbackEngine } from "../core/playbackEngine";
import {
  AI_SUGGEST_CUE_MAX,
  AI_SUGGEST_CUE_MIN,
  AI_SUGGEST_CUE_PRESETS,
  suggestedCueCountForDuration,
} from "../lib/choreocore/selectChangePoints";
import { CLASS_PROFILE_PRESETS, suggestClassProfileId, SUGGEST_VIBES, SUGGEST_FORMATION_STYLES } from "../lib/choreocore/lightingSync";
import type { SuggestVibeId, SuggestFormationStyleId } from "../lib/choreocore/lightingSync";
import type { SuggestFeedback } from "../lib/choreocore/tier1";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import {
  applyAiSuggestToProject,
  filterAcceptedSuggestion,
  pairSuggestionCues,
  type AiSuggestApplyMode,
} from "../lib/applyAiSuggestResult";
import { captureEditorSuggestionApply } from "../lib/choreocore/engine/calibration/humanFeedbackCapture";
import { poseLevelLabelJa, poseLevelMarkerScale } from "../lib/stageMarkerSizing";
import { scoreAiAgainstProject } from "../lib/choreocore/lightingSync";
import { EditorSideSheet } from "./EditorSideSheet";

interface AiSuggestDialogProps {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  peaks: number[] | null;
  durationSec: number;
  onClose: () => void;
  onStagePreviewChange?: (dancers: DancerSpot[] | null) => void;
}

/* ─── Styles ─── */
const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  borderBottom: `1px solid ${shell.border}`,
  flexShrink: 0,
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: shell.bgDeep,
};

const body: CSSProperties = {
  padding: "16px 20px 24px",
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
  background: shell.accent,
  color: "#1a1408",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  transition: "background 0.2s, box-shadow 0.2s",
  boxShadow: `0 0 0 1px ${shell.brandRing}`,
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
  background: shell.surface,
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

const chipSelected: CSSProperties = {
  border: `1px solid ${shell.accent}`,
  background: shell.accentSoft,
  color: shell.accent,
  fontWeight: 700,
};

const chipIdle: CSSProperties = {
  border: `1px solid ${shell.border}`,
  background: "rgba(255,255,255,0.04)",
  color: shell.textMuted,
  fontWeight: 400,
};

const VIBES = SUGGEST_VIBES;

type VibeId = SuggestVibeId;

const FORMATION_STYLES = SUGGEST_FORMATION_STYLES;

type FormationStyleId = SuggestFormationStyleId;

function musicLinkBadge(name: string): string | null {
  if (name.includes("特大")) return "大サビ · 特大";
  if (name.includes("コールバック")) return "サビ再登場";
  if (name.includes("閉じる")) return "Bメロ終わり";
  if (/広げる|大転換/.test(name)) return "サビ頭";
  return null;
}

/* ─── Spinner ─── */
function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 0" }}>
      <div
        style={{
          width: 40,
          height: 40,
          border: `3px solid ${shell.accentSoft}`,
          borderTop: `3px solid ${shell.accent}`,
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
  const steps = ["曲とキュー", "生成中", "結果確認"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
      {steps.map((s, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = n === step;
        const done = n < step;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: active ? shell.accent : done ? "rgba(74,222,128,0.85)" : "rgba(255,255,255,0.07)",
                border: `2px solid ${active ? shell.accent : done ? "#4ade80" : "rgba(255,255,255,0.15)"}`,
                color: active ? "#1a1408" : done ? "#052e16" : shell.textMuted,
                fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}>
                {done ? "✓" : n}
              </div>
              <span style={{ fontSize: 10, color: active ? shell.accent : shell.textSubtle, whiteSpace: "nowrap" }}>
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
  onStagePreviewChange,
}: AiSuggestDialogProps) {
  /* ── 入力状態 ── */
  const [lyrics, setLyrics] = useState("");
  const [lyricsFileName, setLyricsFileName] = useState<string | null>(null);
  const [vibes, setVibes] = useState<Set<VibeId>>(new Set());
  const [formationStyle, setFormationStyle] = useState<FormationStyleId>("dynamic");
  const [additionalNote, setAdditionalNote] = useState("");
  const defaultCueCount = useMemo(
    () => suggestedCueCountForDuration(durationSec),
    [durationSec]
  );
  const defaultClassId = useMemo(() => {
    const active =
      project.formations.find((f) => f.id === project.activeFormationId) ??
      project.formations[0];
    const n =
      active?.dancers.length ||
      project.pieceDancerCount ||
      0;
    return suggestClassProfileId(n);
  }, [project]);
  const [targetCueCount, setTargetCueCount] = useState(defaultCueCount);
  const [classProfileId, setClassProfileId] = useState(defaultClassId);
  const [fbLessMove, setFbLessMove] = useState(false);
  const [fbLessCross, setFbLessCross] = useState(false);
  const [fbMoreImpact, setFbMoreImpact] = useState(false);
  const [fbNote, setFbNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { status, result, error, suggest, reset } = useAiFormationSuggest(project);

  const [acceptedCueIds, setAcceptedCueIds] = useState<Set<string>>(new Set());
  const [previewCueId, setPreviewCueId] = useState<string | null>(null);
  const [applyMode, setApplyMode] = useState<AiSuggestApplyMode>("replace");

  const pairedCues = useMemo(
    () => (result ? pairSuggestionCues(result.formations, result.cues) : []),
    [result]
  );
  const acceptedCount = useMemo(
    () => pairedCues.filter((p) => acceptedCueIds.has(p.cue.id)).length,
    [pairedCues, acceptedCueIds]
  );
  const gateReport = useMemo(() => {
    if (!result?.evaluation || project.cues.length < 1) return null;
    try {
      return scoreAiAgainstProject(project, result.evaluation);
    } catch {
      return null;
    }
  }, [result, project]);

  const clearStagePreview = useCallback(() => {
    onStagePreviewChange?.(null);
  }, [onStagePreviewChange]);

  const handleClose = useCallback(() => {
    clearStagePreview();
    onClose();
  }, [clearStagePreview, onClose]);

  useEffect(() => {
    return () => {
      onStagePreviewChange?.(null);
    };
  }, [onStagePreviewChange]);

  useEffect(() => {
    if (!result) {
      setAcceptedCueIds(new Set());
      setPreviewCueId(null);
      return;
    }
    setAcceptedCueIds(new Set(result.cues.map((c) => c.id)));
    setPreviewCueId(result.cues[0]?.id ?? null);
  }, [result]);

  useEffect(() => {
    if (!result) onStagePreviewChange?.(null);
  }, [result, onStagePreviewChange]);

  useEffect(() => {
    if (!result || !previewCueId) {
      clearStagePreview();
      return;
    }
    const cue = result.cues.find((c) => c.id === previewCueId);
    const formation = result.formations.find((f) => f.id === cue?.formationId);
    onStagePreviewChange?.(formation?.dancers?.length ? formation.dancers : null);
    if (cue && playbackEngine.isPaused()) {
      playbackEngine.seek(cue.tStartSec);
    }
  }, [result, previewCueId, onStagePreviewChange, clearStagePreview]);

  const noPeaks = !peaks || peaks.length === 0 || durationSec <= 0;

  /* 現在のステップ */
  const step: 1 | 2 | 3 =
    status === "idle" ? 1
    : status === "analyzing" || status === "requesting" ? 2
    : 3;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (step === 2) return;
      e.stopPropagation();
      handleClose();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener(
        "keydown",
        onKey,
        { capture: true } as EventListenerOptions
      );
  }, [step, handleClose]);

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
    const mediaUrl = playbackEngine.getMediaSourceUrl();
    suggest(peaks, durationSec, undefined, {
      audioUrl: mediaUrl || null,
      targetCueCount,
      classProfileId,
      taste: {
        vibes: [...vibes],
        style: formationStyle,
        lyrics: lyrics.trim() || undefined,
        note: additionalNote.trim() || undefined,
      },
    });
  }, [peaks, durationSec, vibes, formationStyle, lyrics, additionalNote, targetCueCount, classProfileId, suggest]);

  /* ── 適用 ── */
  const handleApply = useCallback(() => {
    if (!result) return;
    const accepted = filterAcceptedSuggestion(
      result.formations,
      result.cues,
      acceptedCueIds
    );
    if (accepted.cues.length === 0) return;
    const confirmed = window.confirm(
      applyMode === "append"
        ? "既存のキューはそのまま残し、採用した提案をタイムラインに追加します。\n時間が重なる場合は空きにずらします。\n元に戻す（Ctrl+Z）で戻せます。\n\n追加しますか？"
        : "採用したキューでタイムラインを置き換えます。\n却下した提案は入りません。\n元に戻す（Ctrl+Z）で戻せます。\n\n適用しますか？"
    );
    if (!confirmed) return;
    captureEditorSuggestionApply(
      {
        musicId: project.pieceTitle.trim() || undefined,
        acceptedCueIds: [...acceptedCueIds],
        cues: result.cues,
        formations: result.formations,
        scoreByFormationId: Object.fromEntries(
          result.formations.map((f, i) => [
            f.id,
            {
              overall: result.scores[i]?.total ?? 0,
              breakdown: {
                move: result.scores[i]?.axes.move ?? 0,
                safety: result.scores[i]?.axes.safety ?? 0,
              },
              weights: {},
              weightsVersion: "WEIGHTS_FORMATION_V1",
            },
          ])
        ),
      },
      acceptedCueIds
    );
    setProject((prev) =>
      applyAiSuggestToProject(prev, accepted, applyMode, { durationSec })
    );
    clearStagePreview();
    onClose();
  }, [
    result,
    acceptedCueIds,
    applyMode,
    durationSec,
    project.pieceTitle,
    setProject,
    clearStagePreview,
    onClose,
  ]);

  const toggleAccepted = useCallback((cueId: string) => {
    setAcceptedCueIds((prev) => {
      const next = new Set(prev);
      if (next.has(cueId)) next.delete(cueId);
      else next.add(cueId);
      return next;
    });
  }, []);

  const acceptAll = useCallback(() => {
    setAcceptedCueIds(new Set(pairedCues.map((p) => p.cue.id)));
  }, [pairedCues]);

  const rejectAll = useCallback(() => {
    setAcceptedCueIds(new Set());
  }, []);

  /* ── やり直し ── */
  const handleRetry = useCallback(() => {
    clearStagePreview();
    reset();
  }, [reset, clearStagePreview]);

  /* ── フィードバック再提案 ── */
  const handleResuggest = useCallback(() => {
    if (!peaks || peaks.length === 0) return;
    const feedback: SuggestFeedback = {
      preferLessMovement: fbLessMove,
      preferFewerCrossings: fbLessCross,
      preferMoreImpact: fbMoreImpact,
      note: fbNote.trim() || undefined,
    };
    const mediaUrl = playbackEngine.getMediaSourceUrl();
    suggest(peaks, durationSec, undefined, {
      audioUrl: mediaUrl || null,
      targetCueCount,
      classProfileId,
      feedback,
      taste: {
        vibes: [...vibes],
        style: formationStyle,
        lyrics: lyrics.trim() || undefined,
        note: additionalNote.trim() || undefined,
      },
    });
  }, [
    peaks,
    durationSec,
    vibes,
    formationStyle,
    lyrics,
    additionalNote,
    targetCueCount,
    classProfileId,
    fbLessMove,
    fbLessCross,
    fbMoreImpact,
    fbNote,
    suggest,
  ]);

  return (
    <EditorSideSheet
      open
      onClose={handleClose}
      width="min(520px, 92vw)"
      zIndex={9000}
      blockDismiss={step === 2}
      ariaLabelledBy="ai-suggest-dialog-title"
      sheetId="ai-suggest"
      panelStyle={{
        background: shell.bgDeep,
        borderLeft: `1px solid ${shell.border}`,
        boxShadow: "-18px 0 50px rgba(0, 0, 0, 0.55)",
      }}
    >
        {/* Header */}
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: `1.5px solid ${shell.brandRing}`,
                background: `radial-gradient(circle at 50% 45%, ${shell.ruby} 0 18%, transparent 19%), ${shell.surfaceRaised}`,
                boxShadow: `0 0 12px ${shell.brandGlow}`,
                flexShrink: 0,
              }}
            />
            <div>
              <span id="ai-suggest-dialog-title" style={{ fontSize: 15, fontWeight: 700, color: shell.text, display: "block", letterSpacing: "0.02em" }}>
                ChoreoCore 提案
              </span>
              <span style={{ fontSize: 10, color: shell.textSubtle }}>曲の区切りに合わせて隊形を置く</span>
            </div>
          </div>
          <button type="button" style={btnClose} onClick={handleClose}>×</button>
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

              {/* キュー数（主役） */}
              <div
                style={{
                  ...sectionBox,
                  marginBottom: 16,
                  padding: "14px 16px",
                  background: `linear-gradient(165deg, ${shell.surfaceRaised} 0%, ${shell.bgChrome} 100%)`,
                  borderColor: shell.borderStrong,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div>
                    <span style={{ ...label, marginBottom: 2 }}>キュー数（この数が結果に出ます）</span>
                    <p style={{ fontSize: 10, color: shell.textSubtle, margin: 0, lineHeight: 1.4 }}>
                      Bメロ終わり・サビ頭を優先して配置します
                    </p>
                  </div>
                  <span style={{ fontSize: 28, fontWeight: 800, color: shell.accent, letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {targetCueCount}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {AI_SUGGEST_CUE_PRESETS.map((n) => {
                    const selected = targetCueCount === n;
                    const recommended = n === defaultCueCount;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setTargetCueCount(n)}
                        style={{
                          minWidth: 44,
                          padding: "7px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: "pointer",
                          ...(selected ? chipSelected : chipIdle),
                          boxShadow: recommended && !selected ? `inset 0 0 0 1px ${shell.borderStrong}` : undefined,
                        }}
                      >
                        {n}{recommended ? " · 推奨" : ""}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="range"
                    min={AI_SUGGEST_CUE_MIN}
                    max={AI_SUGGEST_CUE_MAX}
                    value={targetCueCount}
                    onChange={(e) => setTargetCueCount(Number(e.target.value))}
                    style={{ flex: 1, accentColor: shell.accent }}
                  />
                  <input
                    type="number"
                    min={AI_SUGGEST_CUE_MIN}
                    max={AI_SUGGEST_CUE_MAX}
                    value={targetCueCount}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setTargetCueCount(
                        Math.min(AI_SUGGEST_CUE_MAX, Math.max(AI_SUGGEST_CUE_MIN, Math.round(n)))
                      );
                    }}
                    style={{
                      width: 56,
                      boxSizing: "border-box",
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${shell.borderStrong}`,
                      borderRadius: 8,
                      color: shell.text,
                      fontSize: 13,
                      fontWeight: 700,
                      padding: "6px 8px",
                      textAlign: "center",
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 4,
                    fontSize: 9,
                    color: shell.textSubtle,
                    textAlign: "center",
                  }}
                >
                  {[
                    ["導入", "開始"],
                    ["Bメロ", "閉じる"],
                    ["サビ", "開く"],
                    ["大サビ", "特大"],
                  ].map(([a, b]) => (
                    <div
                      key={a}
                      style={{
                        padding: "6px 4px",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.25)",
                        border: `1px solid ${shell.border}`,
                      }}
                    >
                      <div style={{ color: shell.accent, fontWeight: 700 }}>{a}</div>
                      <div>{b}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 10, color: shell.textSubtle, margin: "10px 0 0", lineHeight: 1.45 }}>
                  曲長 {Math.floor(durationSec / 60)}:{String(Math.floor(durationSec % 60)).padStart(2, "0")}
                  のおすすめは {defaultCueCount}（約20秒に1つ）。近すぎる変化は移動4カウント分を確保して間引きます。
                </p>
              </div>

              {/* 移動ルール */}
              <div style={{ marginBottom: 16 }}>
                <span style={label}>移動ルール（難易度）</span>
                <p style={{ fontSize: 10, color: shell.textSubtle, margin: "0 0 8px", lineHeight: 1.4 }}>
                  1歩の大きさ・変化の間隔・交差の可否を決めます（スタジオのクラス名ではありません）
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {CLASS_PROFILE_PRESETS.map((p) => {
                    const selected = classProfileId === p.classId;
                    return (
                      <button
                        key={p.classId}
                        type="button"
                        onClick={() => setClassProfileId(p.classId)}
                        style={{
                          textAlign: "left",
                          padding: "8px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: "pointer",
                          ...(selected ? chipSelected : chipIdle),
                        }}
                      >
                        <strong style={{ color: shell.text }}>{p.className}</strong>
                        <span style={{ display: "block", fontSize: 10, marginTop: 2, opacity: 0.8, lineHeight: 1.4 }}>
                          {p.summary ??
                            `移動≤${p.maxMoveDistancePerCount}m/count · 間隔≥${p.minCountsBetweenChanges} · 交差${p.allowCrossMovement ? "可" : "不可"}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

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
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          ...(selected ? chipSelected : chipIdle),
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
                          fontSize: 12,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          ...(selected ? chipSelected : chipIdle),
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
                      placeholder={"歌詞をここに貼り付け...\n円・光・走る などの言葉は隊形のヒントになります"}
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
                  フォーメーションを提案する（{targetCueCount}枠）
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
                  <p style={{ fontSize: 13, color: shell.accent }}>音楽を解析しています…</p>
                  <p style={{ fontSize: 11, color: shell.textSubtle, marginTop: 4 }}>拍・帯域・変化点を解析中。準備できなければ従来経路に戻します</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: shell.text }}>曲の区切りと隊列を組み立てています…</p>
                  <p style={{ fontSize: 11, color: shell.textSubtle, marginTop: 4 }}>
                    指定 {targetCueCount} 枠 · Bメロ閉じる → サビ開く → コールバック
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
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: shell.text, flexWrap: "wrap", alignItems: "baseline" }}>
                      <span>
                        <span style={{ color: shell.textSubtle, fontSize: 10 }}>キュー</span>{" "}
                        <strong style={{ color: shell.accent, fontSize: 18 }}>{result.cues.length}</strong>
                        <span style={{ color: shell.textSubtle, fontSize: 11 }}> / 指定 {targetCueCount}</span>
                      </span>
                      <span><span style={{ color: shell.textSubtle, fontSize: 10 }}>BPM</span>{" "}<strong>{result.analysis.bpm}</strong></span>
                      <span><span style={{ color: shell.textSubtle, fontSize: 10 }}>長さ</span>{" "}<strong>{Math.floor(result.analysis.durationSec / 60)}:{String(Math.floor(result.analysis.durationSec % 60)).padStart(2, "0")}</strong></span>
                      <span><span style={{ color: shell.textSubtle, fontSize: 10 }}>セクション</span>{" "}<strong>{result.analysis.sections.length}</strong></span>
                      {result.analysisSource ? (
                        <span><span style={{ color: shell.textSubtle, fontSize: 10 }}>解析</span>{" "}<strong>{result.analysisSource}</strong></span>
                      ) : null}
                      <span><span style={{ color: shell.textSubtle, fontSize: 10 }}>スコア</span>{" "}<strong>{result.averageScore}/100</strong></span>
                      {result.classProfileId ? (
                        <span><span style={{ color: shell.textSubtle, fontSize: 10 }}>クラス</span>{" "}<strong>{result.classProfileId}</strong></span>
                      ) : null}
                    </div>
                    {result.cues.length !== targetCueCount ? (
                      <p style={{ fontSize: 10, color: "#fbbf24", margin: "8px 0 0", lineHeight: 1.4 }}>
                        指定と結果がずれています。もう一度提案するか、キュー数を変えてみてください。
                      </p>
                    ) : (
                      <p style={{ fontSize: 10, color: shell.textSubtle, margin: "8px 0 0", lineHeight: 1.4 }}>
                        曲の区切り（Bメロ終わり・サビ頭など）を優先して {result.cues.length} 枠に合わせました。
                      </p>
                    )}
                  </div>

                  {gateReport ? (
                    <div style={sectionBox}>
                      <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>
                        既存キューとの品質ゲート（総合 {gateReport.overall}）
                      </p>
                      <p style={{ fontSize: 10, color: shell.textSubtle, margin: "0 0 8px", lineHeight: 1.45 }}>
                        いまのタイムラインを人手ラベルとして、今回のエンジン提案を採点しています。
                        {gateReport.ceilingEstimated ? " 注釈が1系統のため Human Ceiling は参考値です。" : ""}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {gateReport.gates.map((g) => {
                          const color = g.verdict === "PASS" ? "#4ade80" : g.verdict === "WATCH" ? "#fbbf24" : "#f87171";
                          return (
                            <div key={g.id} style={{ display: "flex", gap: 10, fontSize: 11, color: "#e2e8f0", flexWrap: "wrap" }}>
                              <span style={{ minWidth: 40, fontWeight: 700, color }}>{g.verdict}</span>
                              <span style={{ flex: "1 1 120px" }}>{g.label}</span>
                              <span style={{ color: shell.textSubtle }}>
                                {(g.actual * 100).toFixed(0)} / {(g.target * 100).toFixed(0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* 評価スコア */}
                  {result.scores.length > 0 && (
                    <div style={sectionBox}>
                      <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>
                        評価スコア（移動 / 安全）
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {result.scores.map((s, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, fontSize: 11, color: "#e2e8f0", flexWrap: "wrap" }}>
                            <span style={{ color: shell.textSubtle, minWidth: 48 }}>#{i + 1}</span>
                            <span>総合 <strong>{s.total}</strong></span>
                            <span>移動 {s.axes.move}</span>
                            <span>安全 {s.axes.safety}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* フィードバック → 再提案 */}
                  <div style={sectionBox}>
                    <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 8, fontWeight: 600 }}>
                      フィードバックして再提案
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {(
                        [
                          ["移動を減らす", fbLessMove, setFbLessMove],
                          ["交差を減らす", fbLessCross, setFbLessCross],
                          ["もっとインパクト", fbMoreImpact, setFbMoreImpact],
                        ] as const
                      ).map(([lab, on, set]) => (
                        <button
                          key={lab}
                          type="button"
                          onClick={() => set(!on)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 8,
                            fontSize: 11,
                            cursor: "pointer",
                            ...(on ? chipSelected : chipIdle),
                          }}
                        >
                          {lab}
                        </button>
                      ))}
                    </div>
                    <textarea
                      style={{ ...textarea, minHeight: 44, marginBottom: 8 }}
                      placeholder="例：サビの開きをもっと大きく、Aメロは静かに…"
                      value={fbNote}
                      onChange={(e) => setFbNote(e.target.value)}
                    />
                    <button
                      type="button"
                      style={{ ...btnPrimary, width: "100%", padding: "8px 16px" }}
                      onClick={handleResuggest}
                    >
                      フィードバックで再提案
                    </button>
                  </div>

                  {/* フォーメーション一覧（クリックで舞台プレビュー、採用/却下） */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <p style={{ fontSize: 11, color: shell.textSubtle, margin: 0, fontWeight: 600 }}>
                      提案キュー（クリックで舞台にプレビュー） · 採用 {acceptedCount}/{pairedCues.length}
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" style={{ ...btnSecondary, padding: "4px 8px", fontSize: 10 }} onClick={acceptAll}>
                        すべて採用
                      </button>
                      <button type="button" style={{ ...btnSecondary, padding: "4px 8px", fontSize: 10 }} onClick={rejectAll}>
                        すべて却下
                      </button>
                    </div>
                  </div>
                  {pairedCues.map(({ cue, formation }, idx) => {
                    const accepted = acceptedCueIds.has(cue.id);
                    const previewing = previewCueId === cue.id;
                    const linkBadge = musicLinkBadge(formation.name);
                    const poseSummary = (() => {
                      const counts = { stand: 0, crouch: 0, sit: 0 };
                      for (const d of formation.dancers) {
                        const p = d.poseLevel ?? "stand";
                        counts[p] += 1;
                      }
                      const parts: string[] = [];
                      if (counts.crouch) parts.push(`しゃがみ${counts.crouch}`);
                      if (counts.sit) parts.push(`座り${counts.sit}`);
                      return parts.join(" · ");
                    })();
                    return (
                      <div
                        key={cue.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewCueId(cue.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setPreviewCueId(cue.id);
                          }
                        }}
                        style={{
                          ...sectionBox,
                          cursor: "pointer",
                          opacity: accepted ? 1 : 0.45,
                          borderColor: previewing
                            ? shell.accent
                            : accepted
                              ? shell.border
                              : "rgba(248,113,113,0.25)",
                          boxShadow: previewing ? `0 0 0 1px ${shell.accent}` : undefined,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: 6,
                            background: previewing ? shell.accent : shell.accentSoft,
                            color: previewing ? "#1a1408" : shell.accent,
                            fontSize: 10, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>{idx + 1}</span>
                          <span style={{ fontSize: 12, color: shell.text, fontWeight: 600, flex: 1 }}>
                            {formation.name}
                          </span>
                          {linkBadge ? (
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: shell.accent,
                              background: shell.accentSoft,
                              border: `1px solid ${shell.borderStrong}`,
                              borderRadius: 4,
                              padding: "2px 6px",
                              whiteSpace: "nowrap",
                            }}>
                              {linkBadge}
                            </span>
                          ) : null}
                          <span style={{ fontSize: 10, color: shell.textSubtle }}>
                            {Math.floor(cue.tStartSec / 60)}:{String(Math.floor(cue.tStartSec % 60)).padStart(2, "0")}
                            –{Math.floor(cue.tEndSec / 60)}:{String(Math.floor(cue.tEndSec % 60)).padStart(2, "0")}
                          </span>
                          <span style={{ fontSize: 10, color: shell.textSubtle }}>{formation.dancers.length}人</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAccepted(cue.id);
                            }}
                            style={{
                              ...btnSecondary,
                              padding: "4px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              color: accepted ? "#4ade80" : "#f87171",
                              borderColor: accepted ? "rgba(74,222,128,0.35)" : "rgba(248,113,113,0.35)",
                            }}
                          >
                            {accepted ? "採用" : "却下"}
                          </button>
                        </div>
                        {formation.note ? (
                          <p style={{ fontSize: 10, color: shell.accent, margin: "0 0 6px", lineHeight: 1.45, opacity: 0.9 }}>
                            {formation.note.length > 120 ? `${formation.note.slice(0, 120)}…` : formation.note}
                          </p>
                        ) : null}
                        {poseSummary ? (
                          <p style={{ fontSize: 10, color: "#fbbf24", margin: "0 0 6px" }}>
                            姿勢 {poseSummary}
                          </p>
                        ) : null}
                        <div style={{
                          position: "relative",
                          width: "100%",
                          height: 72,
                          background: "rgba(0,0,0,0.3)",
                          borderRadius: 6,
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.04)",
                        }}>
                          {formation.dancers.map((d) => {
                            const colors = ["#f87171","#fb923c","#fbbf24","#a3e635","#34d399","#22d3ee","#60a5fa","#a78bfa","#f472b6","#e879f9","#94a3b8","#fcd34d"];
                            const poseScale = poseLevelMarkerScale(d.poseLevel);
                            const size = 8 * poseScale;
                            const radius = d.poseLevel === "sit" ? "2px" : "50%";
                            return (
                              <div
                                key={d.id}
                                title={`${d.label}（${poseLevelLabelJa(d.poseLevel)}）`}
                                style={{
                                  position: "absolute",
                                  left: `${d.xPct}%`,
                                  top: `${d.yPct}%`,
                                  transform: "translate(-50%, -50%)",
                                  width: size,
                                  height: size,
                                  borderRadius: radius,
                                  background: colors[d.colorIndex % colors.length],
                                  boxShadow: `0 0 4px ${colors[d.colorIndex % colors.length]}60`,
                                }}
                              />
                            );
                          })}
                          <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", fontSize: 7, color: "rgba(255,255,255,0.2)", letterSpacing: 2 }}>
                            客席
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* AIの考え */}
                  {result.reasoning.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>AIの考え</p>
                      {result.reasoning.map((r, i) => (
                        <p key={i} style={{ fontSize: 11, color: shell.textMuted, marginBottom: 4, lineHeight: 1.5 }}>• {r}</p>
                      ))}
                    </div>
                  )}

                  {/* 適用方法 */}
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 11, color: shell.textSubtle, marginBottom: 6, fontWeight: 600 }}>
                      適用方法
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(
                        [
                          ["replace", "上書き", "タイムラインのキューを採用分で置き換え"],
                          ["append", "追加", "既存キューはそのまま、採用分を足す"],
                        ] as const
                      ).map(([mode, lab, desc]) => {
                        const selected = applyMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setApplyMode(mode)}
                            style={{
                              flex: 1,
                              textAlign: "left",
                              padding: "8px 12px",
                              borderRadius: 8,
                              fontSize: 12,
                              cursor: "pointer",
                              ...(selected ? chipSelected : chipIdle),
                            }}
                          >
                            <strong style={{ color: shell.text }}>{lab}</strong>
                            <span style={{ display: "block", fontSize: 10, marginTop: 2, opacity: 0.75, lineHeight: 1.4 }}>
                              {desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* アクションボタン */}
                  <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button type="button" style={btnSecondary} onClick={handleRetry}>
                      ← 入力に戻る
                    </button>
                    <button
                      type="button"
                      style={{
                        ...btnPrimary,
                        opacity: acceptedCount === 0 ? 0.4 : 1,
                        cursor: acceptedCount === 0 ? "not-allowed" : "pointer",
                      }}
                      disabled={acceptedCount === 0}
                      onClick={handleApply}
                      onMouseEnter={(e) => {
                        if (acceptedCount === 0) return;
                        (e.target as HTMLButtonElement).style.background = shell.accentDeep;
                        (e.target as HTMLButtonElement).style.color = shell.text;
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.background = shell.accent;
                        (e.target as HTMLButtonElement).style.color = "#1a1408";
                      }}
                    >
                      {applyMode === "append"
                        ? `採用したキューを追加（${acceptedCount}）`
                        : `採用したキューで上書き（${acceptedCount}）`}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
    </EditorSideSheet>
  );
}

export default AiSuggestDialog;

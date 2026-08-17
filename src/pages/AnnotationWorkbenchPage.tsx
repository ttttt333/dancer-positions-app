import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { btnAccent, btnSecondary } from "../components/stageButtonStyles";
import { shell } from "../theme/choreoShell";
import {
  ANNOTATION_INSTRUCTIONS,
  ANNOTATION_WORKFLOW_VERSION,
  createAnnotationSession,
  exportAnnotationJson,
  validateAnnotationSession,
} from "../lib/choreocore/engine/annotation";
import { FORMATION_RUBRIC } from "../lib/choreocore/engine/annotation/AnnotationInstructions";
import type { AnnotationSession } from "../lib/choreocore/engine/types/AnnotationTypes";
import type {
  HumanCueAnnotation,
  HumanFormationLayout,
  HumanFormationRating,
  HumanSectionAnnotation,
  HumanSequenceRating,
} from "../lib/choreocore/engine/types/EvaluationTypes";
import { AnnotateMiniStage } from "./annotation/AnnotateMiniStage";
import { DEFAULT_DANCER_COUNT, layoutPreset, type AnnotateSpot } from "./annotation/annotateLayouts";
import { AnnotateSongTimeline, ScoreSlider, TimeField } from "./annotation/annotateUi";
import {
  CALIBRATION_SONG_IDS,
  CUE_ACTION_JA,
  CUE_ACTIONS,
  CUE_MAGNITUDE_JA,
  CUE_MAGNITUDES,
  FORMATION_TYPE_JA,
  FORMATION_TYPES,
  PILOT_ANNOTATORS,
  PILOT_SONGS,
  SECTION_TYPE_JA,
  SECTION_TYPES,
  annotatorShort,
  draftKey,
  formatClock,
} from "./annotation/pilotCatalog";

const pageWrap: CSSProperties = {
  minHeight: "100dvh",
  background: `radial-gradient(1200px 600px at 10% -10%, ${shell.brandGlow}, transparent 55%), ${shell.bgDeep}`,
  color: shell.text,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const card: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "20px 18px 56px",
};

const panel: CSSProperties = {
  background: shell.surface,
  border: `1px solid ${shell.borderStrong}`,
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const input: CSSProperties = {
  background: shell.bgChrome,
  color: shell.text,
  border: `1px solid ${shell.border}`,
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 13,
  minWidth: 0,
};

const label: CSSProperties = {
  fontSize: 11,
  color: shell.textSubtle,
  display: "block",
  marginBottom: 4,
};

function newCueId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `cue-${crypto.randomUUID()}`;
  return `cue-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

function cueIdOf(cue: HumanCueAnnotation, index: number): string {
  return cue.id || `cue-${index}`;
}

function withCueIds(session: AnnotationSession): AnnotationSession {
  return {
    ...session,
    cues: session.cues.map((cue, i) => (cue.id ? cue : { ...cue, id: `cue-${i}-${Math.round(cue.time * 10)}` })),
  };
}

function emptySession(annotatorId: string, songId: string): AnnotationSession {
  const song = PILOT_SONGS.find((s) => s.id === songId) ?? PILOT_SONGS[0]!;
  return createAnnotationSession({
    songId: song.id,
    annotatorId,
    duration: song.duration,
    bpm: song.bpm,
    mode: "BLIND",
    id: `ann-${song.id}-${annotatorShort(annotatorId)}`,
    now: new Date("2026-08-14T00:00:00.000Z"),
    notes: "Human First. Annotate as you would choreograph. Do not view AI output. mode=BLIND.",
  });
}

function loadDraft(annotatorId: string, songId: string): AnnotationSession {
  try {
    const raw = localStorage.getItem(draftKey(annotatorId, songId));
    if (raw) return withCueIds(JSON.parse(raw) as AnnotationSession);
  } catch {
    /* ignore */
  }
  return emptySession(annotatorId, songId);
}

function importanceBand(n: number): string {
  if (n >= 90) return "Major";
  if (n >= 70) return "Strong";
  if (n >= 40) return "Moderate";
  return "Minor";
}

function layoutOf(row: HumanFormationRating | undefined): AnnotateSpot[] {
  return row?.layout?.positions ?? [];
}

export function AnnotationWorkbenchPage() {
  const [annotatorId, setAnnotatorId] = useState<string>(PILOT_ANNOTATORS[0]);
  const [calibrationOnly, setCalibrationOnly] = useState(true);
  const [songId, setSongId] = useState<string>("real-001");
  const [session, setSession] = useState<AnnotationSession>(() => loadDraft(PILOT_ANNOTATORS[0], "real-001"));
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const songs = useMemo(
    () => (calibrationOnly ? PILOT_SONGS.filter((s) => CALIBRATION_SONG_IDS.includes(s.id as (typeof CALIBRATION_SONG_IDS)[number])) : PILOT_SONGS),
    [calibrationOnly]
  );
  const song = PILOT_SONGS.find((s) => s.id === songId) ?? PILOT_SONGS[0]!;
  const duration = audioDuration > 0 ? audioDuration : song.duration;
  const instructions = useMemo(() => ANNOTATION_INSTRUCTIONS.split("\n"), []);
  const check = validateAnnotationSession(session);
  const now = audioRef.current?.currentTime ?? currentTime;

  useEffect(() => {
    const next = loadDraft(annotatorId, songId);
    setSession(next);
    setSelectedCueId(next.cues[0] ? cueIdOf(next.cues[0], 0) : null);
    setSelectedSectionIndex(null);
  }, [annotatorId, songId]);

  useEffect(() => {
    localStorage.setItem(draftKey(annotatorId, songId), JSON.stringify(session));
  }, [annotatorId, songId, session]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const patch = useCallback((next: Partial<AnnotationSession>) => {
    setSession((prev) => ({ ...prev, ...next, mode: "BLIND", version: ANNOTATION_WORKFLOW_VERSION }));
  }, []);

  const json = useMemo(() => exportAnnotationJson(session), [session]);

  const seekTo = (t: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, t);
    setCurrentTime(Math.max(0, t));
  };

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${songId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const onAudioFile = (file: File | undefined) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (!file) {
      setAudioUrl(null);
      return;
    }
    setAudioUrl(URL.createObjectURL(file));
  };

  const addSection = () => {
    const last = session.sections[session.sections.length - 1];
    const start = last ? last.endTime : now || 0;
    const next: HumanSectionAnnotation = {
      songId,
      annotatorId,
      startTime: start,
      endTime: Math.min(duration, start + 16),
      type: session.sections.length === 0 ? "INTRO" : "VERSE",
      confidence: 90,
    };
    patch({ sections: [...session.sections, next] });
    setSelectedSectionIndex(session.sections.length);
    setSelectedCueId(null);
  };

  const makeCue = (time: number): HumanCueAnnotation => ({
    id: newCueId(),
    songId,
    annotatorId,
    time,
    action: "MAJOR_CHANGE",
    magnitude: "MAX",
    importance: 90,
    confidence: 90,
    notes: "",
  });

  const addCueAt = (time: number) => {
    const cue = makeCue(time);
    const rank1 = defaultRank1(cue.id!, undefined);
    patch({ cues: [...session.cues, cue], formations: [...session.formations, rank1] });
    setSelectedCueId(cue.id!);
    setSelectedSectionIndex(null);
    seekTo(time);
  };

  const setCueTime = (id: string, time: number) => {
    patch({
      cues: session.cues.map((cue, i) => (cueIdOf(cue, i) === id ? { ...cue, id, time } : cue)),
    });
  };

  const defaultRank1 = (cueId: string, from: HumanFormationRating | undefined): HumanFormationRating => {
    const positions = from?.layout?.positions ?? layoutPreset("LINE", from?.layout?.dancerCount ?? DEFAULT_DANCER_COUNT);
    const formationType = from?.formationType || "LINE";
    const layout: HumanFormationLayout = { dancerCount: positions.length, positions };
    return {
      songId,
      cueId,
      annotatorId,
      formationType,
      formationId: formationType,
      rank: 1,
      score: 95,
      overall: 95,
      musicFit: 95,
      visualImpact: 93,
      transitionQuality: 91,
      execution: 88,
      originality: 70,
      layout,
    };
  };

  const rankFor = (cueId: string, rank: 1 | 2 | 3) =>
    session.formations.find((f) => f.cueId === cueId && f.rank === rank);

  const upsertFormation = (row: HumanFormationRating) => {
    const others = session.formations.filter((f) => !(f.cueId === row.cueId && f.rank === row.rank));
    patch({
      formations: [...others, row].sort((a, b) => a.cueId.localeCompare(b.cueId) || (a.rank ?? 9) - (b.rank ?? 9)),
    });
  };

  const setAltRank = (cueId: string, rank: 2 | 3, formationType: string) => {
    if (!formationType) {
      patch({ formations: session.formations.filter((f) => !(f.cueId === cueId && f.rank === rank)) });
      return;
    }
    const defaults: Record<2 | 3, number> = { 2: 88, 3: 80 };
    upsertFormation({
      songId,
      cueId,
      annotatorId,
      formationType,
      formationId: formationType,
      rank,
      score: defaults[rank],
      overall: defaults[rank],
      musicFit: defaults[rank],
      visualImpact: defaults[rank] - 2,
      transitionQuality: defaults[rank] - 4,
      execution: 88,
      originality: 70,
    });
  };

  const sequence = session.sequence[0] ?? {
    songId,
    annotatorId,
    formationIds: [],
    musicStory: 80,
    visualStory: 80,
    execution: 80,
    variety: 70,
    overall: 80,
  };

  const setSequence = (next: HumanSequenceRating) => patch({ sequence: [next] });

  const fillSequenceFromCues = () => {
    const ids = session.cues.map((cue, i) => rankFor(cueIdOf(cue, i), 1)?.formationType).filter((x): x is string => Boolean(x));
    setSequence({ ...sequence, songId, annotatorId, formationIds: ids });
  };

  const selectedCueIndex = session.cues.findIndex((c, i) => cueIdOf(c, i) === selectedCueId);
  const selectedCue = selectedCueIndex >= 0 ? session.cues[selectedCueIndex]! : null;
  const cuesByTime = session.cues
    .map((cue, i) => ({ cue, i, id: cueIdOf(cue, i) }))
    .sort((a, b) => a.cue.time - b.cue.time);
  const selectedCueOrder = selectedCueId ? cuesByTime.findIndex((row) => row.id === selectedCueId) : -1;
  const prevCueRow = selectedCueOrder > 0 ? cuesByTime[selectedCueOrder - 1] : undefined;
  const prevLayout = prevCueRow ? rankFor(prevCueRow.id, 1) : undefined;
  const selectedRank1 = selectedCueId ? rankFor(selectedCueId, 1) : undefined;
  const selectedSection = selectedSectionIndex != null ? session.sections[selectedSectionIndex] : undefined;

  return (
    <div style={pageWrap}>
      <div style={card}>
        <p style={{ margin: "0 0 8px", color: shell.textSubtle, fontSize: 12 }}>
          <Link to="/" style={{ color: shell.accent }}>
            Home
          </Link>
          {" / evaluation / annotate"}
        </p>
        <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>BLIND Annotation</h1>
        <p style={{ color: shell.textMuted, fontSize: 12, margin: "0 0 12px", lineHeight: 1.5 }}>
          AI の推奨は表示しません。音源バーのキューを直接直して、選んだ1件だけ舞台に置きます。Schema {ANNOTATION_WORKFLOW_VERSION}.
        </p>

        <details style={{ ...panel, padding: "8px 12px" }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: shell.textMuted }}>ルール</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: shell.textMuted, fontSize: 12, lineHeight: 1.55 }}>
            {instructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>

        <div style={{ ...panel, padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <span style={label}>Annotator</span>
              <select value={annotatorId} onChange={(e) => setAnnotatorId(e.target.value)} style={{ ...input, width: "100%", padding: "5px 8px" }}>
                {PILOT_ANNOTATORS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={label}>Song</span>
              <select value={songId} onChange={(e) => setSongId(e.target.value)} style={{ ...input, width: "100%", padding: "5px 8px" }}>
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.title}
                    {CALIBRATION_SONG_IDS.includes(s.id as (typeof CALIBRATION_SONG_IDS)[number]) ? " (calibration)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 12, color: shell.textMuted }}>
            <input
              type="checkbox"
              checked={calibrationOnly}
              onChange={(e) => {
                setCalibrationOnly(e.target.checked);
                if (e.target.checked && !CALIBRATION_SONG_IDS.includes(songId as (typeof CALIBRATION_SONG_IDS)[number])) {
                  setSongId("real-001");
                }
              }}
            />
            Calibration only（real-001 / real-002）
          </label>
        </div>

        <div
          style={{
            ...panel,
            position: "sticky",
            top: 0,
            zIndex: 30,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <h2 style={{ fontSize: 13, margin: 0 }}>音源 · セクション · キュー</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" style={{ ...btnSecondary, padding: "5px 10px", fontSize: 12 }} onClick={addSection}>
                今の位置からセクション
              </button>
              <button type="button" style={{ ...btnAccent, padding: "5px 12px", fontSize: 12 }} onClick={() => addCueAt(now)}>
                今の位置にキュー
              </button>
            </div>
          </div>
          <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aiff" onChange={(e) => onAudioFile(e.target.files?.[0])} />
          {audioUrl ? (
            <div style={{ marginTop: 8 }}>
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                style={{ width: "100%", height: 36 }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
              />
              <p style={{ margin: "4px 0 6px", fontSize: 12, color: shell.textMuted, fontVariantNumeric: "tabular-nums" }}>
                再生 {formatClock(currentTime)} / {formatClock(duration)}
              </p>
              <AnnotateSongTimeline
                duration={duration}
                currentTime={currentTime}
                selectedCueId={selectedCueId}
                selectedSectionIndex={selectedSectionIndex}
                onSeek={seekTo}
                onSelectCue={(id) => {
                  setSelectedCueId(id);
                  setSelectedSectionIndex(null);
                }}
                onSelectSection={(index) => {
                  setSelectedSectionIndex(index);
                  setSelectedCueId(null);
                }}
                onCueTimeChange={setCueTime}
                onAddCueAt={addCueAt}
                sections={session.sections.map((s, index) => ({
                  index,
                  start: s.startTime,
                  end: s.endTime,
                  label: SECTION_TYPE_JA[s.type] ?? s.type,
                }))}
                cues={cuesByTime.map((row, n) => ({
                  id: row.id,
                  time: row.cue.time,
                  label: String(n + 1),
                }))}
              />
            </div>
          ) : (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: shell.textSubtle }}>ライセンス済み音源をここで開いてください。</p>
          )}

          {selectedSection ? (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${shell.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontSize: 12 }}>セクション {(selectedSectionIndex ?? 0) + 1}</strong>
                <button
                  type="button"
                  style={{ ...btnSecondary, padding: "3px 8px" }}
                  onClick={() => {
                    patch({ sections: session.sections.filter((_, j) => j !== selectedSectionIndex) });
                    setSelectedSectionIndex(null);
                  }}
                >
                  削除
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 8 }}>
                <TimeField
                  caption="開始"
                  value={selectedSection.startTime}
                  now={now}
                  onSeek={seekTo}
                  onChange={(startTime) => {
                    const next = [...session.sections];
                    next[selectedSectionIndex!] = { ...selectedSection, startTime };
                    patch({ sections: next });
                  }}
                />
                <TimeField
                  caption="終了"
                  value={selectedSection.endTime}
                  now={now}
                  onSeek={seekTo}
                  onChange={(endTime) => {
                    const next = [...session.sections];
                    next[selectedSectionIndex!] = { ...selectedSection, endTime };
                    patch({ sections: next });
                  }}
                />
                <div>
                  <span style={label}>種類</span>
                  <select
                    style={{ ...input, width: "100%" }}
                    value={selectedSection.type}
                    onChange={(e) => {
                      const next = [...session.sections];
                      next[selectedSectionIndex!] = { ...selectedSection, type: e.target.value as HumanSectionAnnotation["type"] };
                      patch({ sections: next });
                    }}
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {SECTION_TYPE_JA[t] ?? t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {session.sections.map((section, i) => (
              <button
                key={`secchip-${i}`}
                type="button"
                style={{
                  ...btnSecondary,
                  padding: "3px 8px",
                  fontSize: 11,
                  background: selectedSectionIndex === i ? shell.accentSoft : btnSecondary.backgroundColor,
                }}
                onClick={() => {
                  setSelectedSectionIndex(i);
                  setSelectedCueId(null);
                  seekTo(section.startTime);
                }}
              >
                {SECTION_TYPE_JA[section.type] ?? section.type} {formatClock(section.startTime)}–{formatClock(section.endTime)}
              </button>
            ))}
            {cuesByTime.map((row, n) => (
              <button
                key={row.id}
                type="button"
                style={{
                  ...btnSecondary,
                  padding: "3px 8px",
                  fontSize: 11,
                  background: selectedCueId === row.id ? shell.accentSoft : btnSecondary.backgroundColor,
                  borderColor: selectedCueId === row.id ? shell.accent : shell.borderStrong,
                }}
                onClick={() => {
                  setSelectedCueId(row.id);
                  setSelectedSectionIndex(null);
                  seekTo(row.cue.time);
                }}
              >
                Q{n + 1} {formatClock(row.cue.time)} {CUE_ACTION_JA[row.cue.action] ?? row.cue.action}
              </button>
            ))}
          </div>
        </div>

        {selectedCue && selectedCueId ? (
          <div style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
              <h2 style={{ fontSize: 13, margin: 0 }}>
                キュー {selectedCueOrder + 1} · {formatClock(selectedCue.time)}
              </h2>
              <button
                type="button"
                style={{ ...btnSecondary, padding: "3px 8px" }}
                onClick={() => {
                  patch({
                    cues: session.cues.filter((_, j) => j !== selectedCueIndex),
                    formations: session.formations.filter((f) => f.cueId !== selectedCueId),
                  });
                  setSelectedCueId(null);
                }}
              >
                このキューを削除
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <TimeField caption="時刻" value={selectedCue.time} now={now} onSeek={seekTo} onChange={(time) => setCueTime(selectedCueId, time)} />
              <div>
                <span style={label}>動き</span>
                <select
                  style={{ ...input, width: "100%" }}
                  value={selectedCue.action}
                  onChange={(e) => {
                    const next = [...session.cues];
                    next[selectedCueIndex] = { ...selectedCue, action: e.target.value as HumanCueAnnotation["action"] };
                    patch({ cues: next });
                  }}
                >
                  {CUE_ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {CUE_ACTION_JA[a] ?? a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span style={label}>変化</span>
                <select
                  style={{ ...input, width: "100%" }}
                  value={selectedCue.magnitude}
                  onChange={(e) => {
                    const next = [...session.cues];
                    next[selectedCueIndex] = { ...selectedCue, magnitude: e.target.value as HumanCueAnnotation["magnitude"] };
                    patch({ cues: next });
                  }}
                >
                  {CUE_MAGNITUDES.map((m) => (
                    <option key={m} value={m}>
                      {CUE_MAGNITUDE_JA[m] ?? m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ScoreSlider
              caption={`重要度 (${importanceBand(selectedCue.importance)})`}
              value={selectedCue.importance}
              onChange={(importance) => {
                const next = [...session.cues];
                next[selectedCueIndex] = { ...selectedCue, importance };
                patch({ cues: next });
              }}
            />
            <h3 style={{ fontSize: 13, margin: "10px 0 8px" }}>この瞬間の立ち位置</h3>
            <AnnotateMiniStage
              formationType={selectedRank1?.formationType || "LINE"}
              positions={layoutOf(selectedRank1).length ? layoutOf(selectedRank1) : layoutPreset("LINE", DEFAULT_DANCER_COUNT)}
              canCopyPrevious={Boolean(prevLayout?.layout?.positions.length)}
              onCopyPrevious={() => {
                if (!prevLayout) return;
                upsertFormation(defaultRank1(selectedCueId, prevLayout));
              }}
              onChange={({ positions, formationType }) => {
                const base = selectedRank1 ?? defaultRank1(selectedCueId, undefined);
                upsertFormation({
                  ...base,
                  formationType,
                  formationId: formationType,
                  layout: { dancerCount: positions.length, positions },
                });
              }}
            />
            <p style={{ fontSize: 11, color: shell.textSubtle, margin: "10px 0 6px" }}>他にあり得る形（任意）{FORMATION_RUBRIC.musicFit}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {([2, 3] as const).map((rank) => {
                const current = rankFor(selectedCueId, rank);
                return (
                  <div key={rank}>
                    <span style={label}>{rank}位</span>
                    <select style={{ ...input, width: "100%" }} value={current?.formationType ?? ""} onChange={(e) => setAltRank(selectedCueId, rank, e.target.value)}>
                      <option value="">—</option>
                      {FORMATION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {FORMATION_TYPE_JA[t] ?? t}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={panel}>
            <p style={{ margin: 0, fontSize: 13, color: shell.textMuted }}>バーのキューを選ぶか、「今の位置にキュー」で立ち位置を付けてください。</p>
          </div>
        )}

        <div style={panel}>
          <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>D. 曲全体の流れ</h2>
          <p style={{ fontSize: 12, color: shell.textSubtle, margin: "0 0 8px" }}>
            キューで置いた立ち位置の順番です。必要なら手で直してください。
          </p>
          <button type="button" style={{ ...btnSecondary, marginBottom: 10 }} onClick={fillSequenceFromCues}>
            キューの立ち位置から入れる
          </button>
          <input
            style={{ ...input, width: "100%", marginBottom: 12 }}
            value={sequence.formationIds.map((id) => FORMATION_TYPE_JA[id] ?? id).join(" → ")}
            onChange={(e) =>
              setSequence({
                ...sequence,
                songId,
                annotatorId,
                formationIds: e.target.value
                  .split(/[→,]/)
                  .map((x) => {
                    const text = x.trim();
                    const found = Object.entries(FORMATION_TYPE_JA).find(([, ja]) => ja === text);
                    return found?.[0] ?? text;
                  })
                  .filter(Boolean),
              })
            }
          />
          {(
            [
              ["musicStory", "曲との物語"],
              ["visualStory", "見た目の物語"],
              ["execution", "実際に踊れるか"],
              ["variety", "変化の幅"],
              ["overall", "総合"],
            ] as const
          ).map(([key, title]) => (
            <ScoreSlider
              key={key}
              caption={title}
              value={sequence[key]}
              onChange={(v) => setSequence({ ...sequence, songId, annotatorId, [key]: v })}
            />
          ))}
        </div>

        <div style={panel}>
          <p style={{ fontSize: 12, color: check.ok ? shell.accent : shell.ruby, margin: "0 0 12px" }}>
            {check.ok ? "Session JSON is valid." : check.warnings.map((w) => w.message).join(" / ")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btnAccent} onClick={download}>
              Download {songId}.json
            </button>
            <button type="button" style={btnSecondary} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: shell.textSubtle, margin: "12px 0 0" }}>
            保存先: pilot-dataset/annotations/{annotatorId}/{songId}.json （calibration 曲は
            calibration/{songId}/{annotatorId}.json にも同じ内容を置いてください）
          </p>
        </div>
      </div>
    </div>
  );
}

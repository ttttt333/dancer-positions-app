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
import type { HumanCueAnnotation, HumanFormationRating, HumanSectionAnnotation, HumanSequenceRating } from "../lib/choreocore/engine/types/EvaluationTypes";
import {
  CALIBRATION_SONG_IDS,
  CUE_ACTIONS,
  CUE_MAGNITUDES,
  FORMATION_TYPES,
  PILOT_ANNOTATORS,
  PILOT_SONGS,
  SECTION_TYPES,
  annotatorShort,
  draftKey,
  formatClock,
  parseClock,
} from "./annotation/pilotCatalog";

const pageWrap: CSSProperties = {
  minHeight: "100dvh",
  background: `radial-gradient(1200px 600px at 10% -10%, ${shell.brandGlow}, transparent 55%), ${shell.bgDeep}`,
  color: shell.text,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const card: CSSProperties = {
  maxWidth: 980,
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

const row: CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 8,
  alignItems: "end",
};

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
    if (raw) return JSON.parse(raw) as AnnotationSession;
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

export function AnnotationWorkbenchPage() {
  const [annotatorId, setAnnotatorId] = useState<string>(PILOT_ANNOTATORS[0]);
  const [calibrationOnly, setCalibrationOnly] = useState(true);
  const [songId, setSongId] = useState<string>("real-001");
  const [session, setSession] = useState<AnnotationSession>(() => loadDraft(PILOT_ANNOTATORS[0], "real-001"));
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const songs = useMemo(
    () => (calibrationOnly ? PILOT_SONGS.filter((s) => CALIBRATION_SONG_IDS.includes(s.id as (typeof CALIBRATION_SONG_IDS)[number])) : PILOT_SONGS),
    [calibrationOnly]
  );
  const song = PILOT_SONGS.find((s) => s.id === songId) ?? PILOT_SONGS[0]!;
  const instructions = useMemo(() => ANNOTATION_INSTRUCTIONS.split("\n"), []);
  const check = validateAnnotationSession(session);

  useEffect(() => {
    setSession(loadDraft(annotatorId, songId));
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
    const start = last?.endTime ?? 0;
    const next: HumanSectionAnnotation = {
      songId,
      annotatorId,
      startTime: start,
      endTime: Math.min(song.duration, start + 16),
      type: session.sections.length === 0 ? "INTRO" : "VERSE",
      confidence: 90,
    };
    patch({ sections: [...session.sections, next] });
  };

  const addCue = () => {
    const time = currentTime || (session.cues[session.cues.length - 1]?.time ?? 0) + 8;
    const next: HumanCueAnnotation = {
      songId,
      annotatorId,
      time,
      action: "MAJOR_CHANGE",
      magnitude: "MAX",
      importance: 90,
      confidence: 90,
      notes: "",
    };
    patch({ cues: [...session.cues, next] });
  };

  const cueIdOf = (cue: HumanCueAnnotation, index: number) => `cue-${cue.time.toFixed(2)}-${index}`;

  const setFormationTop3 = (cue: HumanCueAnnotation, index: number, rank: 1 | 2 | 3, formationType: string) => {
    const cueId = cueIdOf(cue, index);
    const others = session.formations.filter((f) => !(f.cueId === cueId && f.rank === rank));
    const defaults: Record<1 | 2 | 3, number> = { 1: 95, 2: 88, 3: 80 };
    const row: HumanFormationRating = {
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
    };
    patch({ formations: [...others, row].sort((a, b) => a.cueId.localeCompare(b.cueId) || (a.rank ?? 9) - (b.rank ?? 9)) });
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

  return (
    <div style={pageWrap}>
      <div style={card}>
        <p style={{ margin: "0 0 8px", color: shell.textSubtle, fontSize: 12 }}>
          <Link to="/" style={{ color: shell.accent }}>
            Home
          </Link>
          {" / evaluation / annotate"}
        </p>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>BLIND Annotation</h1>
        <p style={{ color: shell.textMuted, fontSize: 13, margin: "0 0 16px", lineHeight: 1.55 }}>
          AI の推奨は表示しません。自分ならどう振付するかを書いてください。最初は{" "}
          <strong>real-001 と real-002</strong> を3人全員が評価します。Schema {ANNOTATION_WORKFLOW_VERSION}.
        </p>

        <div style={panel}>
          <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>ルール</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: shell.textMuted, fontSize: 13, lineHeight: 1.65 }}>
            {instructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div style={panel}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <span style={label}>Annotator</span>
              <select value={annotatorId} onChange={(e) => setAnnotatorId(e.target.value)} style={{ ...input, width: "100%" }}>
                {PILOT_ANNOTATORS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={label}>Song</span>
              <select value={songId} onChange={(e) => setSongId(e.target.value)} style={{ ...input, width: "100%" }}>
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.title}
                    {CALIBRATION_SONG_IDS.includes(s.id as (typeof CALIBRATION_SONG_IDS)[number]) ? " (calibration)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 13, color: shell.textMuted }}>
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
          <p style={{ margin: "10px 0 0", fontSize: 12, color: shell.textSubtle }}>
            {song.structure} · {song.category} · {song.bpm} BPM · {formatClock(song.duration)} · {song.difficulty}
          </p>
        </div>

        <div style={panel}>
          <h2 style={{ fontSize: 14, margin: "0 0 8px" }}>Audio（ローカルのみ・リポジトリに保存しません）</h2>
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.aiff"
            onChange={(e) => onAudioFile(e.target.files?.[0])}
          />
          {audioUrl ? (
            <div style={{ marginTop: 12 }}>
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                style={{ width: "100%" }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />
              <p style={{ margin: "8px 0 0", fontSize: 12, color: shell.textMuted }}>
                Now {formatClock(currentTime)}
              </p>
            </div>
          ) : (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: shell.textSubtle }}>
              ブラウザはローカルパスを直接読めません。ライセンス済み音源をここで開いてください。
            </p>
          )}
        </div>

        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ fontSize: 14, margin: 0 }}>A. Section</h2>
            <button type="button" style={btnSecondary} onClick={addSection}>
              Add section
            </button>
          </div>
          {session.sections.map((section, i) => (
            <div key={`sec-${i}`} style={{ ...row, gridTemplateColumns: "1fr 1fr 1.2fr 80px 36px" }}>
              <div>
                <span style={label}>Start</span>
                <input
                  style={{ ...input, width: "100%" }}
                  value={formatClock(section.startTime)}
                  onChange={(e) => {
                    const next = [...session.sections];
                    next[i] = { ...section, startTime: parseClock(e.target.value) };
                    patch({ sections: next });
                  }}
                />
              </div>
              <div>
                <span style={label}>End</span>
                <input
                  style={{ ...input, width: "100%" }}
                  value={formatClock(section.endTime)}
                  onChange={(e) => {
                    const next = [...session.sections];
                    next[i] = { ...section, endTime: parseClock(e.target.value) };
                    patch({ sections: next });
                  }}
                />
              </div>
              <div>
                <span style={label}>Type</span>
                <select
                  style={{ ...input, width: "100%" }}
                  value={section.type}
                  onChange={(e) => {
                    const next = [...session.sections];
                    next[i] = { ...section, type: e.target.value as HumanSectionAnnotation["type"] };
                    patch({ sections: next });
                  }}
                >
                  {SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span style={label}>Conf</span>
                <input
                  style={{ ...input, width: "100%" }}
                  type="number"
                  min={0}
                  max={100}
                  value={section.confidence > 1 ? section.confidence : Math.round(section.confidence * 100)}
                  onChange={(e) => {
                    const next = [...session.sections];
                    next[i] = { ...section, confidence: Number(e.target.value) };
                    patch({ sections: next });
                  }}
                />
              </div>
              <button
                type="button"
                style={{ ...btnSecondary, padding: "7px 8px" }}
                onClick={() => patch({ sections: session.sections.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ fontSize: 14, margin: 0 }}>B. Cue</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => {
                  const time = audioRef.current?.currentTime ?? currentTime;
                  const next: HumanCueAnnotation = {
                    songId,
                    annotatorId,
                    time,
                    action: "MAJOR_CHANGE",
                    magnitude: "MAX",
                    importance: 90,
                    confidence: 90,
                    notes: "",
                  };
                  patch({ cues: [...session.cues, next] });
                }}
              >
                Add cue at now
              </button>
              <button type="button" style={btnSecondary} onClick={addCue}>
                Add cue
              </button>
            </div>
          </div>
          {session.cues.map((cue, i) => (
            <div key={`cue-${i}`} style={{ borderTop: i ? `1px solid ${shell.border}` : undefined, paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
              <div style={{ ...row, gridTemplateColumns: "1fr 1.2fr 1fr 1fr 80px 36px" }}>
                <div>
                  <span style={label}>Time</span>
                  <input
                    style={{ ...input, width: "100%" }}
                    value={formatClock(cue.time)}
                    onChange={(e) => {
                      const next = [...session.cues];
                      next[i] = { ...cue, time: parseClock(e.target.value) };
                      patch({ cues: next });
                    }}
                  />
                </div>
                <div>
                  <span style={label}>Action</span>
                  <select
                    style={{ ...input, width: "100%" }}
                    value={cue.action}
                    onChange={(e) => {
                      const next = [...session.cues];
                      next[i] = { ...cue, action: e.target.value as HumanCueAnnotation["action"] };
                      patch({ cues: next });
                    }}
                  >
                    {CUE_ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span style={label}>Magnitude</span>
                  <select
                    style={{ ...input, width: "100%" }}
                    value={cue.magnitude}
                    onChange={(e) => {
                      const next = [...session.cues];
                      next[i] = { ...cue, magnitude: e.target.value as HumanCueAnnotation["magnitude"] };
                      patch({ cues: next });
                    }}
                  >
                    {CUE_MAGNITUDES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span style={label}>Importance ({importanceBand(cue.importance)})</span>
                  <input
                    style={{ ...input, width: "100%" }}
                    type="number"
                    min={0}
                    max={100}
                    value={cue.importance}
                    onChange={(e) => {
                      const next = [...session.cues];
                      next[i] = { ...cue, importance: Number(e.target.value) };
                      patch({ cues: next });
                    }}
                  />
                </div>
                <div>
                  <span style={label}>Conf</span>
                  <input
                    style={{ ...input, width: "100%" }}
                    type="number"
                    min={0}
                    max={100}
                    value={cue.confidence > 1 ? cue.confidence : Math.round(cue.confidence * 100)}
                    onChange={(e) => {
                      const next = [...session.cues];
                      next[i] = { ...cue, confidence: Number(e.target.value) };
                      patch({ cues: next });
                    }}
                  />
                </div>
                <button
                  type="button"
                  style={{ ...btnSecondary, padding: "7px 8px" }}
                  onClick={() => patch({ cues: session.cues.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
              <p style={{ fontSize: 12, color: shell.textSubtle, margin: "4px 0 8px" }}>C. Formation Top 3 for this cue</p>
              <div style={{ ...row, gridTemplateColumns: "1fr 1fr 1fr" }}>
                {([1, 2, 3] as const).map((rank) => {
                  const current = session.formations.find((f) => f.cueId === cueIdOf(cue, i) && f.rank === rank);
                  return (
                    <div key={rank}>
                      <span style={label}>
                        {rank}位 {rank === 1 ? FORMATION_RUBRIC.musicFit : ""}
                      </span>
                      <select
                        style={{ ...input, width: "100%" }}
                        value={current?.formationType ?? ""}
                        onChange={(e) => setFormationTop3(cue, i, rank, e.target.value)}
                      >
                        <option value="">—</option>
                        {FORMATION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={panel}>
          <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>D. Sequence</h2>
          <p style={{ fontSize: 12, color: shell.textSubtle, margin: "0 0 8px" }}>
            曲全体の Formation の流れ。カンマ区切り（例: WIDE_V, CENTER_WINGS, PYRAMID）
          </p>
          <input
            style={{ ...input, width: "100%", marginBottom: 12 }}
            value={sequence.formationIds.join(", ")}
            onChange={(e) =>
              setSequence({
                ...sequence,
                songId,
                annotatorId,
                formationIds: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
          {(
            [
              ["musicStory", "Music story"],
              ["visualStory", "Visual story"],
              ["execution", "Execution"],
              ["variety", "Variety"],
              ["overall", "Overall"],
            ] as const
          ).map(([key, title]) => (
            <label key={key} style={{ display: "grid", gridTemplateColumns: "140px 1fr 48px", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: shell.textMuted }}>{title}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={sequence[key]}
                onChange={(e) => setSequence({ ...sequence, songId, annotatorId, [key]: Number(e.target.value) })}
              />
              <span>{sequence[key]}</span>
            </label>
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

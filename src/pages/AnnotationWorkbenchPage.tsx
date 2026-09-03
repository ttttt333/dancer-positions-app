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
import {
  adoptAnnotationSession,
  deleteSavedAnnotation,
  listExtraSongs,
  listSavedAnnotations,
  listSavedAnnotationsForSong,
  loadSavedAnnotation,
  parseAnnotationFile,
  saveAnnotation,
  upsertExtraSong,
  type SavedAnnotationMeta,
} from "./annotation/annotateLibrary";
import { AnnotateSongTimeline, ScoreSlider, TimeField, resolveCueWindows } from "./annotation/annotateUi";
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
  annotatorLabel,
  annotatorShort,
  draftKey,
  formatClock,
} from "./annotation/pilotCatalog";
import {
  extraSongCardFromProject,
  isChoreographyProjectJson,
  projectToAnnotationSession,
  runQualityGatesForSong,
  type RealSongGateReport,
} from "../lib/choreocore/lightingSync";
import { computeWavePeaksFromAudioBuffer } from "../lib/computeWavePeaksFromChannelData";
import {
  currentSnapshot,
  emptyHistory,
  pushSnapshot,
  redoAll,
  redoStep,
  undoAll,
  undoStep,
  writeLocalJson,
  clearBlindHistoryStorage,
  type SessionHistory,
} from "./annotation/sessionHistory";

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

function emptySession(
  annotatorId: string,
  songId: string,
  songMeta?: { duration: number; bpm: number }
): AnnotationSession {
  const song =
    songMeta ??
    PILOT_SONGS.find((s) => s.id === songId) ??
    PILOT_SONGS[0]!;
  return createAnnotationSession({
    songId,
    annotatorId,
    duration: song.duration,
    bpm: song.bpm,
    mode: "BLIND",
    id: `ann-${songId}-${annotatorShort(annotatorId)}`,
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
  const extra = listExtraSongs().find((s) => s.id === songId);
  return emptySession(annotatorId, songId, extra);
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

function standingNameFor(formationType: string | undefined, custom?: string): string {
  const trimmed = custom?.trim();
  if (trimmed) return trimmed;
  const type = formationType || "LINE";
  return FORMATION_TYPE_JA[type] ?? type;
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1);
  const dd = String(d.getDate());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function loadHistory(_annotatorId: string, _songId: string, draft: AnnotationSession): SessionHistory {
  clearBlindHistoryStorage();
  return emptyHistory(draft);
}

clearBlindHistoryStorage();

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
  const [histMeta, setHistMeta] = useState({ index: 0, length: 1 });
  const [saveId, setSaveId] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saves, setSaves] = useState<SavedAnnotationMeta[]>(() => listSavedAnnotations());
  const [extraSongs, setExtraSongs] = useState(() => listExtraSongs());
  const [gateReport, setGateReport] = useState<RealSongGateReport | null>(null);
  const [gateHint, setGateHint] = useState("");
  const [gateRunning, setGateRunning] = useState(false);
  const [saveHint, setSaveHint] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const skipSongLoadRef = useRef(false);
  const jsonFileRef = useRef<HTMLInputElement | null>(null);
  const sessionRef = useRef(session);
  const historyRef = useRef<SessionHistory>(emptyHistory(session));
  const lastPushRef = useRef(0);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const composingNameRef = useRef(false);
  const [nameDraft, setNameDraft] = useState("");
  sessionRef.current = session;

  const songs = useMemo(() => {
    const pilots = calibrationOnly
      ? PILOT_SONGS.filter((s) =>
          CALIBRATION_SONG_IDS.includes(s.id as (typeof CALIBRATION_SONG_IDS)[number])
        )
      : PILOT_SONGS;
    const extras = extraSongs.filter((s) => !pilots.some((p) => p.id === s.id));
    return [...pilots, ...extras];
  }, [calibrationOnly, extraSongs]);
  const song =
    songs.find((s) => s.id === songId) ??
    extraSongs.find((s) => s.id === songId) ??
    PILOT_SONGS[0]!;
  const duration = audioDuration > 0 ? audioDuration : song.duration || session.duration;
  const instructions = useMemo(() => ANNOTATION_INSTRUCTIONS.split("\n"), []);
  const check = validateAnnotationSession(session);
  const now = audioRef.current?.currentTime ?? currentTime;

  useEffect(() => {
    if (skipSongLoadRef.current) {
      skipSongLoadRef.current = false;
      return;
    }
    const next = loadDraft(annotatorId, songId);
    sessionRef.current = next;
    setSession(next);
    historyRef.current = loadHistory(annotatorId, songId, next);
    lastPushRef.current = 0;
    setHistMeta({ index: historyRef.current.index, length: historyRef.current.stack.length });
    setSelectedCueId(next.cues[0] ? cueIdOf(next.cues[0], 0) : null);
    setSelectedSectionIndex(null);
    setSaveId(null);
    setSaveTitle("");
  }, [annotatorId, songId]);

  useEffect(() => {
    if (session.songId !== songId || session.annotatorId !== annotatorId) return;
    writeLocalJson(draftKey(annotatorId, songId), session);
  }, [annotatorId, songId, session]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const persistHistory = useCallback(() => {
    setHistMeta({ index: historyRef.current.index, length: historyRef.current.stack.length });
  }, []);

  const applyHistory = useCallback(
    (nextHistory: SessionHistory) => {
      const snap = currentSnapshot(nextHistory);
      if (!snap) return;
      historyRef.current = nextHistory;
      lastPushRef.current = 0;
      sessionRef.current = snap;
      setSession(snap);
      persistHistory();
    },
    [persistHistory]
  );

  const patch = useCallback(
    (next: Partial<AnnotationSession>) => {
      const merged: AnnotationSession = {
        ...sessionRef.current,
        ...next,
        mode: "BLIND",
        version: ANNOTATION_WORKFLOW_VERSION,
      };
      sessionRef.current = merged;
      setSession(merged);
      const pushed = pushSnapshot(historyRef.current, merged, Date.now(), lastPushRef.current);
      historyRef.current = pushed.history;
      lastPushRef.current = pushed.lastPushAt;
      persistHistory();
    },
    [persistHistory]
  );

  const undo = useCallback(() => applyHistory(undoStep(historyRef.current)), [applyHistory]);
  const redo = useCallback(() => applyHistory(redoStep(historyRef.current)), [applyHistory]);
  const undoToStart = useCallback(() => applyHistory(undoAll(historyRef.current)), [applyHistory]);
  const redoToEnd = useCallback(() => applyHistory(redoAll(historyRef.current)), [applyHistory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      e.preventDefault();
      if (key === "y" || e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

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
    a.download = `${annotatorId}-${songId}.json`;
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

  const applyLoadedSession = (
    nextRaw: AnnotationSession,
    options?: { save?: { id: string; title: string }; adopt?: boolean },
  ) => {
    const next = withCueIds(options?.adopt ? adoptAnnotationSession(nextRaw, annotatorId) : nextRaw);
    if (next.annotatorId !== annotatorId || next.songId !== songId) {
      skipSongLoadRef.current = true;
    }
    if (!(CALIBRATION_SONG_IDS as readonly string[]).includes(next.songId)) {
      setCalibrationOnly(false);
    }
    if (!options?.adopt) setAnnotatorId(next.annotatorId);
    setSongId(next.songId);
    sessionRef.current = next;
    setSession(next);
    historyRef.current = emptyHistory(next);
    lastPushRef.current = 0;
    setHistMeta({ index: 0, length: 1 });
    setSelectedCueId(next.cues[0] ? cueIdOf(next.cues[0], 0) : null);
    setSelectedSectionIndex(null);
    setSaveId(options?.save?.id ?? null);
    setSaveTitle(options?.save?.title ?? "");
    writeLocalJson(draftKey(next.annotatorId, next.songId), next);
  };

  const sessionHasWork = (row: AnnotationSession) => row.cues.length > 0 || row.sections.length > 0;

  const confirmReplaceCurrent = (message: string) => {
    if (!sessionHasWork(sessionRef.current)) return true;
    return window.confirm(message);
  };

  const onSaveNamed = () => {
    const current = sessionRef.current;
    const meta = saveAnnotation(current, saveTitle || `${current.songId} (${current.cues.length}キュー)`, saveId ?? undefined);
    if (!meta) {
      setSaveHint("保存できませんでした。容量を空けてからもう一度試してください。");
      return;
    }
    setSaveId(meta.id);
    setSaveTitle(meta.title);
    setSaves(listSavedAnnotations());
    setSaveHint("保存しました");
  };

  const onNewSession = () => {
    if (!confirmReplaceCurrent("今の内容を閉じて新規にします。先に「保存」していない変更は消えます。よろしいですか？")) return;
    applyLoadedSession(emptySession(annotatorId, songId));
    setSaveHint("新規を開きました");
  };

  const onRecallSave = (id: string) => {
    const loaded = loadSavedAnnotation(id);
    if (!loaded) {
      setSaveHint("呼び出せませんでした");
      return;
    }
    const meta = saves.find((row) => row.id === id);
    applyLoadedSession(loaded, meta ? { save: { id: meta.id, title: meta.title } } : undefined);
    setSaveHint("呼び出しました");
  };

  const onAdoptSave = (id: string) => {
    const loaded = loadSavedAnnotation(id);
    if (!loaded) {
      setSaveHint("読み込めませんでした");
      return;
    }
    const sourceLabel = annotatorLabel(loaded.annotatorId);
    if (
      !confirmReplaceCurrent(
        `${sourceLabel}の保存を、今の${annotatorLabel(annotatorId)}用にコピーします。曲の構成（セクション・キュー時刻）はそのまま残します。先に「保存」していない変更は消えます。よろしいですか？`,
      )
    ) {
      return;
    }
    applyLoadedSession(loaded, { adopt: true });
    setSaveHint(`${sourceLabel}の曲構成をコピーしました。立ち位置などをアレンジして、自分の名前で保存してください。`);
  };

  const onDeleteSave = (id: string) => {
    if (!window.confirm("この保存を削除しますか？")) return;
    deleteSavedAnnotation(id);
    if (saveId === id) setSaveId(null);
    setSaves(listSavedAnnotations());
    setSaveHint("削除しました");
  };

  const onOpenJsonFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? "");
        const parsed = JSON.parse(raw) as unknown;
        if (isChoreographyProjectJson(parsed)) {
          if (
            !confirmReplaceCurrent(
              `${file.name} はエディタの作品です。実曲注釈として取り込みます。先に「保存」していない変更は消えます。よろしいですか？`
            )
          ) {
            return;
          }
          const card = extraSongCardFromProject(parsed);
          const imported = projectToAnnotationSession(parsed, {
            annotatorId,
            songId: card.id,
          });
          setExtraSongs(upsertExtraSong(card));
          setCalibrationOnly(false);
          applyLoadedSession(imported, { adopt: true });
          setSaveHint(`${file.name} を実曲注釈として取り込みました（${imported.cues.length}キュー）。保存してから品質ゲートを回せます。`);
          return;
        }
        const loaded = parseAnnotationFile(raw);
        const sourceLabel = annotatorLabel(loaded.annotatorId);
        const samePerson = loaded.annotatorId === annotatorId;
        if (
          !confirmReplaceCurrent(
            samePerson
              ? `${file.name} を開きます。先に「保存」していない変更は消えます。よろしいですか？`
              : `${file.name}（${sourceLabel}）を、今の${annotatorLabel(annotatorId)}用にコピーします。曲の構成はそのまま残します。先に「保存」していない変更は消えます。よろしいですか？`,
          )
        ) {
          return;
        }
        applyLoadedSession(loaded, { adopt: !samePerson });
        setSaveHint(
          samePerson
            ? `${file.name} を開きました`
            : `${file.name}（${sourceLabel}）の曲構成をコピーしました。立ち位置などをアレンジして、自分の名前で保存してください。`,
        );
      } catch {
        setSaveHint("JSONを開けませんでした");
      }
    };
    reader.readAsText(file);
  };

  const onRunQualityGates = async () => {
    setGateRunning(true);
    setGateHint("");
    try {
      const byAnnotator = new Map<string, AnnotationSession>();
      for (const meta of listSavedAnnotationsForSong(songId)) {
        const loaded = loadSavedAnnotation(meta.id);
        if (loaded && loaded.cues.length > 0) byAnnotator.set(loaded.annotatorId, loaded);
      }
      if (session.cues.length > 0) {
        byAnnotator.set(session.annotatorId, session);
      }
      const sessions = [...byAnnotator.values()];
      if (sessions.length === 0) {
        setGateHint("この曲の注釈にキューがありません。キューを付けて保存するか、作品 JSON を取り込んでください。");
        setGateReport(null);
        return;
      }
      let peaks: number[] | undefined;
      if (audioUrl) {
        try {
          const ctx = new AudioContext();
          const buf = await fetch(audioUrl).then((r) => r.arrayBuffer());
          const audio = await ctx.decodeAudioData(buf);
          peaks = computeWavePeaksFromAudioBuffer(audio, 512);
          await ctx.close();
        } catch {
          peaks = undefined;
        }
      }
      const report = runQualityGatesForSong({ sessions, peaks });
      setGateReport(report);
      const passed = report.gates.filter((g) => g.verdict === "PASS").length;
      setGateHint(
        `注釈${report.annotatorCount}人` +
          (report.usedConsensus ? "（合意）" : "") +
          (report.ceilingEstimated ? " · Human Ceiling は1人のため参考値" : "") +
          (peaks ? " · 実音源" : " · セクションからピーク合成") +
          ` · ゲート ${passed}/${report.gates.length} PASS`
      );
    } catch (err) {
      setGateReport(null);
      setGateHint(err instanceof Error ? err.message : "品質ゲートを実行できませんでした");
    } finally {
      setGateRunning(false);
    }
  };

  const addSection = () => {
    const current = sessionRef.current;
    const last = current.sections[current.sections.length - 1];
    const start = last ? last.endTime : now || 0;
    const next: HumanSectionAnnotation = {
      songId,
      annotatorId,
      startTime: start,
      endTime: Math.min(duration, start + 16),
      type: current.sections.length === 0 ? "INTRO" : "VERSE",
      confidence: 90,
    };
    patch({ sections: [...current.sections, next] });
    setSelectedSectionIndex(current.sections.length);
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
    const current = sessionRef.current;
    const cue = makeCue(time);
    const t = Math.max(0, Math.round(time * 10) / 10);
    cue.time = t;
    const nextList = [...current.cues, cue].map((c, i) => ({ ...c, id: cueIdOf(c, i) }));
    const sorted = [...nextList].sort((a, b) => a.time - b.time);
    const idx = sorted.findIndex((c) => c.id === cue.id);
    const added = idx >= 0 ? sorted[idx] : undefined;
    const prev = idx > 0 ? sorted[idx - 1] : undefined;
    const following = idx >= 0 ? sorted[idx + 1] : undefined;
    if (prev && (prev.holdEnd == null || prev.holdEnd > t)) {
      prev.holdEnd = t;
    }
    if (added) added.holdEnd = following?.time ?? duration;
    patch({ cues: sorted, formations: [...current.formations, defaultRank1(cue.id!, undefined)] });
    setSelectedCueId(cue.id!);
    setSelectedSectionIndex(null);
    seekTo(t);
  };

  const setCueTime = (id: string, time: number) => {
    patch({
      cues: sessionRef.current.cues.map((cue, i) => {
        if (cueIdOf(cue, i) !== id) return cue;
        const t = Math.max(0, time);
        const holdEnd = cue.holdEnd != null && cue.holdEnd < t + 0.1 ? t + 0.1 : cue.holdEnd;
        return { ...cue, id, time: t, holdEnd };
      }),
    });
  };

  const setCueHoldEnd = (id: string, holdEnd: number) => {
    patch({
      cues: sessionRef.current.cues.map((cue, i) => (cueIdOf(cue, i) === id ? { ...cue, id, holdEnd: Math.max(cue.time + 0.1, holdEnd) } : cue)),
    });
  };

  const defaultRank1 = (cueId: string, from: HumanFormationRating | undefined): HumanFormationRating => {
    const source = from?.layout?.positions ?? layoutPreset("LINE", from?.layout?.dancerCount ?? DEFAULT_DANCER_COUNT);
    const positions = source.map((spot) => ({ ...spot }));
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
      name: standingNameFor(formationType),
    };
  };

  const rankFor = (cueId: string, rank: 1 | 2 | 3) =>
    session.formations.find((f) => f.cueId === cueId && f.rank === rank);

  const upsertFormation = (row: HumanFormationRating) => {
    const others = sessionRef.current.formations.filter((f) => !(f.cueId === row.cueId && f.rank === row.rank));
    patch({
      formations: [...others, row].sort((a, b) => a.cueId.localeCompare(b.cueId) || (a.rank ?? 9) - (b.rank ?? 9)),
    });
  };

  const setAltRank = (cueId: string, rank: 2 | 3, formationType: string) => {
    if (!formationType) {
      patch({ formations: sessionRef.current.formations.filter((f) => !(f.cueId === cueId && f.rank === rank)) });
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
    const ids = [...session.cues]
      .map((cue, i) => ({ cue, id: cueIdOf(cue, i) }))
      .sort((a, b) => a.cue.time - b.cue.time)
      .map((row) => {
        const rank = rankFor(row.id, 1);
        if (!rank) return "";
        return standingNameFor(rank.formationType, rank.name);
      })
      .filter(Boolean);
    setSequence({ ...sequence, songId, annotatorId, formationIds: ids });
  };

  const selectedCueIndex = session.cues.findIndex((c, i) => cueIdOf(c, i) === selectedCueId);
  const selectedCue = selectedCueIndex >= 0 ? session.cues[selectedCueIndex]! : null;
  const cuesByTime = session.cues
    .map((cue, i) => ({ cue, i, id: cueIdOf(cue, i) }))
    .sort((a, b) => a.cue.time - b.cue.time);
  const selectedCueOrder = selectedCueId ? cuesByTime.findIndex((row) => row.id === selectedCueId) : -1;
  const prevCueRow = selectedCueOrder > 0 ? cuesByTime[selectedCueOrder - 1] : undefined;
  const nextCueRow = selectedCueOrder >= 0 && selectedCueOrder < cuesByTime.length - 1 ? cuesByTime[selectedCueOrder + 1] : undefined;
  const prevLayout = prevCueRow ? rankFor(prevCueRow.id, 1) : undefined;
  const nextLayout = nextCueRow ? rankFor(nextCueRow.id, 1) : undefined;
  const selectedRank1 = selectedCueId ? rankFor(selectedCueId, 1) : undefined;
  const selectedSection = selectedSectionIndex != null ? session.sections[selectedSectionIndex] : undefined;
  const cueWindows = resolveCueWindows(
    cuesByTime.map((row, n) => ({
      id: row.id,
      time: row.cue.time,
      holdEnd: row.cue.holdEnd,
      label: String(n + 1),
      name: rankFor(row.id, 1)?.name?.trim() || undefined,
    })),
    duration
  );
  const selectedWindow = selectedCueId ? cueWindows.find((w) => w.id === selectedCueId) : undefined;
  const undoEnabled = histMeta.index > 0;
  const redoEnabled = histMeta.index < histMeta.length - 1;
  const mySaves = useMemo(() => saves.filter((row) => row.annotatorId === annotatorId), [saves, annotatorId]);
  const otherSaves = useMemo(
    () =>
      saves
        .filter((row) => row.annotatorId !== annotatorId)
        .slice()
        .sort((a, b) => Number(b.songId === songId) - Number(a.songId === songId) || (a.savedAt < b.savedAt ? 1 : -1)),
    [saves, annotatorId, songId]
  );

  useEffect(() => {
    if (!selectedCueId) return;
    if (session.cues.some((cue, i) => cueIdOf(cue, i) === selectedCueId)) return;
    setSelectedCueId(session.cues[0] ? cueIdOf(session.cues[0], 0) : null);
  }, [session, selectedCueId]);

  useEffect(() => {
    if (composingNameRef.current) return;
    if (typeof document !== "undefined" && document.activeElement === nameInputRef.current) return;
    setNameDraft(standingNameFor(selectedRank1?.formationType, selectedRank1?.name));
  }, [selectedCueId, selectedRank1?.name, selectedRank1?.formationType]);

  const focusNameField = () => {
    window.requestAnimationFrame(() => {
      const el = nameInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  };

  const commitCueName = (raw: string) => {
    if (!selectedCueId) return;
    const current = sessionRef.current.formations.find((f) => f.cueId === selectedCueId && f.rank === 1);
    const base = current ?? defaultRank1(selectedCueId, undefined);
    const name = standingNameFor(base.formationType, raw);
    upsertFormation({ ...base, name });
    setNameDraft(name);
  };

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

        <div style={panel}>
          <h2 style={{ fontSize: 13, margin: "0 0 10px" }}>保存 · 呼び出し</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
            <div style={{ flex: "1 1 220px" }}>
              <span style={label}>保存名</span>
              <input
                style={{ ...input, width: "100%" }}
                value={saveTitle}
                placeholder={`${songId} (${session.cues.length}キュー)`}
                onChange={(e) => setSaveTitle(e.target.value)}
              />
            </div>
            <button type="button" style={{ ...btnAccent, padding: "7px 14px", fontSize: 12 }} onClick={onSaveNamed}>
              保存
            </button>
            <button type="button" style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12 }} onClick={onNewSession}>
              新規作成
            </button>
            <button type="button" style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12 }} onClick={() => jsonFileRef.current?.click()}>
              JSON / 作品を開く
            </button>
            <input
              ref={jsonFileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                onOpenJsonFile(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </div>
          {saveHint ? (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: shell.accent }}>{saveHint}</p>
          ) : (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: shell.textSubtle }}>
              このページ内に名前を付けて保存できます。下書きは曲ごとに自動でも残ります。他のコレオグラファーの保存や JSON
              は、曲の構成（セクション・キュー時刻）を残したまま自分用にコピーしてアレンジできます。エディタの作品 JSON も実曲注釈として取り込めます。JSON を開く前に、上で自分のコレオグラファーを選んでください。
            </p>
          )}
          {saves.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: shell.textMuted }}>まだ保存はありません。</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {mySaves.length > 0 ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, color: shell.textSubtle }}>{annotatorLabel(annotatorId)}の保存</p>
                  {mySaves.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${saveId === row.id ? shell.accent : shell.border}`,
                        background: saveId === row.id ? shell.accentSoft : "transparent",
                      }}
                    >
                      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{row.title}</div>
                        <div style={{ fontSize: 11, color: shell.textSubtle }}>
                          {row.songId} · {row.cueCount}キュー · {formatSavedAt(row.savedAt)}
                        </div>
                      </div>
                      <button type="button" style={{ ...btnAccent, padding: "4px 10px", fontSize: 12 }} onClick={() => onRecallSave(row.id)}>
                        呼び出す
                      </button>
                      <button type="button" style={{ ...btnSecondary, padding: "4px 10px", fontSize: 12 }} onClick={() => onDeleteSave(row.id)}>
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: shell.textMuted }}>{annotatorLabel(annotatorId)}の保存はまだありません。</p>
              )}
              {otherSaves.length > 0 ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, color: shell.textSubtle }}>他のコレオグラファーの保存（この構成で始める）</p>
                  {otherSaves.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${shell.border}`,
                      }}
                    >
                      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{row.title}</div>
                        <div style={{ fontSize: 11, color: shell.textSubtle }}>
                          {annotatorLabel(row.annotatorId)} · {row.songId} · {row.cueCount}キュー · {formatSavedAt(row.savedAt)}
                        </div>
                      </div>
                      <button type="button" style={{ ...btnAccent, padding: "4px 10px", fontSize: 12 }} onClick={() => onAdoptSave(row.id)}>
                        この構成で始める
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div style={panel}>
          <h2 style={{ fontSize: 13, margin: "0 0 8px" }}>品質ゲート（本番エンジン）</h2>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: shell.textSubtle, lineHeight: 1.5 }}>
            この曲の保存済み注釈（と今の下書き）を人手ラベルにして、いまの曲理解エンジンを採点します。音源を載せているときは実ピーク、なければセクションから合成します。2人以上いると合意ラベルと Human Ceiling を使います。
          </p>
          <button
            type="button"
            style={{ ...btnAccent, padding: "7px 14px", fontSize: 12, opacity: gateRunning ? 0.6 : 1 }}
            disabled={gateRunning}
            onClick={() => void onRunQualityGates()}
          >
            {gateRunning ? "実行中…" : "この曲でゲートを回す"}
          </button>
          {gateHint ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: shell.accent }}>{gateHint}</p>
          ) : null}
          {gateReport ? (
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: gateReport.overall === "PASS" ? "#4ade80" : gateReport.overall === "WATCH" ? "#fbbf24" : "#f87171" }}>
                総合 {gateReport.overall} · Cue F1 {(gateReport.evaluation.cueMetrics.f1 * 100).toFixed(0)}%
              </p>
              {gateReport.gates.map((g) => {
                const color = g.verdict === "PASS" ? "#4ade80" : g.verdict === "WATCH" ? "#fbbf24" : "#f87171";
                return (
                  <div key={g.id} style={{ display: "flex", gap: 10, fontSize: 12, color: shell.text, flexWrap: "wrap" }}>
                    <span style={{ minWidth: 52, fontWeight: 700, color }}>{g.verdict}</span>
                    <span style={{ flex: "1 1 140px" }}>{g.label}</span>
                    <span style={{ color: shell.textSubtle, fontVariantNumeric: "tabular-nums" }}>
                      {(g.actual * 100).toFixed(0)} / 目標 {(g.target * 100).toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
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
              <button type="button" style={{ ...btnSecondary, padding: "5px 10px", fontSize: 12, opacity: undoEnabled ? 1 : 0.4 }} disabled={!undoEnabled} onClick={undo} title="⌘Z">
                戻す
              </button>
              <button type="button" style={{ ...btnSecondary, padding: "5px 10px", fontSize: 12, opacity: redoEnabled ? 1 : 0.4 }} disabled={!redoEnabled} onClick={redo} title="⇧⌘Z">
                進む
              </button>
              <button type="button" style={{ ...btnSecondary, padding: "5px 10px", fontSize: 12, opacity: undoEnabled ? 1 : 0.4 }} disabled={!undoEnabled} onClick={undoToStart}>
                最初まで戻す
              </button>
              <button type="button" style={{ ...btnSecondary, padding: "5px 10px", fontSize: 12, opacity: redoEnabled ? 1 : 0.4 }} disabled={!redoEnabled} onClick={redoToEnd}>
                最新まで進む
              </button>
              <span style={{ alignSelf: "center", fontSize: 11, color: shell.textSubtle, fontVariantNumeric: "tabular-nums" }}>
                {histMeta.index + 1}/{histMeta.length}
              </span>
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
                onCueHoldEndChange={setCueHoldEnd}
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
                  holdEnd: row.cue.holdEnd,
                  label: String(n + 1),
                  name: rankFor(row.id, 1)?.name?.trim() || undefined,
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
            {cuesByTime.map((row, n) => {
              const customName = rankFor(row.id, 1)?.name?.trim();
              return (
              <button
                key={row.id}
                type="button"
                style={{
                  ...btnSecondary,
                  padding: "3px 8px",
                  fontSize: 11,
                  background: selectedCueId === row.id ? "rgba(196,30,58,0.2)" : btnSecondary.backgroundColor,
                  borderColor: selectedCueId === row.id ? shell.ruby : "rgba(196,30,58,0.45)",
                  color: shell.text,
                }}
                onClick={() => {
                  setSelectedCueId(row.id);
                  setSelectedSectionIndex(null);
                  seekTo(row.cue.time);
                }}
              >
                Q{n + 1}
                {customName ? ` ${customName}` : ""} {formatClock(row.cue.time)}–{formatClock(cueWindows[n]?.holdEnd ?? row.cue.time)}
                {cueWindows[n]?.hasMove ? ` →移動` : ""}
              </button>
              );
            })}
          </div>
        </div>

        {selectedCue && selectedCueId ? (
          <div style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
              <h2 style={{ fontSize: 13, margin: 0 }}>
                キュー {selectedCueOrder + 1}
                {selectedRank1?.name?.trim() ? ` · ${selectedRank1.name.trim()}` : ""}
                {selectedWindow
                  ? ` · 立ち位置 ${formatClock(selectedWindow.time)}–${formatClock(selectedWindow.holdEnd)}`
                  : ` · ${formatClock(selectedCue.time)}`}
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
            {selectedWindow ? (
              <p style={{ margin: "0 0 8px", fontSize: 12, color: shell.textMuted, lineHeight: 1.55 }}>
                立ち位置 {formatClock(selectedWindow.time)}–{formatClock(selectedWindow.holdEnd)}
                {selectedWindow.hasMove
                  ? `　／　移動 ${formatClock(selectedWindow.holdEnd)}–${formatClock(selectedWindow.nextTime)}（${(selectedWindow.nextTime - selectedWindow.holdEnd).toFixed(1)}秒）`
                  : "　／　移動なし（次の形までこの立ち位置）"}
              </p>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <TimeField
                caption="この形の開始"
                value={selectedCue.time}
                now={now}
                onSeek={seekTo}
                onChange={(time) => setCueTime(selectedCueId, time)}
              />
              <TimeField
                caption="移動開始（この形の終わり）"
                value={selectedWindow?.holdEnd ?? selectedCue.holdEnd ?? selectedCue.time}
                now={now}
                onSeek={seekTo}
                onChange={(holdEnd) => setCueHoldEnd(selectedCueId, holdEnd)}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
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
            <div style={{ marginBottom: 8 }}>
              <span style={label}>立ち位置の名前</span>
              <input
                ref={nameInputRef}
                style={{ ...input, width: "100%" }}
                value={nameDraft}
                autoComplete="off"
                spellCheck={false}
                placeholder="ピラミッド、2列（広め）など"
                onChange={(e) => {
                  const value = e.target.value;
                  setNameDraft(value);
                  if (!composingNameRef.current) {
                    const current = sessionRef.current.formations.find((f) => f.cueId === selectedCueId && f.rank === 1);
                    const base = current ?? defaultRank1(selectedCueId, undefined);
                    upsertFormation({ ...base, name: value });
                  }
                }}
                onCompositionStart={() => {
                  composingNameRef.current = true;
                }}
                onCompositionEnd={(e) => {
                  composingNameRef.current = false;
                  commitCueName(e.currentTarget.value);
                }}
                onBlur={(e) => {
                  if (composingNameRef.current) return;
                  commitCueName(e.currentTarget.value);
                }}
              />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: shell.textSubtle, lineHeight: 1.45 }}>
                キューごとに書き換えられます。ピラミッドや2列を直したら、この欄の名前も合わせて変えてください。
              </p>
            </div>
            <AnnotateMiniStage
              formationType={selectedRank1?.formationType || "LINE"}
              positions={layoutOf(selectedRank1).length ? layoutOf(selectedRank1) : layoutPreset("LINE", DEFAULT_DANCER_COUNT)}
              copyPrevId={prevLayout?.layout?.positions.length ? prevCueRow?.id : null}
              copyNextId={nextLayout?.layout?.positions.length ? nextCueRow?.id : null}
              copySources={cuesByTime
                .map((row, n) => {
                  const src = rankFor(row.id, 1);
                  if (row.id === selectedCueId || !src?.layout?.positions.length) return null;
                  const customName = src.name?.trim();
                  return {
                    id: row.id,
                    label: `Q${n + 1}${customName ? ` ${customName}` : ""} ${formatClock(row.cue.time)}`,
                  };
                })
                .filter((row): row is { id: string; label: string } => Boolean(row))}
              onCopyFrom={(id) => {
                const src = rankFor(id, 1);
                if (!src) return;
                const next = defaultRank1(selectedCueId, src);
                upsertFormation(next);
                setNameDraft(next.name ?? standingNameFor(next.formationType));
                focusNameField();
              }}
              onChange={({ positions, formationType }) => {
                const base = selectedRank1 ?? defaultRank1(selectedCueId, undefined);
                const typeChanged = formationType !== (base.formationType || "LINE");
                const nextName = typeChanged ? standingNameFor(formationType) : standingNameFor(formationType, base.name);
                upsertFormation({
                  ...base,
                  formationType,
                  formationId: formationType,
                  layout: { dancerCount: positions.length, positions },
                  name: nextName,
                });
                if (typeChanged) {
                  setNameDraft(nextName);
                  focusNameField();
                }
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
            上で付けた立ち位置の名前を、時間順に入れます。必要なら手で直してください。
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
              Download {annotatorId}-{songId}.json
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

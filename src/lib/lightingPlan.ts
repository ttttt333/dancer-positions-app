import {
  DANCER_COLOR_PALETTE_HEX,
  modDancerColorIndex,
} from "./dancerColorPalette";
import { genderLabelForColor, resolveDancerDisplayHex } from "./dancerGender";
import { formatPdfClock } from "./choreographyPdfPages";
import { parseMmSsFlexible } from "./timeFormat";
import type {
  ChoreographyProjectJson,
  Cue,
  LightingPlan,
  LightingPlanCircleMark,
  LightingPlanCueTime,
  LightingPlanEdgeId,
  LightingPlanEdgeMark,
  LightingPlanMark,
  LightingPlanPinSpot,
  LightingTextMark,
} from "../types/choreography";
import { normalizeLightingTextMarks, presentLightingRequest } from "./lightingText";

const SHORT_MAX = 80;
const LONG_MAX = 500;
const CUE_TEXT_MAX = 2000;

export type LightingPlanCueRow = {
  cueId: string;
  number: number;
  /** 照明表に出す開始秒。立ち位置キューの時刻とは別 */
  tStartSec: number;
  tEndSec: number;
  timeLabel: string;
  name: string;
  note: string;
  lightingRequest: string;
  lightingRequestMarks?: LightingTextMark[];
  /** 画面で指定した行の高さ。未設定なら中身に合わせる */
  rowHeightPx?: number;
  formationId: string;
  dancerCount: number;
};

export type LightingPlanDocument = {
  heading: string;
  programOrder: string;
  programSub: string;
  presetMark: string;
  pinSpotLabel: string;
  className: string;
  timeLabel: string;
  headcountLabel: string;
  songTitle: string;
  costumeBottom: string;
  costumeTop: string;
  atmosphere: string;
  points: string;
  rows: LightingPlanCueRow[];
};

export type SketchDancer = {
  xPct: number;
  yPct: number;
  color: string;
};

export type SketchBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, max);
  return text || undefined;
}

/**
 * 入力途中の末尾空白・改行は残す。
 * trim すると「第19回 」の次の文字や説明の改行が消える。
 * 空白だけなら未設定として落とす。
 */
function clipEditable(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.slice(0, max);
  return text.trim() ? text : undefined;
}

const MAX_PLAN_SEC = 6 * 60 * 60;

function roundPlanSec(value: number): number {
  return Math.round(Math.min(MAX_PLAN_SEC, Math.max(0, value)) * 100) / 100;
}

function parseCueTimes(raw: unknown): Record<string, LightingPlanCueTime> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, LightingPlanCueTime> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const cueId = id.trim().slice(0, 80);
    if (!cueId || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const start = typeof row.tStartSec === "number" ? row.tStartSec : null;
    const end = typeof row.tEndSec === "number" ? row.tEndSec : null;
    if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    const tStartSec = roundPlanSec(start);
    const tEndSec = roundPlanSec(end);
    if (tEndSec <= tStartSec) continue;
    out[cueId] = { tStartSec, tEndSec };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseOmittedCueIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim().slice(0, 80);
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length >= 200) break;
  }
  return ids.length > 0 ? ids : undefined;
}

const ROW_HEIGHT_MIN = 96;
const ROW_HEIGHT_MAX = 840;

const DRAWING_CUES_MAX = 200;
const DRAWING_MARKS_MAX = 24;
const MARK_NUMBER_MAX = 3;
const EDGE_IDS: readonly LightingPlanEdgeId[] = ["kamite", "shimote", "back", "front"];

/** ヘソ・上手（画面右）・下手（画面左）。円が縁に隠れない位置 */
export const LIGHTING_PLAN_SPOTS = {
  center: { xPct: 50, yPct: 50 },
  kamite: { xPct: 82, yPct: 50 },
  shimote: { xPct: 18, yPct: 50 },
} as const;

export type LightingPlanSpot = keyof typeof LIGHTING_PLAN_SPOTS;

export function lightingPlanSpotPoint(spot: LightingPlanSpot): { xPct: number; yPct: number } {
  return { ...LIGHTING_PLAN_SPOTS[spot] };
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

function clipMarkNumber(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const digits = value
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, "")
    .slice(0, MARK_NUMBER_MAX);
  return digits || undefined;
}

function clipMarkId(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, "");
}

function isLightingPlanEdgeId(value: unknown): value is LightingPlanEdgeId {
  return typeof value === "string" && (EDGE_IDS as readonly string[]).includes(value);
}

export function nextLightingPlanMarkId(marks: readonly { id: string }[]): string {
  const used = new Set(marks.map((mark) => mark.id));
  let n = 1;
  while (used.has(`d${n}`)) n += 1;
  return `d${n}`;
}

function parseDrawings(raw: unknown): Record<string, LightingPlanMark[]> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, LightingPlanMark[]> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const cueId = id.trim().slice(0, 80);
    if (!cueId || !Array.isArray(value) || out[cueId]) continue;
    const marks: LightingPlanMark[] = [];
    const seenIds = new Set<string>();
    const seenEdges = new Set<LightingPlanEdgeId>();
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const markId = clipMarkId(row.id);
      if (!markId || seenIds.has(markId)) continue;
      if (row.kind === "circle") {
        if (typeof row.xPct !== "number" || typeof row.yPct !== "number") continue;
        if (!Number.isFinite(row.xPct) || !Number.isFinite(row.yPct)) continue;
        const xPct = clampPct(row.xPct);
        const yPct = clampPct(row.yPct);
        const number = clipMarkNumber(row.number);
        const circle: LightingPlanCircleMark = {
          id: markId,
          kind: "circle",
          xPct,
          yPct,
          ...(number ? { number } : {}),
        };
        marks.push(circle);
        seenIds.add(markId);
      } else if (row.kind === "edge" && isLightingPlanEdgeId(row.edge)) {
        if (seenEdges.has(row.edge)) continue;
        const edgeMark: LightingPlanEdgeMark = { id: markId, kind: "edge", edge: row.edge };
        marks.push(edgeMark);
        seenIds.add(markId);
        seenEdges.add(row.edge);
      }
      if (marks.length >= DRAWING_MARKS_MAX) break;
    }
    if (marks.length > 0) out[cueId] = marks;
    if (Object.keys(out).length >= DRAWING_CUES_MAX) break;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseRowHeights(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const cueId = id.trim().slice(0, 80);
    const height = Math.round(Number(value));
    if (!cueId || !Number.isFinite(height)) continue;
    if (height < ROW_HEIGHT_MIN || height > ROW_HEIGHT_MAX) continue;
    out[cueId] = height;
    if (Object.keys(out).length >= 200) break;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function scheduleOf(plan: Partial<LightingPlan> | null | undefined): Pick<
  LightingPlan,
  "cueTimes" | "omittedCueIds" | "rowHeights" | "drawings"
> {
  const cueTimes = parseCueTimes(plan?.cueTimes);
  const omittedCueIds = parseOmittedCueIds(plan?.omittedCueIds);
  const rowHeights = parseRowHeights(plan?.rowHeights);
  const drawings = parseDrawings(plan?.drawings);
  return {
    ...(cueTimes ? { cueTimes } : {}),
    ...(omittedCueIds ? { omittedCueIds } : {}),
    ...(rowHeights ? { rowHeights } : {}),
    ...(drawings ? { drawings } : {}),
  };
}

function planHasContent(plan: LightingPlan): boolean {
  return Object.values(plan).some((value) => {
    if (value == null) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    return Object.keys(value).length > 0;
  });
}

function editableLightingPlan(
  plan: Partial<LightingPlan> | null | undefined
): LightingPlan | undefined {
  if (!plan) return undefined;
  const next: LightingPlan = {
    eventTitle: clipEditable(plan.eventTitle, SHORT_MAX),
    programOrder: clipEditable(plan.programOrder, 16),
    programSub: clipEditable(plan.programSub, 16),
    presetMark: clipEditable(plan.presetMark, 16),
    pinSpot: pinSpot(plan.pinSpot),
    className: clipEditable(plan.className, SHORT_MAX),
    songTitle: clipEditable(plan.songTitle, SHORT_MAX),
    costumeBottom: clipEditable(plan.costumeBottom, 40),
    costumeTop: clipEditable(plan.costumeTop, 40),
    atmosphere: clipEditable(plan.atmosphere, LONG_MAX),
    points: clipEditable(plan.points, LONG_MAX),
    ...scheduleOf(plan),
  };
  return planHasContent(next) ? next : undefined;
}

function pinSpot(value: unknown): LightingPlanPinSpot | undefined {
  return value === "あり" || value === "なし" ? value : undefined;
}

/** 空の見出しは保存しない */
export function compactLightingPlan(
  plan: Partial<LightingPlan> | null | undefined
): LightingPlan | undefined {
  if (!plan) return undefined;
  const next: LightingPlan = {
    eventTitle: clean(plan.eventTitle, SHORT_MAX),
    programOrder: clean(plan.programOrder, 16),
    programSub: clean(plan.programSub, 16),
    presetMark: clean(plan.presetMark, 16),
    pinSpot: pinSpot(plan.pinSpot),
    className: clean(plan.className, SHORT_MAX),
    songTitle: clean(plan.songTitle, SHORT_MAX),
    costumeBottom: clean(plan.costumeBottom, 40),
    costumeTop: clean(plan.costumeTop, 40),
    atmosphere: clean(plan.atmosphere, LONG_MAX),
    points: clean(plan.points, LONG_MAX),
    ...scheduleOf(plan),
  };
  return planHasContent(next) ? next : undefined;
}

export function parseLightingPlan(raw: unknown): LightingPlan | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return compactLightingPlan(raw as Partial<LightingPlan>);
}

export function lightingPlanHeading(eventTitle: string | undefined): string {
  const title = eventTitle?.trim() ?? "";
  if (!title) return "照明プラン";
  if (title.endsWith("照明プラン")) return title;
  return `${title} 照明プラン`;
}

/** `0:00 ~ 0:09`。終端が無い行は作らない（キューは必ず区間を持つ） */
export function formatLightingRange(startSec: number, endSec: number): string {
  return `${formatPdfClock(startSec)} ~ ${formatPdfClock(endSec)}`;
}

export function lightingPlanHeadcount(project: ChoreographyProjectJson): number | null {
  if (
    typeof project.pieceDancerCount === "number" &&
    Number.isFinite(project.pieceDancerCount) &&
    project.pieceDancerCount >= 1
  ) {
    return Math.floor(project.pieceDancerCount);
  }
  let max = 0;
  for (const cue of project.cues) {
    const n =
      project.formations.find((f) => f.id === cue.formationId)?.dancers.length ?? 0;
    if (n > max) max = n;
  }
  return max > 0 ? max : null;
}

/** 照明表に出す時刻。上書きが無ければ立ち位置キューの時刻を見せるだけ */
export function lightingPlanCueWindow(
  plan: LightingPlan | undefined,
  cue: Cue
): LightingPlanCueTime {
  const override = plan?.cueTimes?.[cue.id];
  if (
    override &&
    Number.isFinite(override.tStartSec) &&
    Number.isFinite(override.tEndSec) &&
    override.tEndSec > override.tStartSec
  ) {
    return override;
  }
  return { tStartSec: cue.tStartSec, tEndSec: cue.tEndSec };
}

export function lightingPlanDurationLabel(project: ChoreographyProjectJson): string {
  const rows = lightingPlanRows(project);
  const last = rows[rows.length - 1];
  if (!last) return "";
  return formatPdfClock(Math.max(...rows.map((row) => row.tEndSec)));
}

function lightingPlanRows(project: ChoreographyProjectJson): LightingPlanCueRow[] {
  const plan = project.lightingPlan;
  const omitted = new Set(plan?.omittedCueIds ?? []);
  const visible = project.cues.filter((cue) => !omitted.has(cue.id));
  const ordered = visible
    .map((cue) => ({ cue, window: lightingPlanCueWindow(plan, cue) }))
    .sort(
      (a, b) =>
        a.window.tStartSec - b.window.tStartSec ||
        a.window.tEndSec - b.window.tEndSec ||
        a.cue.id.localeCompare(b.cue.id)
    );
  return ordered.map(({ cue, window }, index) => {
    const formation = project.formations.find((item) => item.id === cue.formationId);
    return {
      cueId: cue.id,
      number: index + 1,
      tStartSec: window.tStartSec,
      tEndSec: window.tEndSec,
      timeLabel: formatLightingRange(window.tStartSec, window.tEndSec),
      name: cue.name?.trim() ?? "",
      note: cue.note?.trim() ?? "",
      ...(() => {
        const lighting = presentLightingRequest(cue.lightingRequest, cue.lightingRequestMarks);
        return {
          lightingRequest: lighting.text,
          ...(lighting.marks ? { lightingRequestMarks: lighting.marks } : {}),
        };
      })(),
      ...(plan?.rowHeights?.[cue.id] ? { rowHeightPx: plan.rowHeights[cue.id] } : {}),
      formationId: cue.formationId,
      dancerCount: formation?.dancers.length ?? 0,
    };
  });
}

export function buildLightingPlanDocument(
  project: ChoreographyProjectJson
): LightingPlanDocument {
  const plan = project.lightingPlan;
  const headcount = lightingPlanHeadcount(project);
  const rows = lightingPlanRows(project);
  return {
    heading: lightingPlanHeading(plan?.eventTitle),
    programOrder: plan?.programOrder?.trim() ?? "",
    programSub: plan?.programSub?.trim() ?? "",
    presetMark: plan?.presetMark?.trim() ?? "",
    pinSpotLabel: plan?.pinSpot ?? "",
    className: plan?.className?.trim() ?? "",
    timeLabel: lightingPlanDurationLabel(project),
    headcountLabel: headcount != null ? String(headcount) : "",
    songTitle: plan?.songTitle?.trim() || project.pieceTitle.trim(),
    costumeBottom: plan?.costumeBottom?.trim() ?? "",
    costumeTop: plan?.costumeTop?.trim() ?? "",
    atmosphere: plan?.atmosphere?.trim() ?? "",
    points: plan?.points?.trim() ?? "",
    rows,
  };
}

export function withLightingPlan(
  project: ChoreographyProjectJson,
  patch: Partial<LightingPlan>
): ChoreographyProjectJson {
  return {
    ...project,
    lightingPlan: editableLightingPlan({ ...project.lightingPlan, ...patch }),
  };
}

function writeLightingPlan(
  project: ChoreographyProjectJson,
  plan: LightingPlan | undefined
): ChoreographyProjectJson {
  return { ...project, lightingPlan: plan };
}

/**
 * 照明表の時刻だけを変える。
 * 立ち位置キューの `tStartSec` / `tEndSec` はコピーしたまま返す。
 */
export function setLightingPlanCueTime(
  project: ChoreographyProjectJson,
  cueId: string,
  tStartSec: number,
  tEndSec: number
): ChoreographyProjectJson {
  const cue = project.cues.find((item) => item.id === cueId);
  if (!cue) return project;
  const start = roundPlanSec(tStartSec);
  const end = roundPlanSec(tEndSec);
  if (!(end > start)) return project;
  const cueTimes = { ...(project.lightingPlan?.cueTimes ?? {}) };
  const sameAsCue =
    Math.abs(start - cue.tStartSec) < 0.001 && Math.abs(end - cue.tEndSec) < 0.001;
  if (sameAsCue) delete cueTimes[cueId];
  else cueTimes[cueId] = { tStartSec: start, tEndSec: end };
  return writeLightingPlan(
    project,
    editableLightingPlan({
      ...project.lightingPlan,
      cueTimes: Object.keys(cueTimes).length > 0 ? cueTimes : undefined,
    })
  );
}

/** 照明表からその行を外す。立ち位置のキュー配列は変えない */
export function omitCueFromLightingPlan(
  project: ChoreographyProjectJson,
  cueId: string
): ChoreographyProjectJson {
  if (!project.cues.some((cue) => cue.id === cueId)) return project;
  const omitted = [...(project.lightingPlan?.omittedCueIds ?? [])];
  if (!omitted.includes(cueId)) omitted.push(cueId);
  const cueTimes = { ...(project.lightingPlan?.cueTimes ?? {}) };
  delete cueTimes[cueId];
  return writeLightingPlan(
    project,
    editableLightingPlan({
      ...project.lightingPlan,
      omittedCueIds: omitted,
      cueTimes: Object.keys(cueTimes).length > 0 ? cueTimes : undefined,
    })
  );
}

/** 照明表から外した行を、立ち位置キューの時刻のまま戻す */
export function restoreOmittedLightingPlanCues(
  project: ChoreographyProjectJson
): ChoreographyProjectJson {
  if (!project.lightingPlan?.omittedCueIds?.length) return project;
  return writeLightingPlan(
    project,
    editableLightingPlan({
      ...project.lightingPlan,
      omittedCueIds: undefined,
    })
  );
}

/**
 * 再生位置の表示。`0:17.4` のように 0.1 秒単位で切り捨てる。
 * 秒が変わる瞬間を、時間欄へ写す前に目で追えるようにする。
 */
export function formatLightingPlanPlayhead(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00.0";
  const tenths = Math.floor(Math.min(sec, 24 * 60 * 60) * 10 + 1e-6);
  const minutes = Math.floor(tenths / 600);
  const secondTenths = tenths % 600;
  const seconds = Math.floor(secondTenths / 10);
  const tenth = secondTenths % 10;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenth}`;
}

/** 照明表のプルダウン用。秒は四捨五入して分と秒に分ける */
export function planClockParts(sec: number): { minutes: number; seconds: number } {
  const total = Math.max(0, Math.round(Number.isFinite(sec) ? sec : 0));
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

/** 分・秒のプルダウンから照明表の秒へ戻す。秒は 0〜59 */
export function planClockFromParts(minutes: number, seconds: number): number {
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const s = Number.isFinite(seconds)
    ? Math.min(59, Math.max(0, Math.floor(seconds)))
    : 0;
  return m * 60 + s;
}

/** 再生位置がどの照明キューの時間に入っているか。点のキューは開始の前後 0.35 秒 */
export function lightingPlanCueIdAtTime(
  rows: readonly { cueId: string; tStartSec: number; tEndSec: number }[],
  t: number
): string {
  if (!Number.isFinite(t)) return "";
  for (const row of rows) {
    if (t + 1e-6 >= row.tStartSec && t < row.tEndSec - 1e-6) return row.cueId;
  }
  for (const row of rows) {
    if (
      Math.abs(row.tEndSec - row.tStartSec) < 0.05 &&
      Math.abs(t - row.tStartSec) < 0.35
    ) {
      return row.cueId;
    }
  }
  return "";
}

/** `0:17` や `17` を照明表の秒にする。解釈できなければ null */
export function parseLightingPlanClock(input: string): number | null {
  const parsed = parseMmSsFlexible(input);
  if (parsed == null || !Number.isFinite(parsed) || parsed < 0) return null;
  return roundPlanSec(parsed);
}

export function withCuePlanText(
  project: ChoreographyProjectJson,
  cueId: string,
  patch: Pick<Partial<Cue>, "name" | "note" | "lightingRequest" | "lightingRequestMarks">
): ChoreographyProjectJson {
  return {
    ...project,
    cues: project.cues.map((cue) => {
      if (cue.id !== cueId) return cue;
      const next: Cue = { ...cue };
      if ("name" in patch) {
        const name = clipEditable(patch.name, SHORT_MAX);
        if (name) next.name = name;
        else delete next.name;
      }
      if ("note" in patch) {
        const note = clipEditable(patch.note, CUE_TEXT_MAX);
        if (note) next.note = note;
        else delete next.note;
      }
      if ("lightingRequest" in patch || "lightingRequestMarks" in patch) {
        const lightingRequest =
          "lightingRequest" in patch
            ? clipEditable(patch.lightingRequest, CUE_TEXT_MAX)
            : next.lightingRequest;
        const marks = normalizeLightingTextMarks(
          "lightingRequestMarks" in patch ? patch.lightingRequestMarks : next.lightingRequestMarks,
          lightingRequest?.length ?? 0
        );
        if (lightingRequest) next.lightingRequest = lightingRequest;
        else delete next.lightingRequest;
        if (marks) next.lightingRequestMarks = marks;
        else delete next.lightingRequestMarks;
      }
      return next;
    }),
  };
}

/** 照明表のその行の高さを px で残す。null で自動に戻す */
export function setLightingPlanRowHeight(
  project: ChoreographyProjectJson,
  cueId: string,
  heightPx: number | null
): ChoreographyProjectJson {
  if (!project.cues.some((cue) => cue.id === cueId)) return project;
  const rowHeights = { ...(project.lightingPlan?.rowHeights ?? {}) };
  if (heightPx == null || !Number.isFinite(heightPx)) delete rowHeights[cueId];
  else {
    rowHeights[cueId] = Math.round(
      Math.min(ROW_HEIGHT_MAX, Math.max(ROW_HEIGHT_MIN, heightPx))
    );
  }
  return writeLightingPlan(
    project,
    editableLightingPlan({
      ...project.lightingPlan,
      rowHeights: Object.keys(rowHeights).length > 0 ? rowHeights : undefined,
    })
  );
}

function marksOf(project: ChoreographyProjectJson, cueId: string): LightingPlanMark[] {
  return project.lightingPlan?.drawings?.[cueId] ?? [];
}

function writeDrawings(
  project: ChoreographyProjectJson,
  cueId: string,
  marks: LightingPlanMark[]
): ChoreographyProjectJson {
  if (!project.cues.some((cue) => cue.id === cueId)) return project;
  const drawings = { ...(project.lightingPlan?.drawings ?? {}) };
  if (marks.length === 0) delete drawings[cueId];
  else drawings[cueId] = marks;
  return writeLightingPlan(
    project,
    editableLightingPlan({
      ...project.lightingPlan,
      drawings: Object.keys(drawings).length > 0 ? drawings : undefined,
    })
  );
}

/** 隊形欄に円を足す。立ち位置の formation はコピーしたまま */
export function placeLightingPlanCircle(
  project: ChoreographyProjectJson,
  cueId: string,
  at: { xPct: number; yPct: number }
): ChoreographyProjectJson {
  const current = marksOf(project, cueId);
  if (!project.cues.some((cue) => cue.id === cueId) || current.length >= DRAWING_MARKS_MAX) {
    return project;
  }
  const circle: LightingPlanCircleMark = {
    id: nextLightingPlanMarkId(current),
    kind: "circle",
    xPct: clampPct(at.xPct),
    yPct: clampPct(at.yPct),
  };
  return writeDrawings(project, cueId, [...current, circle]);
}

/** 置いた円をドラッグした位置へ動かす */
export function moveLightingPlanCircle(
  project: ChoreographyProjectJson,
  cueId: string,
  markId: string,
  xPct: number,
  yPct: number
): ChoreographyProjectJson {
  const current = marksOf(project, cueId);
  let changed = false;
  const next = current.map((mark) => {
    if (mark.kind !== "circle" || mark.id !== markId) return mark;
    const moved: LightingPlanCircleMark = {
      ...mark,
      xPct: clampPct(xPct),
      yPct: clampPct(yPct),
    };
    if (moved.xPct === mark.xPct && moved.yPct === mark.yPct) return mark;
    changed = true;
    return moved;
  });
  if (!changed) return project;
  return writeDrawings(project, cueId, next);
}

/** 円の中の数字。数字以外は捨て、空なら消す */
export function setLightingPlanCircleNumber(
  project: ChoreographyProjectJson,
  cueId: string,
  markId: string,
  number: string
): ChoreographyProjectJson {
  const current = marksOf(project, cueId);
  const digits = clipMarkNumber(number);
  let changed = false;
  const next = current.map((mark) => {
    if (mark.kind !== "circle" || mark.id !== markId) return mark;
    if ((mark.number ?? "") === (digits ?? "")) return mark;
    changed = true;
    const circle: LightingPlanCircleMark = { ...mark };
    if (digits) circle.number = digits;
    else delete circle.number;
    return circle;
  });
  if (!changed) return project;
  return writeDrawings(project, cueId, next);
}

/** 同じ縁が既にあれば外し、無ければ黒く塗る */
export function toggleLightingPlanEdge(
  project: ChoreographyProjectJson,
  cueId: string,
  edge: LightingPlanEdgeId
): ChoreographyProjectJson {
  if (!project.cues.some((cue) => cue.id === cueId)) return project;
  const current = marksOf(project, cueId);
  const existing = current.find((mark) => mark.kind === "edge" && mark.edge === edge);
  if (existing) return writeDrawings(project, cueId, current.filter((mark) => mark.id !== existing.id));
  if (current.length >= DRAWING_MARKS_MAX) return project;
  const added: LightingPlanEdgeMark = {
    id: nextLightingPlanMarkId(current),
    kind: "edge",
    edge,
  };
  return writeDrawings(project, cueId, [...current, added]);
}

export function deleteLightingPlanMark(
  project: ChoreographyProjectJson,
  cueId: string,
  markId: string
): ChoreographyProjectJson {
  const current = marksOf(project, cueId);
  const next = current.filter((mark) => mark.id !== markId);
  if (next.length === current.length) return project;
  return writeDrawings(project, cueId, next);
}

export function formationSketchDancers(
  project: ChoreographyProjectJson,
  formationId: string
): SketchDancer[] {
  const formation = project.formations.find((f) => f.id === formationId);
  return (formation?.dancers ?? []).map((dancer) => ({
    xPct: dancer.xPct,
    yPct: dancer.yPct,
    color: resolveDancerDisplayHex(
      genderLabelForColor(dancer),
      DANCER_COLOR_PALETTE_HEX[modDancerColorIndex(dancer.colorIndex ?? 0)]!
    ),
  }));
}

export type FormationSketchPlot = {
  x: number;
  y: number;
  w: number;
  h: number;
  edge: number;
  circleR: number;
};

/** 隊形欄の描画領域。客席ラベルの上を舞台にする */
export function formationSketchPlot(box: SketchBox): FormationSketchPlot | null {
  const { x, y, w, h } = box;
  if (w < 8 || h < 8) return null;
  const labelPx = Math.max(7, Math.min(11, Math.round(h * 0.16)));
  const pad = Math.max(3, Math.min(6, w * 0.06));
  const plotW = Math.max(4, w - pad * 2);
  const plotH = Math.max(4, y + h - labelPx - 3 - (y + pad));
  const short = Math.min(plotW, plotH);
  return {
    x: x + pad,
    y: y + pad,
    w: plotW,
    h: plotH,
    edge: Math.max(3, Math.min(10, short * 0.14)),
    circleR: Math.max(5, Math.min(13, short * 0.13)),
  };
}

export function formationSketchPctToPoint(
  plot: FormationSketchPlot,
  xPct: number,
  yPct: number
): { x: number; y: number } {
  return {
    x: plot.x + (clampPct(xPct) / 100) * plot.w,
    y: plot.y + (clampPct(yPct) / 100) * plot.h,
  };
}

export function formationSketchPointToPct(
  plot: FormationSketchPlot,
  px: number,
  py: number
): { xPct: number; yPct: number } {
  return {
    xPct: clampPct(((px - plot.x) / plot.w) * 100),
    yPct: clampPct(((py - plot.y) / plot.h) * 100),
  };
}

export function lightingPlanEdgeRect(
  plot: FormationSketchPlot,
  edge: LightingPlanEdgeId
): { x: number; y: number; w: number; h: number } {
  const band = plot.edge;
  if (edge === "shimote") return { x: plot.x, y: plot.y, w: band, h: plot.h };
  if (edge === "kamite") return { x: plot.x + plot.w - band, y: plot.y, w: band, h: plot.h };
  if (edge === "back") return { x: plot.x, y: plot.y, w: plot.w, h: band };
  return { x: plot.x, y: plot.y + plot.h - band, w: plot.w, h: band };
}

/** 舞台の縁の帯。角は近い辺を返す。上手は画面右 */
export function lightingPlanEdgeAt(
  box: SketchBox,
  px: number,
  py: number
): LightingPlanEdgeId | null {
  const plot = formationSketchPlot(box);
  if (!plot) return null;
  if (px < plot.x || py < plot.y || px > plot.x + plot.w || py > plot.y + plot.h) return null;
  const hits: { edge: LightingPlanEdgeId; d: number }[] = [];
  const left = px - plot.x;
  const right = plot.x + plot.w - px;
  const top = py - plot.y;
  const bottom = plot.y + plot.h - py;
  if (left <= plot.edge) hits.push({ edge: "shimote", d: left });
  if (right <= plot.edge) hits.push({ edge: "kamite", d: right });
  if (top <= plot.edge) hits.push({ edge: "back", d: top });
  if (bottom <= plot.edge) hits.push({ edge: "front", d: bottom });
  hits.sort((a, b) => a.d - b.d);
  return hits[0]?.edge ?? null;
}

/** 円を先に、その次に塗った縁を拾う */
export function hitLightingPlanMark(
  box: SketchBox,
  marks: readonly LightingPlanMark[],
  px: number,
  py: number
): LightingPlanMark | null {
  const plot = formationSketchPlot(box);
  if (!plot) return null;
  const reach = plot.circleR + 2;
  for (let i = marks.length - 1; i >= 0; i--) {
    const mark = marks[i];
    if (!mark || mark.kind !== "circle") continue;
    const center = formationSketchPctToPoint(plot, mark.xPct, mark.yPct);
    const dx = px - center.x;
    const dy = py - center.y;
    if (dx * dx + dy * dy <= reach * reach) return mark;
  }
  for (let i = marks.length - 1; i >= 0; i--) {
    const mark = marks[i];
    if (!mark || mark.kind !== "edge") continue;
    const rect = lightingPlanEdgeRect(plot, mark.edge);
    if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) return mark;
  }
  return null;
}

function drawMarkEdge(
  ctx: CanvasRenderingContext2D,
  plot: FormationSketchPlot,
  edge: LightingPlanEdgeId
) {
  const rect = lightingPlanEdgeRect(plot, edge);
  ctx.fillStyle = "#111111";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function drawMarkCircle(
  ctx: CanvasRenderingContext2D,
  plot: FormationSketchPlot,
  mark: LightingPlanCircleMark
) {
  const center = formationSketchPctToPoint(plot, mark.xPct, mark.yPct);
  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1.25, plot.circleR * 0.16);
  ctx.arc(center.x, center.y, plot.circleR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!mark.number) return;
  const fontPx = Math.max(7, Math.round(plot.circleR * (mark.number.length > 2 ? 0.85 : 1.15)));
  ctx.fillStyle = "#111111";
  ctx.font = `700 ${fontPx}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(mark.number, center.x, center.y);
}

/**
 * 照明表の隊形欄。白黒で、立ち位置の塊と表だけの印を描く。
 * ダンサーの色は使わない。
 */
export function drawFormationSketch(
  ctx: CanvasRenderingContext2D,
  box: SketchBox,
  dancers: readonly SketchDancer[],
  marks: readonly LightingPlanMark[] = []
): void {
  const { x, y, w, h } = box;
  const plot = formationSketchPlot(box);
  if (!plot) return;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1, Math.min(2, w * 0.015));
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));

  for (const mark of marks) {
    if (mark.kind === "edge") drawMarkEdge(ctx, plot, mark.edge);
  }

  const radius = Math.max(
    1.4,
    Math.min(4.5, plot.w / Math.max(10, Math.sqrt(Math.max(1, dancers.length)) * 2.4))
  );
  for (const dancer of dancers) {
    const point = formationSketchPctToPoint(
      plot,
      Number.isFinite(dancer.xPct) ? dancer.xPct : 50,
      Number.isFinite(dancer.yPct) ? dancer.yPct : 50
    );
    ctx.beginPath();
    ctx.fillStyle = "#111111";
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const mark of marks) {
    if (mark.kind === "circle") drawMarkCircle(ctx, plot, mark);
  }

  const labelPx = Math.max(7, Math.min(11, Math.round(h * 0.16)));
  ctx.fillStyle = "#111111";
  ctx.font = `${labelPx}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("客席", x + w / 2, y + h - 2);
  ctx.restore();
}

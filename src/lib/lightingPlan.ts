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
  LightingPlanCueTime,
  LightingPlanPinSpot,
} from "../types/choreography";

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

function scheduleOf(plan: Partial<LightingPlan> | null | undefined): Pick<
  LightingPlan,
  "cueTimes" | "omittedCueIds"
> {
  const cueTimes = parseCueTimes(plan?.cueTimes);
  const omittedCueIds = parseOmittedCueIds(plan?.omittedCueIds);
  return {
    ...(cueTimes ? { cueTimes } : {}),
    ...(omittedCueIds ? { omittedCueIds } : {}),
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
      lightingRequest: cue.lightingRequest?.trim() ?? "",
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

/** `0:17` や `17` を照明表の秒にする。解釈できなければ null */
export function parseLightingPlanClock(input: string): number | null {
  const parsed = parseMmSsFlexible(input);
  if (parsed == null || !Number.isFinite(parsed) || parsed < 0) return null;
  return roundPlanSec(parsed);
}

export function withCuePlanText(
  project: ChoreographyProjectJson,
  cueId: string,
  patch: Pick<Partial<Cue>, "name" | "note" | "lightingRequest">
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
      if ("lightingRequest" in patch) {
        const lightingRequest = clipEditable(patch.lightingRequest, CUE_TEXT_MAX);
        if (lightingRequest) next.lightingRequest = lightingRequest;
        else delete next.lightingRequest;
      }
      return next;
    }),
  };
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

/** 照明表の隊形欄。名前は描かず、立ち位置の塊だけを見せる */
export function drawFormationSketch(
  ctx: CanvasRenderingContext2D,
  box: SketchBox,
  dancers: readonly SketchDancer[]
): void {
  const { x, y, w, h } = box;
  if (w < 8 || h < 8) return;
  ctx.save();
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = Math.max(1, Math.min(2, w * 0.015));
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));

  const labelPx = Math.max(7, Math.min(11, Math.round(h * 0.16)));
  ctx.fillStyle = "#64748b";
  ctx.font = `${labelPx}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("客席", x + w / 2, y + h - 2);

  const pad = Math.max(3, Math.min(6, w * 0.06));
  const plotBottom = y + h - labelPx - 3;
  const plotH = Math.max(4, plotBottom - (y + pad));
  const plotW = Math.max(4, w - pad * 2);
  const radius = Math.max(
    1.4,
    Math.min(4.5, plotW / Math.max(10, Math.sqrt(Math.max(1, dancers.length)) * 2.4))
  );
  for (const dancer of dancers) {
    const px = Number.isFinite(dancer.xPct) ? dancer.xPct : 50;
    const py = Number.isFinite(dancer.yPct) ? dancer.yPct : 50;
    const cx = x + pad + (Math.min(100, Math.max(0, px)) / 100) * plotW;
    const cy = y + pad + (Math.min(100, Math.max(0, py)) / 100) * plotH;
    ctx.beginPath();
    ctx.fillStyle = dancer.color || "#334155";
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

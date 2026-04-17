import type {
  ChoreographyProjectJson,
  Crew,
  Cue,
  DancerSpot,
  Formation,
  SavedSpotLayout,
  SetPiece,
  SetPieceKind,
} from "../types/choreography";
import { migrateCuesFromRaw } from "./cueInterval";
import { createEmptyProject } from "./projectDefaults";

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

const GRID_STEP_CHOICES = [0.5, 1, 2, 5, 10] as const;

const SET_PIECE_CAP = 40;

function clampPct(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

const SET_PIECE_KINDS = new Set<string>(["rect", "ellipse", "triangle"]);

function normalizeSetPieceKind(raw: unknown): SetPieceKind {
  return typeof raw === "string" && SET_PIECE_KINDS.has(raw)
    ? (raw as SetPieceKind)
    : "rect";
}

function normalizeHexFill(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!;
    const g = t[2]!;
    const b = t[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return undefined;
}

function normalizeSetPiecesArray(raw: unknown): SetPiece[] {
  if (!Array.isArray(raw)) return [];
  const out: SetPiece[] = [];
  for (const row of raw) {
    if (out.length >= SET_PIECE_CAP) break;
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : randomId("piece");
    const kind = normalizeSetPieceKind(r.kind);
    const fillColor = normalizeHexFill(r.fillColor);
    const xPct = Math.round(clampPct(Number(r.xPct), 0, 100) * 100) / 100;
    const yPct = Math.round(clampPct(Number(r.yPct), 0, 100) * 100) / 100;
    const wPct = Math.round(
      clampPct(
        typeof r.wPct === "number" && Number.isFinite(r.wPct) ? r.wPct : 18,
        2,
        100
      ) * 100
    ) / 100;
    const hPct = Math.round(
      clampPct(
        typeof r.hPct === "number" && Number.isFinite(r.hPct) ? r.hPct : 12,
        2,
        100
      ) * 100
    ) / 100;
    const piece: SetPiece = {
      id,
      kind,
      label:
        typeof r.label === "string" && r.label.trim()
          ? r.label.trim().slice(0, 40)
          : undefined,
      xPct,
      yPct,
      wPct,
      hPct,
      interpolateInGaps: r.interpolateInGaps === true,
    };
    if (fillColor) piece.fillColor = fillColor;
    out.push(piece);
  }
  return out;
}

function normalizeDancerSpot(raw: unknown, index: number): DancerSpot {
  if (!raw || typeof raw !== "object") {
    return {
      id: randomId("d"),
      label: String(index + 1),
      xPct: 50,
      yPct: 50,
      colorIndex: index % 9,
    };
  }
  const d = raw as Record<string, unknown>;
  const noteRaw = d.note;
  const note =
    typeof noteRaw === "string" && noteRaw.trim()
      ? noteRaw.trim().slice(0, 2000)
      : undefined;
  const sizeRaw = d.sizePx;
  const sizePx =
    typeof sizeRaw === "number" && Number.isFinite(sizeRaw)
      ? Math.max(20, Math.min(120, Math.round(sizeRaw)))
      : undefined;
  return {
    id: typeof d.id === "string" && d.id ? d.id : randomId("d"),
    label: typeof d.label === "string" ? d.label : String(index + 1),
    xPct:
      typeof d.xPct === "number" && Number.isFinite(d.xPct)
        ? clampPct(d.xPct, 0, 100)
        : 50,
    yPct:
      typeof d.yPct === "number" && Number.isFinite(d.yPct)
        ? clampPct(d.yPct, 0, 100)
        : 50,
    colorIndex:
      typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
        ? Math.floor(d.colorIndex) % 9
        : index % 9,
    ...(typeof d.crewMemberId === "string" && d.crewMemberId
      ? { crewMemberId: d.crewMemberId }
      : {}),
    ...(note ? { note } : {}),
    ...(sizePx != null ? { sizePx } : {}),
  };
}

function normalizeFormationDancers(raw: unknown): DancerSpot[] {
  if (!Array.isArray(raw)) return [];
  const out: DancerSpot[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (out.length >= 100) break;
    out.push(normalizeDancerSpot(raw[i], i));
  }
  return out;
}

function normalizeGridStep(raw: unknown): number {
  const g = typeof raw === "number" && Number.isFinite(raw) ? raw : 2;
  const clamped = Math.max(0.5, Math.min(10, g));
  return GRID_STEP_CHOICES.reduce((best, a) =>
    Math.abs(a - clamped) < Math.abs(best - clamped) ? a : best
  );
}

export function normalizeProject(data: unknown): ChoreographyProjectJson {
  const defaults = createEmptyProject();
  if (!data || typeof data !== "object") return defaults;
  const o = data as Partial<ChoreographyProjectJson>;
  const formations: Formation[] =
    o.formations && o.formations.length > 0
      ? o.formations.map((fm) => {
          const fmObj = fm as Record<string, unknown>;
          const base = fm as Formation;
          return {
            ...base,
            note:
              typeof fm.note === "string" && fm.note.trim()
                ? fm.note.trim().slice(0, 4000)
                : undefined,
            confirmedDancerCount:
              typeof fm.confirmedDancerCount === "number" &&
              fm.confirmedDancerCount >= 0
                ? Math.floor(fm.confirmedDancerCount)
                : undefined,
            dancers: normalizeFormationDancers(fmObj.dancers),
            setPieces: normalizeSetPiecesArray(fmObj.setPieces),
          };
        })
      : defaults.formations;
  const activeFormationId =
    formations.some((f) => f.id === o.activeFormationId) && o.activeFormationId
      ? o.activeFormationId
      : formations[0].id;
  const cuesRaw = Array.isArray(o.cues) ? o.cues : [];
  const crewsRaw = Array.isArray(o.crews) ? o.crews : [];
  const crews: Crew[] = crewsRaw
    .filter((cr): cr is NonNullable<typeof cr> => cr != null && typeof cr === "object")
    .map((cr) => ({
      id: typeof cr.id === "string" && cr.id ? cr.id : randomId("crew"),
      name: typeof cr.name === "string" ? cr.name : "メンバー",
      members: Array.isArray(cr.members)
        ? cr.members
            .filter((m) => m != null && typeof m === "object")
            .map((m) => ({
              id: typeof m.id === "string" && m.id ? m.id : randomId("m"),
              label: typeof m.label === "string" ? m.label : "?",
              colorIndex:
                typeof m.colorIndex === "number" ? m.colorIndex % 9 : 0,
            }))
        : [],
    }));
  const savedLayoutsRaw = Array.isArray(
    (o as Partial<ChoreographyProjectJson>).savedSpotLayouts
  )
    ? (o as Partial<ChoreographyProjectJson>).savedSpotLayouts!
    : [];
  const savedSpotLayouts: SavedSpotLayout[] = savedLayoutsRaw
    .filter((sl) => sl != null && typeof sl === "object")
    .map((sl) => {
      const dancersRaw = Array.isArray(sl.dancers) ? sl.dancers : [];
      const dancers: DancerSpot[] = dancersRaw
        .filter((d) => d != null && typeof d === "object")
        .slice(0, 100)
        .map((d, i) => normalizeDancerSpot(d, i));
      const savedAtCount =
        typeof sl.savedAtCount === "number" && Number.isFinite(sl.savedAtCount)
          ? Math.max(1, Math.min(80, Math.floor(sl.savedAtCount)))
          : Math.max(1, Math.min(80, dancers.length || 1));
      return {
        id: typeof sl.id === "string" && sl.id ? sl.id : randomId("saved-layout"),
        name:
          typeof sl.name === "string" && sl.name.trim()
            ? sl.name.trim().slice(0, 120)
            : "保存した立ち位置",
        savedAtCount,
        dancers,
      };
    });

  const cues: Cue[] = migrateCuesFromRaw(cuesRaw, formations).slice(0, 100);
  return {
    ...defaults,
    ...o,
    version: 3,
    formations,
    activeFormationId,
    cues,
    pieceTitle: typeof o.pieceTitle === "string" ? o.pieceTitle : "",
    pieceDancerCount: (() => {
      const v = (o as Partial<ChoreographyProjectJson>).pieceDancerCount;
      if (v === null || v === undefined) return null;
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      const n = Math.floor(v);
      if (n < 1 || n > 200) return null;
      return n;
    })(),
    audienceEdge: o.audienceEdge ?? defaults.audienceEdge,
    stageWidthMm:
      o.stageWidthMm === undefined ? defaults.stageWidthMm : o.stageWidthMm,
    stageDepthMm:
      o.stageDepthMm === undefined ? defaults.stageDepthMm : o.stageDepthMm,
    sideStageMm:
      o.sideStageMm === undefined ? defaults.sideStageMm : o.sideStageMm,
    backStageMm:
      o.backStageMm === undefined ? defaults.backStageMm : o.backStageMm,
    hanamichiEnabled:
      typeof (o as Partial<ChoreographyProjectJson>).hanamichiEnabled === "boolean"
        ? (o as Partial<ChoreographyProjectJson>).hanamichiEnabled!
        : defaults.hanamichiEnabled ?? false,
    hanamichiDepthPct: (() => {
      const v = (o as Partial<ChoreographyProjectJson>).hanamichiDepthPct;
      if (typeof v !== "number" || !Number.isFinite(v)) return defaults.hanamichiDepthPct ?? 14;
      return Math.round(Math.min(36, Math.max(8, v)) * 10) / 10;
    })(),
    centerFieldGuideIntervalMm: (() => {
      const po = o as Partial<ChoreographyProjectJson>;
      const raw = o as Record<string, unknown>;
      const vNew = po.centerFieldGuideIntervalMm;
      const vLegacy = raw["mainPlayingHalfWidthFromCenterMm"];
      const v =
        typeof vNew === "number" && Number.isFinite(vNew) && vNew > 0
          ? vNew
          : typeof vLegacy === "number" && Number.isFinite(vLegacy) && vLegacy > 0
            ? vLegacy
            : null;
      if (v == null) return null;
      const p = Math.max(1, Math.floor(v));
      const sw =
        o.stageWidthMm === undefined ? defaults.stageWidthMm : o.stageWidthMm;
      if (typeof sw === "number" && sw > 0 && p > sw / 2) {
        return Math.max(1, Math.floor(sw / 2));
      }
      return p;
    })(),
    crews,
    savedSpotLayouts,
    audioAssetId:
      typeof o.audioAssetId === "number"
        ? o.audioAssetId
        : o.audioAssetId === null
          ? null
          : defaults.audioAssetId,
    playbackRate:
      typeof o.playbackRate === "number" ? o.playbackRate : defaults.playbackRate,
    trimStartSec:
      typeof o.trimStartSec === "number" ? o.trimStartSec : defaults.trimStartSec,
    trimEndSec:
      o.trimEndSec === undefined ? defaults.trimEndSec : o.trimEndSec,
    snapGrid: o.snapGrid ?? defaults.snapGrid,
    gridStep: normalizeGridStep(o.gridStep),
    dancerMarkerDiameterPx: (() => {
      const po = o as Partial<ChoreographyProjectJson>;
      const raw = po.dancerMarkerDiameterPx;
      if (typeof raw !== "number" || !Number.isFinite(raw)) return defaults.dancerMarkerDiameterPx;
      return Math.max(20, Math.min(120, Math.round(raw)));
    })(),
    waveformAmplitudeScale: (() => {
      const po = o as Partial<ChoreographyProjectJson>;
      const raw = po.waveformAmplitudeScale;
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return defaults.waveformAmplitudeScale ?? 1;
      }
      return Math.round(Math.min(4, Math.max(0.25, raw)) * 100) / 100;
    })(),
    viewMode: o.viewMode === "view" ? "view" : "edit",
  };
}

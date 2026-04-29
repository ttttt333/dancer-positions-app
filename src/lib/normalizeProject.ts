import type {
  AudienceEdge,
  ChoreographyProjectJson,
  Crew,
  CrewMember,
  Cue,
  DancerSpot,
  Formation,
  RosterStripSortMode,
  SavedSpotLayout,
  SavedSpotStageSnapshot,
  SetPiece,
  SetPieceKind,
  StageFloorMarkup,
  StageFloorTextMarkup,
  StageShape,
  StageShapePresetId,
} from "../types/choreography";
import { migrateCuesFromRaw } from "./cueInterval";
import {
  clampStageGridAxisMm,
  createEmptyProject,
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
  migrateAudienceEdge,
} from "./projectDefaults";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "./dancerSpacing";
import { modDancerColorIndex, normalizeDancerFacingDeg } from "./dancerColorPalette";
import { sliceMarkerBadgeForStorage } from "./markerBadge";

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

const FLOOR_MARKUP_CAP = 48;

const STAGE_SHAPE_PRESET_IDS = new Set<string>([
  "rectangle",
  "hanamichi_front",
  "apron_front",
  "thrust",
  "t_stage",
  "trapezoid_narrow_back",
  "trapezoid_narrow_front",
  "hexagon",
  "diamond",
  "rounded",
  "oval",
  "corner_cut_fl",
  "corner_cut_fr",
  "custom",
]);

/**
 * 変形舞台の形状を正規化する。
 *
 * - 未知の preset / 形の壊れたデータは undefined に落として rectangle 扱いへ。
 * - polygonPct は 3 点以上の [x,y] ペアに限り採用し、各座標を 0〜100 に clamp。
 * - params は数値のみを採用し、それ以外のキーは捨てる。
 */
/** 壊れた／異常に大きな JSON でも正規化でフリーズしないよう上限を付ける */
const STAGE_SHAPE_POLYGON_MAX_POINTS = 512;
const STAGE_SHAPE_POLYGON_MAX_SCAN = 4096;

function normalizeStageShape(raw: unknown): StageShape | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const presetId = rec.presetId;
  if (typeof presetId !== "string" || !STAGE_SHAPE_PRESET_IDS.has(presetId)) {
    return undefined;
  }
  const poly = rec.polygonPct;
  if (!Array.isArray(poly) || poly.length < 3) return undefined;
  const polygonPct: [number, number][] = [];
  let scanned = 0;
  for (const pt of poly) {
    if (polygonPct.length >= STAGE_SHAPE_POLYGON_MAX_POINTS) break;
    if (scanned++ >= STAGE_SHAPE_POLYGON_MAX_SCAN) break;
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const x = Number(pt[0]);
    const y = Number(pt[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    polygonPct.push([clampPct(x, 0, 100), clampPct(y, 0, 100)]);
  }
  if (polygonPct.length < 3) return undefined;

  let params: Record<string, number> | undefined;
  if (rec.params && typeof rec.params === "object") {
    const src = rec.params as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        out[k] = v;
      }
    }
    if (Object.keys(out).length > 0) params = out;
  }

  return {
    presetId: presetId as StageShapePresetId,
    polygonPct,
    params,
  };
}

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

function normalizeFloorMarkupArray(raw: unknown): StageFloorMarkup[] {
  if (!Array.isArray(raw)) return [];
  const out: StageFloorMarkup[] = [];
  for (const row of raw) {
    if (out.length >= FLOOR_MARKUP_CAP) break;
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const kind = r.kind;
    const id = typeof r.id === "string" && r.id ? r.id : randomId("fmark");
    if (kind === "text") {
      const text =
        typeof r.text === "string" && r.text.trim()
          ? r.text.trim().slice(0, 400)
          : "";
      if (!text) continue;
      const xPct = Math.round(clampPct(Number(r.xPct), 0, 100) * 100) / 100;
      const yPct = Math.round(clampPct(Number(r.yPct), 0, 100) * 100) / 100;
      const item: StageFloorTextMarkup = {
        id,
        kind: "text",
        xPct,
        yPct,
        text,
      };
      const lyr = r.layer;
      if (lyr === "screen") item.layer = "screen";
      const col = normalizeHexFill(r.color);
      if (col) item.color = col;
      const fs = Number(r.fontSizePx);
      if (Number.isFinite(fs) && fs >= 8 && fs <= 56) item.fontSizePx = Math.round(fs);
      const fw = Number(r.fontWeight);
      if (Number.isFinite(fw) && fw >= 300 && fw <= 900) {
        item.fontWeight = Math.round(fw / 50) * 50;
      }
      if (typeof r.fontFamily === "string") {
        const ff = r.fontFamily.trim().slice(0, 240);
        if (ff) item.fontFamily = ff;
      }
      const sc = Number(r.scale);
      if (Number.isFinite(sc) && sc > 0) {
        item.scale = Math.min(8, Math.max(0.2, Math.round(sc * 1000) / 1000));
      }
      out.push(item);
      continue;
    }
    if (kind === "line") {
      const poly = r.pointsPct;
      if (!Array.isArray(poly) || poly.length < 2) continue;
      const pts: [number, number][] = [];
      for (const pr of poly) {
        if (pts.length >= 200) break;
        if (!Array.isArray(pr) || pr.length < 2) continue;
        const x = Math.round(clampPct(Number(pr[0]), 0, 100) * 100) / 100;
        const y = Math.round(clampPct(Number(pr[1]), 0, 100) * 100) / 100;
        if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]);
      }
      if (pts.length < 2) continue;
      const item: StageFloorMarkup = {
        id,
        kind: "line",
        pointsPct: pts,
      };
      const col = normalizeHexFill(r.color);
      if (col) item.color = col;
      const w = Number(r.widthPx);
      if (Number.isFinite(w) && w >= 1 && w <= 16) item.widthPx = Math.round(w);
      out.push(item);
    }
  }
  return out;
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
    const lyr = r.layer;
    const rotRaw = r.rotationDeg;
    let rotationDeg: number | undefined;
    if (typeof rotRaw === "number" && Number.isFinite(rotRaw)) {
      rotationDeg =
        Math.round(Math.max(-36000, Math.min(36000, rotRaw)) * 100) / 100;
    }
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
    if (lyr === "screen") piece.layer = "screen";
    if (rotationDeg !== undefined) piece.rotationDeg = rotationDeg;
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
      colorIndex: modDancerColorIndex(index),
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
  const hRaw = d.heightCm;
  const heightCm =
    typeof hRaw === "number" && Number.isFinite(hRaw) && hRaw > 0 && hRaw < 300
      ? Math.round(hRaw * 10) / 10
      : undefined;
  const mbRaw = d.markerBadge;
  /** 数字のみはセンター距離など 4 桁まで（それ以外は 3 文字）。`markerBadge.ts` と揃える */
  const markerBadge = sliceMarkerBadgeForStorage(mbRaw);
  const mbsRaw = d.markerBadgeSource;
  const markerBadgeSource =
    mbsRaw === "centerDistance" ? ("centerDistance" as const) : undefined;
  const fdRaw = d.facingDeg;
  let facingDeg: number | undefined;
  if (typeof fdRaw === "number" && Number.isFinite(fdRaw)) {
    const m = normalizeDancerFacingDeg(fdRaw);
    if (m !== 0) facingDeg = m;
  }
  return {
    id: typeof d.id === "string" && d.id ? d.id : randomId("d"),
    label: typeof d.label === "string" ? d.label : String(index + 1),
    xPct:
      typeof d.xPct === "number" && Number.isFinite(d.xPct)
        ? clampPct(d.xPct, DANCER_STAGE_POSITION_PCT_LO, DANCER_STAGE_POSITION_PCT_HI)
        : 50,
    yPct:
      typeof d.yPct === "number" && Number.isFinite(d.yPct)
        ? clampPct(d.yPct, DANCER_STAGE_POSITION_PCT_LO, DANCER_STAGE_POSITION_PCT_HI)
        : 50,
    colorIndex:
      typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
        ? modDancerColorIndex(Math.floor(d.colorIndex))
        : modDancerColorIndex(index),
    ...(typeof d.crewMemberId === "string" && d.crewMemberId
      ? { crewMemberId: d.crewMemberId }
      : {}),
    ...(note ? { note } : {}),
    ...(sizePx != null ? { sizePx } : {}),
    ...(heightCm != null ? { heightCm } : {}),
    ...(typeof d.gradeLabel === "string" && d.gradeLabel.trim()
      ? { gradeLabel: d.gradeLabel.trim().slice(0, 32) }
      : {}),
    ...(typeof d.skillRankLabel === "string" && d.skillRankLabel.trim()
      ? { skillRankLabel: d.skillRankLabel.trim().slice(0, 24) }
      : {}),
    ...(typeof d.genderLabel === "string" && d.genderLabel.trim()
      ? { genderLabel: d.genderLabel.trim().slice(0, 32) }
      : {}),
    ...(markerBadge !== undefined ? { markerBadge } : {}),
    ...(markerBadgeSource ? { markerBadgeSource } : {}),
    ...(facingDeg != null ? { facingDeg } : {}),
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

function numOrNullSnap(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function migrateStageGridLineAxes(
  o: Record<string, unknown>,
  legacyDefault: boolean
): {
  stageGridLinesVerticalEnabled: boolean;
  stageGridLinesHorizontalEnabled: boolean;
  stageGridLinesEnabled: boolean;
} {
  const legacy =
    typeof o.stageGridLinesEnabled === "boolean"
      ? o.stageGridLinesEnabled
      : legacyDefault;
  const v =
    typeof o.stageGridLinesVerticalEnabled === "boolean"
      ? o.stageGridLinesVerticalEnabled
      : legacy;
  const h =
    typeof o.stageGridLinesHorizontalEnabled === "boolean"
      ? o.stageGridLinesHorizontalEnabled
      : legacy;
  return {
    stageGridLinesVerticalEnabled: v,
    stageGridLinesHorizontalEnabled: h,
    stageGridLinesEnabled: v || h,
  };
}

function normalizeSavedSpotStageSnapshot(
  raw: unknown,
  defaults: ChoreographyProjectJson
): SavedSpotStageSnapshot | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const audienceEdge = migrateAudienceEdge(o.audienceEdge, defaults.audienceEdge);
  const stageShape = normalizeStageShape(o.stageShape);
  const dmp =
    typeof o.dancerMarkerDiameterPx === "number" && Number.isFinite(o.dancerMarkerDiameterPx)
      ? (() => {
          const r = Math.round(o.dancerMarkerDiameterPx);
          if (r === 44) return defaults.dancerMarkerDiameterPx;
          return Math.max(
            MARKER_DIAMETER_PX_MIN,
            Math.min(MARKER_DIAMETER_PX_MAX, r)
          );
        })()
      : defaults.dancerMarkerDiameterPx;
  const snap: SavedSpotStageSnapshot = {
    audienceEdge,
    stageWidthMm: numOrNullSnap(o.stageWidthMm),
    stageDepthMm: numOrNullSnap(o.stageDepthMm),
    sideStageMm: numOrNullSnap(o.sideStageMm),
    backStageMm: numOrNullSnap(o.backStageMm),
    centerFieldGuideIntervalMm: numOrNullSnap(o.centerFieldGuideIntervalMm),
    hanamichiEnabled:
      typeof o.hanamichiEnabled === "boolean" ? o.hanamichiEnabled : false,
    hanamichiDepthPct:
      typeof o.hanamichiDepthPct === "number" && Number.isFinite(o.hanamichiDepthPct)
        ? Math.round(Math.min(36, Math.max(8, o.hanamichiDepthPct)) * 10) / 10
        : 14,
    stageShape: stageShape ?? undefined,
    gridSpacingMm:
      typeof o.gridSpacingMm === "number" && Number.isFinite(o.gridSpacingMm)
        ? o.gridSpacingMm
        : undefined,
    gridStep:
      typeof o.gridStep === "number" && Number.isFinite(o.gridStep)
        ? normalizeGridStep(o.gridStep)
        : defaults.gridStep,
    snapGrid: false,
    ...migrateStageGridLineAxes(
      o,
      defaults.stageGridLinesEnabled ?? false
    ),
    ...(() => {
      const fb = defaults.stageGridLineSpacingMm ?? 10;
      const legacy = clampStageGridAxisMm(o.stageGridLineSpacingMm, fb);
      const w = clampStageGridAxisMm(o.stageGridSpacingWidthMm, legacy);
      const d = clampStageGridAxisMm(o.stageGridSpacingDepthMm, legacy);
      return {
        stageGridSpacingWidthMm: w,
        stageGridSpacingDepthMm: d,
        stageGridLineSpacingMm: w,
      };
    })(),
    dancerSpacingMm: numOrNullSnap(o.dancerSpacingMm),
    dancerMarkerDiameterPx: dmp,
    dancerMarkerDiameterMm: numOrNullSnap(o.dancerMarkerDiameterMm) ?? undefined,
    dancerLabelPosition:
      o.dancerLabelPosition === "below" || o.dancerLabelPosition === "inside"
        ? o.dancerLabelPosition
        : defaults.dancerLabelPosition,
  };
  return snap;
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
          const { stageSnapshot: _rawStageSnap, ...baseClean } = base;
          const stageSnap = normalizeSavedSpotStageSnapshot(
            fmObj.stageSnapshot,
            defaults
          );
          return {
            ...baseClean,
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
            floorMarkup: normalizeFloorMarkupArray(fmObj.floorMarkup),
            ...(stageSnap ? { stageSnapshot: stageSnap } : {}),
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
            .map((m) => {
              const mm = m as Record<string, unknown>;
              const base: CrewMember = {
                id: typeof m.id === "string" && m.id ? m.id : randomId("m"),
                label: typeof m.label === "string" ? m.label : "?",
                colorIndex:
                  typeof m.colorIndex === "number"
                    ? modDancerColorIndex(m.colorIndex)
                    : 0,
              };
              const hc = mm.heightCm;
              if (
                typeof hc === "number" &&
                Number.isFinite(hc) &&
                hc > 0 &&
                hc < 300
              ) {
                base.heightCm = Math.round(hc * 10) / 10;
              }
              if (typeof mm.gradeLabel === "string" && mm.gradeLabel.trim()) {
                base.gradeLabel = mm.gradeLabel.trim().slice(0, 32);
              }
              if (
                typeof mm.skillRankLabel === "string" &&
                mm.skillRankLabel.trim()
              ) {
                base.skillRankLabel = mm.skillRankLabel.trim().slice(0, 24);
              }
              if (typeof mm.genderLabel === "string" && mm.genderLabel.trim()) {
                base.genderLabel = mm.genderLabel.trim().slice(0, 32);
              }
              if (typeof mm.note === "string" && mm.note.trim()) {
                base.note = mm.note.trim().slice(0, 2000);
              }
              return base;
            })
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
      const slObj = sl as Record<string, unknown>;
      const dancersRaw = Array.isArray(slObj.dancers) ? slObj.dancers : [];
      const dancers: DancerSpot[] = dancersRaw
        .filter((d) => d != null && typeof d === "object")
        .slice(0, 100)
        .map((d, i) => normalizeDancerSpot(d, i));
      const savedAtCount =
        typeof slObj.savedAtCount === "number" && Number.isFinite(slObj.savedAtCount)
          ? Math.max(1, Math.min(80, Math.floor(slObj.savedAtCount)))
          : Math.max(1, Math.min(80, dancers.length || 1));
      const stageSnapshot = normalizeSavedSpotStageSnapshot(slObj.stageSnapshot, defaults);
      return {
        id: typeof slObj.id === "string" && slObj.id ? slObj.id : randomId("saved-layout"),
        name:
          typeof slObj.name === "string" && slObj.name.trim()
            ? slObj.name.trim().slice(0, 120)
            : "保存した立ち位置",
        savedAtCount,
        dancers,
        ...(stageSnapshot ? { stageSnapshot } : {}),
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
    audienceEdge: migrateAudienceEdge(o.audienceEdge, defaults.audienceEdge),
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
    stageShape: normalizeStageShape(
      (o as Partial<ChoreographyProjectJson>).stageShape
    ),
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
    flowLocalAudioKey:
      typeof o.flowLocalAudioKey === "string" && o.flowLocalAudioKey.length > 0
        ? o.flowLocalAudioKey
        : o.flowLocalAudioKey === null
          ? null
          : defaults.flowLocalAudioKey,
    playbackRate:
      typeof o.playbackRate === "number" ? o.playbackRate : defaults.playbackRate,
    trimStartSec:
      typeof o.trimStartSec === "number" ? o.trimStartSec : defaults.trimStartSec,
    trimEndSec:
      o.trimEndSec === undefined ? defaults.trimEndSec : o.trimEndSec,
    snapGrid: false,
    gridStep: normalizeGridStep(o.gridStep),
    ...migrateStageGridLineAxes(
      o as Record<string, unknown>,
      defaults.stageGridLinesEnabled ?? false
    ),
    ...(() => {
      const po = o as Partial<ChoreographyProjectJson>;
      const fb = defaults.stageGridLineSpacingMm ?? 10;
      const legacy = clampStageGridAxisMm(po.stageGridLineSpacingMm, fb);
      const w = clampStageGridAxisMm(po.stageGridSpacingWidthMm, legacy);
      const d = clampStageGridAxisMm(po.stageGridSpacingDepthMm, legacy);
      return {
        stageGridSpacingWidthMm: w,
        stageGridSpacingDepthMm: d,
        stageGridLineSpacingMm: w,
      };
    })(),
    gridSpacingMm: (() => {
      const po = o as Partial<ChoreographyProjectJson>;
      const raw = po.gridSpacingMm;
      if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
      /** 100 mm 未満 or 20 m 超は無視（ほぼ誤入力） */
      if (raw < 100 || raw > 20000) return undefined;
      return Math.round(raw);
    })(),
    dancerSpacingMm: (() => {
      const po = o as Partial<ChoreographyProjectJson>;
      const raw = po.dancerSpacingMm;
      if (raw === null) return undefined;
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return defaults.dancerSpacingMm;
      }
      /** 200 mm 未満 or 5 m 超は無視（ほぼ誤入力） */
      if (raw < 200 || raw > 5000) return defaults.dancerSpacingMm;
      return Math.round(raw);
    })(),
    dancerMarkerDiameterPx: (() => {
      const po = o as Partial<ChoreographyProjectJson>;
      const raw = po.dancerMarkerDiameterPx;
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return defaults.dancerMarkerDiameterPx;
      }
      const r = Math.round(raw);
      if (r === 44) return defaults.dancerMarkerDiameterPx;
      return Math.max(
        MARKER_DIAMETER_PX_MIN,
        Math.min(MARKER_DIAMETER_PX_MAX, r)
      );
    })(),
    dancerMarkerDiameterMm: (() => {
      const po = o as Partial<ChoreographyProjectJson>;
      const raw = po.dancerMarkerDiameterMm;
      if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
      if (raw < 100 || raw > 3000) return undefined;
      return Math.round(raw);
    })(),
    dancerLabelPosition: (() => {
      const po = o as Partial<ChoreographyProjectJson>;
      return po.dancerLabelPosition === "below" ? "below" : "inside";
    })(),
    waveformAmplitudeScale: (() => {
      const po = o as Partial<ChoreographyProjectJson>;
      const raw = po.waveformAmplitudeScale;
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return defaults.waveformAmplitudeScale ?? 1;
      }
      return Math.round(Math.min(4, Math.max(0.25, raw)) * 100) / 100;
    })(),
    rosterStripCollapsed:
      typeof (o as Partial<ChoreographyProjectJson>).rosterStripCollapsed ===
      "boolean"
        ? (o as Partial<ChoreographyProjectJson>).rosterStripCollapsed
        : undefined,
    rosterHidesTimeline:
      typeof (o as Partial<ChoreographyProjectJson>).rosterHidesTimeline ===
      "boolean"
        ? (o as Partial<ChoreographyProjectJson>).rosterHidesTimeline
        : undefined,
    rosterStripSortMode: ((): RosterStripSortMode | undefined => {
      const m = (o as Partial<ChoreographyProjectJson>).rosterStripSortMode;
      if (
        m === "import" ||
        m === "height_desc" ||
        m === "height_asc" ||
        m === "grade" ||
        m === "skill"
      ) {
        return m;
      }
      return undefined;
    })(),
    viewMode: o.viewMode === "view" ? "view" : "edit",
  };
}

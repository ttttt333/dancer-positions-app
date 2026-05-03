import type {
  AudienceEdge,
  ChoreographyProjectJson,
  Crew,
  CrewMember,
  Cue,
  DancerSpot,
  Formation,
  GapApproachRoute,
  RosterStripSortMode,
  SavedSpotLayout,
  StageShape,
} from "../types/choreography";
import { modDancerColorIndex } from "./dancerColorPalette";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "./dancerSpacing";
import { parseGapApproachRoute } from "./gapDancerInterpolation";
import { clampStageGridAxisMm, parseAudienceEdge } from "./projectDefaults";
import { generateId } from "./generateId";
import {
  deleteFlowLibraryAudio,
  getFlowLibraryAudio,
  putFlowLibraryAudio,
} from "./flowLibraryLocalAudio";

/**
 * 「フローライブラリ」— 1 曲ぶんの **立ち位置の流れ**（フォーメーション群＋キュー順）を
 * 名前付きで端末ローカルに保存して、別の曲・別のプロジェクトでも呼び出せるようにする。
 *
 * - プロジェクト `savedSpotLayouts`（1 形だけのスナップショット）や、
 *   `形の箱`（個別の立ち位置単位の倉庫）とは別軸の **「曲構成テンプレ」** にあたる。
 * - 保存先は `localStorage`。プロジェクト本体（.json）には載らないので、
 *   保存量は端末の容量次第（5MB 上限）。
 * - 任意で「秒数タイミング」も含められる。違う曲に当てるときはオフが既定。
 * - 保存時点の **ステージ幅・奥行・場ミリ（dancerSpacingMm）・客席向き・変形舞台** なども
 *   `stageSettings` として保持し、呼び出し時にキューとともに復元する（旧データは従来どおり）。
 */

const STORAGE_KEY = "choreogrid_flow_library_v1";
/** 1 フローあたりのキュー上限・形上限（容量と画面の両方を守るための保険） */
const MAX_CUES = 200;
const MAX_FORMATIONS = 200;
const MAX_DANCERS_PER_FORM = 80;
const MAX_NAME_LEN = 120;

/**
 * フロー内の 1 つの「形」。プロジェクト側の `Formation` の最小コピー。
 * - id はフロー内で一意（cues[].formationIdRef が指す）
 * - 立ち位置の生データ（xPct/yPct）と、人物識別ラベルだけを持つ
 */
export interface FlowFormationSnapshot {
  id: string;
  name: string;
  dancers: {
    label: string;
    xPct: number;
    yPct: number;
    colorIndex?: number;
    note?: string;
  }[];
}

/** フローのキュー 1 行ぶん。秒数は `hasTiming === false` なら null。 */
export interface FlowCueSnapshot {
  /** 並び順用のクライアント生成 ID（参照には使わない） */
  id: string;
  name?: string;
  note?: string;
  tStartSec: number | null;
  tEndSec: number | null;
  formationIdRef: string;
  /** 前キュー終了〜このキュー開始のギャップでの移動経路（旧ライブラリのみ簡易キューに含む） */
  gapApproachFromPrev?: GapApproachRoute;
}

/**
 * フロー保存時点のステージ寸法・場ミリ・客席向きなど。
 * 呼び出し時に現在プロジェクトより優先して復元する（旧フローに無い場合は復元しない）。
 */
export interface FlowStageSettingsSnapshot {
  audienceEdge: AudienceEdge;
  stageWidthMm: number | null;
  stageDepthMm: number | null;
  sideStageMm: number | null;
  backStageMm: number | null;
  centerFieldGuideIntervalMm: number | null;
  dancerSpacingMm?: number;
  gridSpacingMm?: number;
  stageShape?: StageShape;
  hanamichiEnabled?: boolean;
  hanamichiDepthPct?: number;
  dancerMarkerDiameterMm?: number;
  snapGrid: boolean;
  gridStep: number;
  stageGridLinesEnabled?: boolean;
  stageGridLinesVerticalEnabled?: boolean;
  stageGridLinesHorizontalEnabled?: boolean;
  stageGridLineSpacingMm?: number;
  stageGridSpacingWidthMm?: number;
  stageGridSpacingDepthMm?: number;
  dancerLabelPosition?: "inside" | "below";
  dancerMarkerDiameterPx?: number;
}

/**
 * フローに同梱する名簿・立ち位置リスト・音源・波形など（bundleVersion 2）。
 * 旧フローには無く、読み込み時は省略される。
 */
export interface FlowLibraryMemento {
  crews: Crew[];
  savedSpotLayouts: SavedSpotLayout[];
  rosterStripSortMode?: RosterStripSortMode;
  rosterHidesTimeline?: boolean;
  rosterStripCollapsed?: boolean;
  pieceDancerCount: number | null;
  dancerLabelPosition?: "inside" | "below";
  dancerMarkerDiameterPx?: number;
  /** 保存時の楽曲尺（秒）。波形復元・等間隔再配置の目安 */
  audioDurationSec?: number;
  audioAssetId: number | null;
  /** Supabase Storage（バケット choreocore-audio）内のオブジェクトパス。`audioAssetId` と排他 */
  audioSupabasePath?: string | null;
  playbackRate: number;
  trimStartSec: number;
  trimEndSec: number | null;
  waveformAmplitudeScale?: number;
  /** タイムライン描画用の正規化ピーク（長さは通常 400） */
  wavePeaks?: number[];
  /**
   * IndexedDB（`flowLibraryLocalAudio`）に保存したローカル音源のキー。
   * サーバ `audioAssetId` が無いプロジェクト向け。フロー JSON バックアップではキーだけが出る点に注意。
   */
  flowEmbeddedAudioKey?: string;
  /**
   * JSON バックアップ取り専用。`flowEmbeddedAudioKey` の内容を再現する（localStorage には持たない）。
   */
  flowEmbeddedAudioBase64?: string;
  flowEmbeddedAudioMimeType?: string;
}

export interface FlowLibraryItem {
  id: string;
  name: string;
  /** タイミング（秒数）も保存しているか */
  hasTiming: boolean;
  /** ダンサー人数（フィルタ表示用、最初の形の人数） */
  dancerCount: number;
  /** キュー数 */
  cueCount: number;
  formations: FlowFormationSnapshot[];
  cues: FlowCueSnapshot[];
  /** 保存時のステージ設定。未保存の旧データは undefined */
  stageSettings?: FlowStageSettingsSnapshot;
  createdAt: number;
  updatedAt: number;
  /**
   * 新規保存・上書き保存したときのクラウド作品 ID。共有 URL をフローごとに出し分ける。
   */
  linkedServerProjectId?: number;
  /** 2 = formationsFull / cuesFull / memento を含む完全バンドル */
  bundleVersion?: 2;
  /** フォーメーション完全形（大道具・床マークアップ・スナップショット含む） */
  formationsFull?: Formation[];
  /** キュー完全形（元 id・移動経路を保持） */
  cuesFull?: Cue[];
  memento?: FlowLibraryMemento;
}

/**
 * 形の箱と同じく、同一タブ内で mutation を伝えるためのカスタムイベント。
 */
export const FLOW_LIBRARY_CHANGE_EVENT = "flowLibrary:changed";

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(FLOW_LIBRARY_CHANGE_EVENT));
  } catch {
    /** 一部環境で Event の生成に失敗するが致命ではない */
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function roundCueSec(v: number): number {
  return Math.round(v * 100) / 100;
}

function cuesHaveValidAbsoluteTimeline(
  cues: readonly { tStartSec: number; tEndSec: number }[]
): boolean {
  return (
    cues.length > 0 &&
    cues.every(
      (c) =>
        Number.isFinite(c.tStartSec) &&
        Number.isFinite(c.tEndSec) &&
        c.tEndSec > c.tStartSec + 1e-9
    )
  );
}

/**
 * 目標の総尺に合わせてキュー区間をスケールする。区間長とキュー間ギャップの比率を維持する。
 * 無効なタイムラインのときだけ従来どおり等間隔に割る。
 */
function rescaleCueTimelinePreservingGaps(
  cues: Cue[],
  opts: {
    totalDurationSec?: number | null;
    minCueLengthSec?: number;
  }
): void {
  if (cues.length === 0) return;
  const minLen = Math.max(0.05, opts.minCueLengthSec ?? 0.8);
  if (!cuesHaveValidAbsoluteTimeline(cues)) {
    const total = Math.max(
      minLen * cues.length,
      opts.totalDurationSec != null &&
        opts.totalDurationSec > 0 &&
        Number.isFinite(opts.totalDurationSec)
        ? opts.totalDurationSec
        : Math.max(2, cues.length)
    );
    const step = total / cues.length;
    cues.forEach((c, i) => {
      c.tStartSec = roundCueSec(step * i);
      c.tEndSec = roundCueSec(step * (i + 1));
    });
    return;
  }
  const sorted = [...cues].sort((a, b) => a.tStartSec - b.tStartSec);
  const lo = sorted[0]!.tStartSec;
  const hi = sorted[sorted.length - 1]!.tEndSec;
  const srcSpan = Math.max(1e-6, hi - lo);
  let target =
    opts.totalDurationSec != null &&
    opts.totalDurationSec > 0 &&
    Number.isFinite(opts.totalDurationSec)
      ? opts.totalDurationSec
      : srcSpan;
  const minNeed = minLen * cues.length;
  target = Math.max(target, minNeed);
  const scale = target / srcSpan;
  for (const c of cues) {
    c.tStartSec = roundCueSec((c.tStartSec - lo) * scale);
    c.tEndSec = roundCueSec((c.tEndSec - lo) * scale);
  }
  sorted.sort((a, b) => a.tStartSec - b.tStartSec);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (cur.tStartSec < prev.tEndSec - 1e-6) {
      cur.tStartSec = prev.tEndSec;
    }
    if (cur.tEndSec <= cur.tStartSec + 1e-6) {
      cur.tEndSec = roundCueSec(cur.tStartSec + minLen);
    }
  }
}

const MAX_WAVE_PEAKS_LEN = 8000;

function deepCloneJson<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function trimWavePeaks(peaks: number[] | null | undefined): number[] | undefined {
  if (!peaks?.length) return undefined;
  const arr = peaks.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!arr.length) return undefined;
  if (arr.length > MAX_WAVE_PEAKS_LEN) return arr.slice(0, MAX_WAVE_PEAKS_LEN);
  return arr;
}

export type FlowSaveOpts = {
  /**
   * 互換用。現在はキュー秒は常に `cues` / `cuesFull` の両方に保存する（true 相当）。
   */
  includeTiming: boolean;
  /** タイムラインが保持している波形ピーク（保存時点） */
  wavePeaks?: number[] | null;
  /** 保存時の楽曲尺（秒）。フロー復元時の波形・等間隔配置に使用 */
  audioDurationSec?: number | null;
  /** ローカル取り込み音源を IndexedDB に同梱したときのキー */
  flowEmbeddedAudioKey?: string | null;
  /** 保存時点のクラウド作品 ID。付与するとフロー行ごとに共有 URL を記録できる */
  linkServerId?: number | null;
};

function buildMementoFromProject(
  project: ChoreographyProjectJson,
  opts: FlowSaveOpts
): FlowLibraryMemento {
  return {
    crews: deepCloneJson(project.crews ?? []),
    savedSpotLayouts: deepCloneJson(project.savedSpotLayouts ?? []),
    rosterStripSortMode: project.rosterStripSortMode,
    rosterHidesTimeline: project.rosterHidesTimeline,
    rosterStripCollapsed: project.rosterStripCollapsed,
    pieceDancerCount: project.pieceDancerCount ?? null,
    dancerLabelPosition: project.dancerLabelPosition,
    dancerMarkerDiameterPx: project.dancerMarkerDiameterPx,
    audioDurationSec:
      opts.audioDurationSec != null &&
      Number.isFinite(opts.audioDurationSec) &&
      opts.audioDurationSec > 0
        ? opts.audioDurationSec
        : undefined,
    audioAssetId: project.audioAssetId,
    ...(typeof project.audioSupabasePath === "string" && project.audioSupabasePath.trim().length > 0
      ? { audioSupabasePath: project.audioSupabasePath.trim() }
      : {}),
    playbackRate: project.playbackRate,
    trimStartSec: project.trimStartSec,
    trimEndSec: project.trimEndSec,
    waveformAmplitudeScale: project.waveformAmplitudeScale,
    wavePeaks: trimWavePeaks(opts.wavePeaks ?? undefined),
    ...(opts.flowEmbeddedAudioKey
      ? { flowEmbeddedAudioKey: opts.flowEmbeddedAudioKey }
      : {}),
  };
}

function snapshotStageFromProject(
  p: ChoreographyProjectJson
): FlowStageSettingsSnapshot {
  return {
    audienceEdge: p.audienceEdge,
    stageWidthMm: p.stageWidthMm,
    stageDepthMm: p.stageDepthMm,
    sideStageMm: p.sideStageMm ?? null,
    backStageMm: p.backStageMm ?? null,
    centerFieldGuideIntervalMm: p.centerFieldGuideIntervalMm ?? null,
    dancerSpacingMm: p.dancerSpacingMm,
    gridSpacingMm: p.gridSpacingMm,
    stageShape: p.stageShape,
    hanamichiEnabled: p.hanamichiEnabled,
    hanamichiDepthPct: p.hanamichiDepthPct,
    dancerMarkerDiameterMm: p.dancerMarkerDiameterMm,
    snapGrid: false,
    gridStep: p.gridStep,
    stageGridLinesEnabled:
      (p.stageGridLinesVerticalEnabled ?? p.stageGridLinesEnabled ?? false) ||
      (p.stageGridLinesHorizontalEnabled ?? p.stageGridLinesEnabled ?? false),
    stageGridLinesVerticalEnabled:
      p.stageGridLinesVerticalEnabled ?? p.stageGridLinesEnabled ?? false,
    stageGridLinesHorizontalEnabled:
      p.stageGridLinesHorizontalEnabled ?? p.stageGridLinesEnabled ?? false,
    stageGridLineSpacingMm: p.stageGridLineSpacingMm,
    stageGridSpacingWidthMm: p.stageGridSpacingWidthMm ?? p.stageGridLineSpacingMm,
    stageGridSpacingDepthMm: p.stageGridSpacingDepthMm ?? p.stageGridLineSpacingMm,
    ...(p.dancerLabelPosition === "inside" || p.dancerLabelPosition === "below"
      ? { dancerLabelPosition: p.dancerLabelPosition }
      : {}),
    ...(typeof p.dancerMarkerDiameterPx === "number" &&
    Number.isFinite(p.dancerMarkerDiameterPx)
      ? { dancerMarkerDiameterPx: p.dancerMarkerDiameterPx }
      : {}),
  };
}

/** localStorage から読んだ `stageSettings` を検証・正規化。不正なら undefined */
function normalizeStageSettings(
  raw: unknown
): FlowStageSettingsSnapshot | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const audienceEdge = parseAudienceEdge(o.audienceEdge);
  if (audienceEdge === undefined) return undefined;
  const mmOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    audienceEdge,
    stageWidthMm: mmOrNull(o.stageWidthMm),
    stageDepthMm: mmOrNull(o.stageDepthMm),
    sideStageMm: mmOrNull(o.sideStageMm),
    backStageMm: mmOrNull(o.backStageMm),
    centerFieldGuideIntervalMm: mmOrNull(o.centerFieldGuideIntervalMm),
    ...(typeof o.dancerSpacingMm === "number" && Number.isFinite(o.dancerSpacingMm)
      ? { dancerSpacingMm: o.dancerSpacingMm }
      : {}),
    ...(typeof o.gridSpacingMm === "number" && Number.isFinite(o.gridSpacingMm)
      ? { gridSpacingMm: o.gridSpacingMm }
      : {}),
    ...(o.stageShape != null &&
    typeof o.stageShape === "object" &&
    !Array.isArray(o.stageShape)
      ? { stageShape: o.stageShape as StageShape }
      : {}),
    ...(typeof o.hanamichiEnabled === "boolean"
      ? { hanamichiEnabled: o.hanamichiEnabled }
      : {}),
    ...(typeof o.hanamichiDepthPct === "number" && Number.isFinite(o.hanamichiDepthPct)
      ? { hanamichiDepthPct: clamp(o.hanamichiDepthPct, 8, 36) }
      : {}),
    ...(typeof o.dancerMarkerDiameterMm === "number" &&
    Number.isFinite(o.dancerMarkerDiameterMm)
      ? { dancerMarkerDiameterMm: o.dancerMarkerDiameterMm }
      : {}),
    snapGrid: false,
    gridStep:
      typeof o.gridStep === "number" && Number.isFinite(o.gridStep)
        ? clamp(o.gridStep, 0.1, 50)
        : 2,
    ...(typeof o.stageGridLinesEnabled === "boolean"
      ? { stageGridLinesEnabled: o.stageGridLinesEnabled }
      : {}),
    ...(typeof o.stageGridLinesVerticalEnabled === "boolean"
      ? { stageGridLinesVerticalEnabled: o.stageGridLinesVerticalEnabled }
      : {}),
    ...(typeof o.stageGridLinesHorizontalEnabled === "boolean"
      ? { stageGridLinesHorizontalEnabled: o.stageGridLinesHorizontalEnabled }
      : {}),
    ...(() => {
      const legacy = clampStageGridAxisMm(o.stageGridLineSpacingMm, 10);
      const w = clampStageGridAxisMm(o.stageGridSpacingWidthMm, legacy);
      const d = clampStageGridAxisMm(o.stageGridSpacingDepthMm, legacy);
      return {
        stageGridLineSpacingMm: w,
        stageGridSpacingWidthMm: w,
        stageGridSpacingDepthMm: d,
      };
    })(),
    ...(o.dancerLabelPosition === "inside" || o.dancerLabelPosition === "below"
      ? { dancerLabelPosition: o.dancerLabelPosition }
      : {}),
    ...(typeof o.dancerMarkerDiameterPx === "number" &&
    Number.isFinite(o.dancerMarkerDiameterPx)
      ? { dancerMarkerDiameterPx: o.dancerMarkerDiameterPx }
      : {}),
  };
}

/**
 * フローに保存されていたステージ設定をプロジェクトへ上書き適用する。
 */
export function applyFlowStageSettingsToProject(
  project: ChoreographyProjectJson,
  stage: FlowStageSettingsSnapshot
): ChoreographyProjectJson {
  const legacy = clampStageGridAxisMm(
    stage.stageGridLineSpacingMm ?? project.stageGridLineSpacingMm,
    10
  );
  const w = clampStageGridAxisMm(
    stage.stageGridSpacingWidthMm ??
      stage.stageGridLineSpacingMm ??
      project.stageGridSpacingWidthMm,
    legacy
  );
  const d = clampStageGridAxisMm(
    stage.stageGridSpacingDepthMm ??
      stage.stageGridLineSpacingMm ??
      project.stageGridSpacingDepthMm,
    legacy
  );
  return {
    ...project,
    audienceEdge: stage.audienceEdge,
    stageWidthMm: stage.stageWidthMm,
    stageDepthMm: stage.stageDepthMm,
    sideStageMm: stage.sideStageMm ?? null,
    backStageMm: stage.backStageMm ?? null,
    centerFieldGuideIntervalMm: stage.centerFieldGuideIntervalMm ?? null,
    dancerSpacingMm: stage.dancerSpacingMm,
    gridSpacingMm: stage.gridSpacingMm,
    stageShape: stage.stageShape,
    hanamichiEnabled: stage.hanamichiEnabled,
    hanamichiDepthPct: stage.hanamichiDepthPct,
    dancerMarkerDiameterMm: stage.dancerMarkerDiameterMm,
    snapGrid: false,
    gridStep: stage.gridStep,
    ...(stage.stageGridLinesVerticalEnabled !== undefined ||
    stage.stageGridLinesHorizontalEnabled !== undefined
      ? {
          stageGridLinesVerticalEnabled:
            stage.stageGridLinesVerticalEnabled ??
            stage.stageGridLinesEnabled ??
            false,
          stageGridLinesHorizontalEnabled:
            stage.stageGridLinesHorizontalEnabled ??
            stage.stageGridLinesEnabled ??
            false,
          stageGridLinesEnabled:
            (stage.stageGridLinesVerticalEnabled ??
              stage.stageGridLinesEnabled ??
              false) ||
            (stage.stageGridLinesHorizontalEnabled ??
              stage.stageGridLinesEnabled ??
              false),
        }
      : stage.stageGridLinesEnabled !== undefined
        ? {
            stageGridLinesEnabled: stage.stageGridLinesEnabled,
            stageGridLinesVerticalEnabled: stage.stageGridLinesEnabled,
            stageGridLinesHorizontalEnabled: stage.stageGridLinesEnabled,
          }
        : {}),
    stageGridLineSpacingMm: w,
    stageGridSpacingWidthMm: w,
    stageGridSpacingDepthMm: d,
    ...(stage.dancerLabelPosition === "inside" || stage.dancerLabelPosition === "below"
      ? { dancerLabelPosition: stage.dancerLabelPosition }
      : {}),
    ...(typeof stage.dancerMarkerDiameterPx === "number" &&
    Number.isFinite(stage.dancerMarkerDiameterPx)
      ? { dancerMarkerDiameterPx: stage.dancerMarkerDiameterPx }
      : {}),
  };
}

function crewMemberFromSpot(d: DancerSpot, memberId: string): CrewMember {
  const label = (d.label || "").trim().slice(0, 120) || "?";
  return {
    id: memberId,
    label,
    colorIndex: modDancerColorIndex(
      typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
        ? Math.floor(d.colorIndex)
        : 0
    ),
    ...(typeof d.heightCm === "number" && Number.isFinite(d.heightCm)
      ? { heightCm: d.heightCm }
      : {}),
    ...(d.gradeLabel?.trim()
      ? { gradeLabel: d.gradeLabel.trim().slice(0, 32) }
      : {}),
    ...(d.genderLabel?.trim()
      ? { genderLabel: d.genderLabel.trim().slice(0, 32) }
      : {}),
    ...(d.skillRankLabel?.trim()
      ? { skillRankLabel: d.skillRankLabel.trim().slice(0, 24) }
      : {}),
    ...(d.note?.trim() ? { note: d.note.trim().slice(0, 2000) } : {}),
  };
}

/**
 * 名簿にメンバーが 1 人もいないとき、ステージ上の印から名簿を補完する。
 * - 印に `crewMemberId` があるのに名簿が空（memento 欠落・手編集 JSON 等）→ その id で行を復元
 * - どの印にも紐付けが無い → アクティブ形の並びで 1 行ずつ作成し、人数が同じ他形へ同じ id を割当
 *
 * フローライブラリ呼び出し直後など、メンバー一覧が空になるのを防ぐ。
 */
export function ensureCrewsFromFormationsIfEmpty(
  project: ChoreographyProjectJson
): ChoreographyProjectJson {
  if (project.crews.some((c) => c.members.length > 0)) return project;

  const active = project.formations.find((f) => f.id === project.activeFormationId);
  if (!active || active.dancers.length === 0) return project;

  const idToSpot = new Map<string, DancerSpot>();
  const orderedFormations: Formation[] = [];
  orderedFormations.push(active);
  for (const f of project.formations) {
    if (f.id !== active.id) orderedFormations.push(f);
  }
  for (const f of orderedFormations) {
    for (const d of f.dancers) {
      if (d.crewMemberId && !idToSpot.has(d.crewMemberId)) {
        idToSpot.set(d.crewMemberId, d);
      }
    }
  }

  if (idToSpot.size > 0) {
    const members = [...idToSpot.entries()].map(([id, d]) =>
      crewMemberFromSpot(d, id)
    );
    return {
      ...project,
      crews: [{ id: generateId(), name: "名簿", members }],
    };
  }

  const memberIds: string[] = [];
  const members: CrewMember[] = [];
  for (let i = 0; i < active.dancers.length; i++) {
    const mid = generateId();
    memberIds.push(mid);
    members.push(crewMemberFromSpot(active.dancers[i], mid));
  }

  const formations = project.formations.map((f) => {
    if (f.dancers.length !== active.dancers.length) return f;
    return {
      ...f,
      dancers: f.dancers.map((d, i) => ({
        ...d,
        crewMemberId: memberIds[i],
      })),
    };
  });

  return {
    ...project,
    crews: [{ id: generateId(), name: "名簿", members }],
    formations,
  };
}

function isValidFormationSnap(x: unknown): x is FlowFormationSnapshot {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    Array.isArray(o.dancers)
  );
}

function isValidCueSnap(x: unknown): x is FlowCueSnapshot {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.formationIdRef === "string";
}

function isValidItem(x: unknown): x is FlowLibraryItem {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  const hasLegacy =
    Array.isArray(o.formations) &&
    o.formations.length > 0 &&
    Array.isArray(o.cues) &&
    o.cues.length > 0;
  const hasFull =
    Array.isArray(o.formationsFull) &&
    o.formationsFull.length > 0 &&
    Array.isArray(o.cuesFull) &&
    o.cuesFull.length > 0;
  return typeof o.id === "string" && typeof o.name === "string" && (hasLegacy || hasFull);
}

const ROSTER_SORT_MODES: readonly RosterStripSortMode[] = [
  "import",
  "height_desc",
  "height_asc",
  "grade",
  "skill",
];

function normalizeMementoFromRaw(raw: unknown): FlowLibraryMemento | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.crews)) return undefined;
  /** 旧エクスポート等で `savedSpotLayouts` が欠ける場合も名簿だけは復元する */
  const savedSpotLayouts: SavedSpotLayout[] = Array.isArray(o.savedSpotLayouts)
    ? deepCloneJson(o.savedSpotLayouts)
    : [];
  const pr =
    typeof o.playbackRate === "number" && Number.isFinite(o.playbackRate)
      ? o.playbackRate
      : 1;
  const ts =
    typeof o.trimStartSec === "number" && Number.isFinite(o.trimStartSec)
      ? o.trimStartSec
      : 0;
  const te =
    o.trimEndSec == null
      ? null
      : typeof o.trimEndSec === "number" && Number.isFinite(o.trimEndSec)
        ? o.trimEndSec
        : null;
  const aid =
    typeof o.audioAssetId === "number" && Number.isFinite(o.audioAssetId)
      ? o.audioAssetId
      : null;
  try {
    const sortRaw = o.rosterStripSortMode;
    const rosterStripSortMode =
      typeof sortRaw === "string" && (ROSTER_SORT_MODES as readonly string[]).includes(sortRaw)
        ? (sortRaw as RosterStripSortMode)
        : undefined;
    return {
      crews: deepCloneJson(o.crews) as Crew[],
      savedSpotLayouts,
      ...(rosterStripSortMode ? { rosterStripSortMode } : {}),
      rosterHidesTimeline:
        typeof o.rosterHidesTimeline === "boolean" ? o.rosterHidesTimeline : undefined,
      rosterStripCollapsed:
        typeof o.rosterStripCollapsed === "boolean" ? o.rosterStripCollapsed : undefined,
      pieceDancerCount:
        typeof o.pieceDancerCount === "number" && Number.isFinite(o.pieceDancerCount)
          ? o.pieceDancerCount
          : null,
      dancerLabelPosition:
        o.dancerLabelPosition === "inside" || o.dancerLabelPosition === "below"
          ? o.dancerLabelPosition
          : undefined,
      dancerMarkerDiameterPx:
        typeof o.dancerMarkerDiameterPx === "number" &&
        Number.isFinite(o.dancerMarkerDiameterPx)
          ? o.dancerMarkerDiameterPx
          : undefined,
      audioDurationSec:
        typeof o.audioDurationSec === "number" &&
        Number.isFinite(o.audioDurationSec) &&
        o.audioDurationSec > 0
          ? o.audioDurationSec
          : undefined,
      audioAssetId: aid,
      ...(typeof o.audioSupabasePath === "string" && o.audioSupabasePath.trim().length > 0
        ? { audioSupabasePath: o.audioSupabasePath.trim() }
        : {}),
      playbackRate: pr,
      trimStartSec: ts,
      trimEndSec: te,
      waveformAmplitudeScale:
        typeof o.waveformAmplitudeScale === "number" &&
        Number.isFinite(o.waveformAmplitudeScale)
          ? o.waveformAmplitudeScale
          : undefined,
      wavePeaks: trimWavePeaks(o.wavePeaks as number[] | undefined),
      ...(typeof o.flowEmbeddedAudioKey === "string" && o.flowEmbeddedAudioKey.length > 0
        ? { flowEmbeddedAudioKey: o.flowEmbeddedAudioKey }
        : {}),
      ...(typeof o.flowEmbeddedAudioBase64 === "string" && o.flowEmbeddedAudioBase64.length > 0
        ? {
            flowEmbeddedAudioBase64: o.flowEmbeddedAudioBase64,
            ...(typeof o.flowEmbeddedAudioMimeType === "string" && o.flowEmbeddedAudioMimeType
              ? { flowEmbeddedAudioMimeType: o.flowEmbeddedAudioMimeType }
              : {}),
          }
        : {}),
    };
  } catch {
    return undefined;
  }
}

function normalizeBundleFromRaw(raw: FlowLibraryItem): {
  bundleVersion?: 2;
  formationsFull?: Formation[];
  cuesFull?: Cue[];
  memento?: FlowLibraryMemento;
} {
  const o = raw as unknown as Record<string, unknown>;
  const ff = o.formationsFull;
  const cf = o.cuesFull;
  let formationsFull: Formation[] | undefined;
  let cuesFull: Cue[] | undefined;
  if (Array.isArray(ff) && ff.length > 0) {
    try {
      formationsFull = deepCloneJson(ff as Formation[]);
    } catch {
      formationsFull = undefined;
    }
  }
  if (Array.isArray(cf) && cf.length > 0) {
    try {
      cuesFull = deepCloneJson(cf as Cue[]);
    } catch {
      cuesFull = undefined;
    }
  }
  const memento = normalizeMementoFromRaw(o.memento);
  if (formationsFull?.length && cuesFull?.length) {
    return {
      bundleVersion: 2,
      formationsFull,
      cuesFull,
      ...(memento ? { memento } : {}),
    };
  }
  return {};
}

function normalize(raw: FlowLibraryItem): FlowLibraryItem {
  const rawRec = raw as unknown as Record<string, unknown>;
  const srcForm: FlowFormationSnapshot[] =
    raw.formations && raw.formations.length > 0
      ? raw.formations
      : raw.formationsFull && raw.formationsFull.length > 0
        ? raw.formationsFull.map((f) => ({
            id: f.id,
            name: (f.name || "").slice(0, MAX_NAME_LEN),
            dancers: f.dancers.slice(0, MAX_DANCERS_PER_FORM).map((d) => ({
              label: d.label,
              xPct: d.xPct,
              yPct: d.yPct,
              ...(typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
                ? { colorIndex: modDancerColorIndex(Math.floor(d.colorIndex)) }
                : {}),
              ...(d.note ? { note: d.note.slice(0, 2000) } : {}),
            })),
          }))
        : [];
  const srcCuesBase: FlowCueSnapshot[] =
    raw.cues && raw.cues.length > 0
      ? raw.cues
      : raw.cuesFull && raw.cuesFull.length > 0
        ? raw.cuesFull.map((c) => ({
            id: c.id,
            name: c.name,
            note: c.note,
            tStartSec: c.tStartSec,
            tEndSec: c.tEndSec,
            formationIdRef: c.formationId,
            ...(c.gapApproachFromPrev ? { gapApproachFromPrev: c.gapApproachFromPrev } : {}),
          }))
        : [];

  const formations = (srcForm as unknown[])
    .filter(isValidFormationSnap)
    .slice(0, MAX_FORMATIONS)
    .map((f, i) => ({
      id: typeof f.id === "string" && f.id ? f.id : `f${i}`,
      name: (f.name || "").slice(0, MAX_NAME_LEN),
      dancers: (f.dancers ?? [])
        .slice(0, MAX_DANCERS_PER_FORM)
        .map((d, j) => ({
          label: (d.label || String(j + 1)).slice(0, 32),
          xPct: clamp(d.xPct, DANCER_STAGE_POSITION_PCT_LO, DANCER_STAGE_POSITION_PCT_HI),
          yPct: clamp(d.yPct, DANCER_STAGE_POSITION_PCT_LO, DANCER_STAGE_POSITION_PCT_HI),
          ...(typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
            ? { colorIndex: modDancerColorIndex(Math.floor(d.colorIndex)) }
            : {}),
          ...(typeof d.note === "string" && d.note.trim()
            ? { note: d.note.slice(0, 2000) }
            : {}),
        })),
    }));
  const formationIds = new Set(formations.map((f) => f.id));
  const cues = (srcCuesBase as unknown[])
    .filter(isValidCueSnap)
    .slice(0, MAX_CUES)
    .filter((c) => formationIds.has((c as FlowCueSnapshot).formationIdRef))
    .map((c0, i) => {
      const c = c0 as FlowCueSnapshot;
      const rawCue = c as unknown as Record<string, unknown>;
      const gap =
        c.gapApproachFromPrev ??
        parseGapApproachRoute(rawCue.gapApproachFromPrev);
      return {
        id: c.id || `c${i}`,
        name:
          typeof c.name === "string" && c.name.trim()
            ? c.name.slice(0, MAX_NAME_LEN)
            : undefined,
        note:
          typeof c.note === "string" && c.note.trim()
            ? c.note.slice(0, 2000)
            : undefined,
        tStartSec:
          typeof c.tStartSec === "number" && Number.isFinite(c.tStartSec)
            ? c.tStartSec
            : null,
        tEndSec:
          typeof c.tEndSec === "number" && Number.isFinite(c.tEndSec)
            ? c.tEndSec
            : null,
        formationIdRef: c.formationIdRef,
        ...(gap ? { gapApproachFromPrev: gap } : {}),
      };
    });
  const dancerCount = formations[0]?.dancers.length ?? 0;
  const fullCuesRaw = rawRec.cuesFull;
  const hasTimingFromFull =
    Array.isArray(fullCuesRaw) &&
    fullCuesRaw.length > 0 &&
    (fullCuesRaw as { tStartSec: number; tEndSec: number }[]).every(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        Number.isFinite(c.tStartSec) &&
        Number.isFinite(c.tEndSec) &&
        c.tEndSec > c.tStartSec + 1e-9
    );
  const hasTiming =
    hasTimingFromFull ||
    cues.some(
      (c) =>
        typeof c.tStartSec === "number" &&
        typeof c.tEndSec === "number" &&
        c.tEndSec > c.tStartSec
    );
  const stageSettings = normalizeStageSettings(rawRec.stageSettings);
  const linkSid = rawRec.linkedServerProjectId;
  const linkedServerProjectId =
    typeof linkSid === "number" && Number.isFinite(linkSid) && linkSid > 0
      ? Math.floor(linkSid)
      : undefined;
  return {
    id: raw.id,
    name: (raw.name || "").slice(0, MAX_NAME_LEN),
    hasTiming,
    dancerCount: clamp(Math.floor(dancerCount), 0, MAX_DANCERS_PER_FORM),
    cueCount: cues.length,
    formations,
    cues,
    ...(stageSettings ? { stageSettings } : {}),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    ...normalizeBundleFromRaw(raw),
    ...(linkedServerProjectId != null ? { linkedServerProjectId } : {}),
  };
}

function safeParseAll(): FlowLibraryItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidItem).map(normalize);
  } catch {
    return [];
  }
}

class FlowLibraryQuotaError extends Error {
  constructor() {
    super(
      "ブラウザ内の保存領域が一杯です。古いフローを削除するか、JSON にバックアップしてからやり直してください。"
    );
    this.name = "FlowLibraryQuotaError";
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    const end = Math.min(i + 0x8000, bytes.length);
    for (let j = i; j < end; j++) {
      s += String.fromCharCode(bytes[j]!);
    }
  }
  return btoa(s);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const n = bin.length;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * localStorage には Base64 を載せない（JSON 取り込み直後の一時データを落とす）
 */
function stripMementoForLocalStorage(
  m: FlowLibraryMemento | undefined
): FlowLibraryMemento | undefined {
  if (!m) return m;
  if (m.flowEmbeddedAudioBase64 == null && m.flowEmbeddedAudioMimeType == null) {
    return m;
  }
  const { flowEmbeddedAudioBase64: _b, flowEmbeddedAudioMimeType: _t, ...rest } = m;
  return rest;
}

function stripItemForLocalStorage(it: FlowLibraryItem): FlowLibraryItem {
  const m = stripMementoForLocalStorage(it.memento);
  if (m === it.memento) return it;
  return { ...it, memento: m as FlowLibraryMemento };
}

async function rehydrateEmbeddedAudioFromJsonItems(
  items: FlowLibraryItem[]
): Promise<FlowLibraryItem[]> {
  const out: FlowLibraryItem[] = [];
  for (const it of items) {
    const m0 = it.memento;
    const b64 = m0?.flowEmbeddedAudioBase64;
    if (typeof b64 === "string" && b64.length > 0) {
      const mime = m0?.flowEmbeddedAudioMimeType || "application/octet-stream";
      const bytes = base64ToUint8Array(b64);
      const arrayBuffer = bytes.buffer instanceof ArrayBuffer ? bytes.buffer : bytes.buffer.slice(0);
      const blob = new Blob([arrayBuffer], { type: mime });
      const newKey = generateId();
      await putFlowLibraryAudio(newKey, blob);
      const m: FlowLibraryMemento = { ...m0! };
      delete (m as unknown as Record<string, unknown>).flowEmbeddedAudioBase64;
      delete (m as unknown as Record<string, unknown>).flowEmbeddedAudioMimeType;
      m.flowEmbeddedAudioKey = newKey;
      out.push({ ...it, memento: m });
    } else {
      out.push(it);
    }
  }
  return out;
}

function writeAll(items: FlowLibraryItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const stripped = items.map(stripItemForLocalStorage);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    notifyChanged();
  } catch (e) {
    const name = (e as { name?: string } | null)?.name ?? "";
    if (
      name === "QuotaExceededError" ||
      name === "NS_ERROR_DOM_QUOTA_REACHED"
    ) {
      throw new FlowLibraryQuotaError();
    }
    throw e;
  }
}

/** 新しい順 */
export function listFlowLibraryItems(): FlowLibraryItem[] {
  return safeParseAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export type FlowSaveResult =
  | { ok: true; item: FlowLibraryItem }
  | { ok: false; reason: "empty" | "quota" | "unknown"; message: string };

/**
 * プロジェクトからフロー 1 件を構築するのみ（localStorage には書かない）。
 * 新規保存・上書きの両方で使い、上書きでは余計な一時レコードを挟まない。
 */
function buildFlowLibraryItemFromProject(
  name: string,
  project: ChoreographyProjectJson,
  opts: FlowSaveOpts
): FlowSaveResult {
  const trimmed = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (!project.formations.length || !project.cues.length) {
    return {
      ok: false,
      reason: "empty",
      message:
        "保存できるフローがありません。キューを 1 つ以上作ってから保存してください。",
    };
  }
  const cuesSorted = [...project.cues].sort(
    (a, b) => a.tStartSec - b.tStartSec
  );
  /** 使われている formation だけ抽出（孤立した形は持ち込まない） */
  const usedFormationIds = new Set(cuesSorted.map((c) => c.formationId));
  const formations: FlowFormationSnapshot[] = project.formations
    .filter((f) => usedFormationIds.has(f.id))
    .slice(0, MAX_FORMATIONS)
    .map((f) => ({
      id: f.id,
      name: f.name?.slice(0, MAX_NAME_LEN) || "",
      dancers: f.dancers
        .slice(0, MAX_DANCERS_PER_FORM)
        .map((d) => ({
          label: d.label,
          xPct: clamp(d.xPct, DANCER_STAGE_POSITION_PCT_LO, DANCER_STAGE_POSITION_PCT_HI),
          yPct: clamp(d.yPct, DANCER_STAGE_POSITION_PCT_LO, DANCER_STAGE_POSITION_PCT_HI),
          ...(typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
            ? { colorIndex: modDancerColorIndex(Math.floor(d.colorIndex)) }
            : {}),
          ...(d.note ? { note: d.note.slice(0, 2000) } : {}),
        })),
    }));
  if (formations.length === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "キューに紐付く形（フォーメーション）が見つかりません。",
    };
  }
  const formationsFull: Formation[] = project.formations
    .filter((f) => usedFormationIds.has(f.id))
    .slice(0, MAX_FORMATIONS)
    .map((f) => deepCloneJson(f));
  const cuesFull: Cue[] = cuesSorted
    .slice(0, MAX_CUES)
    .map((c) => deepCloneJson(c));
  const cues: FlowCueSnapshot[] = cuesSorted.slice(0, MAX_CUES).map((c) => {
    const gap = c.gapApproachFromPrev;
    return {
      id: c.id,
      name:
        typeof c.name === "string" && c.name.trim()
          ? c.name.slice(0, MAX_NAME_LEN)
          : undefined,
      note: c.note ? c.note.slice(0, 2000) : undefined,
      /** 一覧プレビュー用。`cuesFull` と同じ秒（旧「秒数オフ」で null になっていたのをやめる） */
      tStartSec: c.tStartSec,
      tEndSec: c.tEndSec,
      formationIdRef: c.formationId,
      ...(gap ? { gapApproachFromPrev: gap } : {}),
    };
  });
  const hasTimingFromCues =
    cuesSorted.length > 0 && cuesHaveValidAbsoluteTimeline(cuesSorted);
  const now = Date.now();
  const existingCount = safeParseAll().length;
  const memento = buildMementoFromProject(project, opts);
  const item: FlowLibraryItem = {
    id: generateId(),
    name: trimmed || `フロー ${existingCount + 1}`,
    /** バンドル版では常に実タイムラインに基づく（旧「秒数オフ」で hasTiming だけ false になる不整合を防ぐ） */
    hasTiming: hasTimingFromCues,
    dancerCount: formations[0]?.dancers.length ?? 0,
    cueCount: cues.length,
    formations,
    cues,
    stageSettings: snapshotStageFromProject(project),
    createdAt: now,
    updatedAt: now,
    bundleVersion: 2,
    formationsFull,
    cuesFull,
    memento,
  };
  if (
    opts.linkServerId != null &&
    Number.isFinite(opts.linkServerId) &&
    opts.linkServerId > 0
  ) {
    item.linkedServerProjectId = Math.floor(opts.linkServerId);
  }
  return { ok: true, item };
}

/**
 * 現在のプロジェクト状態を新規フローとして保存。
 * 同名のフローも別レコードになる（重複は呼び出し側で制御してもよい）。
 */
export function saveFlowFromProject(
  name: string,
  project: ChoreographyProjectJson,
  opts: FlowSaveOpts
): FlowSaveResult {
  const built = buildFlowLibraryItemFromProject(name, project, opts);
  if (!built.ok) return built;
  const cur = safeParseAll();
  cur.unshift(built.item);
  try {
    writeAll(cur);
    return built;
  } catch (e) {
    if (e instanceof FlowLibraryQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message:
        e instanceof Error
          ? e.message
          : "保存中に予期しないエラーが発生しました。",
    };
  }
}

/** 既存フローを「現在のプロジェクト」で上書き（同じ id・名前は維持） */
export function overwriteFlowFromProject(
  id: string,
  project: ChoreographyProjectJson,
  opts: FlowSaveOpts
): FlowSaveResult {
  const cur = safeParseAll();
  const target = cur.find((x) => x.id === id);
  if (!target) {
    return {
      ok: false,
      reason: "unknown",
      message: "上書き対象のフローが見つかりませんでした。",
    };
  }
  const fresh = buildFlowLibraryItemFromProject(target.name, project, opts);
  if (!fresh.ok) return fresh;
  const oldEmb = target.memento?.flowEmbeddedAudioKey;
  const newEmb = fresh.item.memento?.flowEmbeddedAudioKey;
  if (oldEmb && oldEmb !== newEmb) {
    void deleteFlowLibraryAudio(oldEmb);
  }
  const next = cur.map((x) =>
    x.id === id
      ? {
          ...fresh.item,
          id: target.id,
          name: target.name,
          createdAt: target.createdAt,
          updatedAt: Date.now(),
          linkedServerProjectId:
            fresh.item.linkedServerProjectId ?? target.linkedServerProjectId,
        }
      : x
  );
  try {
    writeAll(next);
    const updated = next.find((x) => x.id === id)!;
    return { ok: true, item: updated };
  } catch (e) {
    if (e instanceof FlowLibraryQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message:
        e instanceof Error ? e.message : "上書き中にエラーが発生しました。",
    };
  }
}

export function renameFlowItem(id: string, name: string): boolean {
  const trimmed = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (!trimmed) return false;
  try {
    writeAll(
      safeParseAll().map((x) =>
        x.id === id ? { ...x, name: trimmed, updatedAt: Date.now() } : x
      )
    );
    return true;
  } catch {
    return false;
  }
}

export function deleteFlowItem(id: string): void {
  try {
    const cur = safeParseAll();
    const target = cur.find((x) => x.id === id);
    const oldKey = target?.memento?.flowEmbeddedAudioKey;
    if (oldKey) void deleteFlowLibraryAudio(oldKey);
    writeAll(cur.filter((x) => x.id !== id));
  } catch {
    try {
      writeAll(safeParseAll().filter((x) => x.id !== id));
    } catch {
      /** 一部環境で失敗しても致命ではない */
    }
  }
}

/**
 * フローを `Formation[]` と `Cue[]` に展開する（呼び出し側でプロジェクトに代入）。
 *
 * - `replaceTiming === false`: タイミングは現在のプロジェクトの長さを目安に等間隔で配り直す
 *   （フローに timing が無いとき／違う曲に当てたいとき）。
 * - `replaceTiming === true` かつフローに timing があるとき: そのまま秒数を復元する。
 *
 * 戻り値は `formations` / `cues` / `activeFormationId`。プロジェクトにそのまま差し込めば良い。
 */
export interface ExpandedFlow {
  formations: Formation[];
  cues: Cue[];
  activeFormationId: string;
  /** フローにステージ設定が含まれるときのみ。呼び出し側でプロジェクトへマージ */
  stageSettings: FlowStageSettingsSnapshot | null;
  /** bundleVersion 2 の名簿・立ち位置リスト・音源・波形など */
  memento?: FlowLibraryMemento;
}

export function expandFlowToProject(
  item: FlowLibraryItem,
  opts: {
    replaceTiming: boolean;
    /** タイミングを置き換えない場合の総尺（秒）。曲の長さなど。 */
    totalDurationSec?: number | null;
    /** タイミングを置き換えない場合の 1 区間の最低長さ（秒） */
    minCueLengthSec?: number;
  }
): ExpandedFlow {
  if (
    item.bundleVersion === 2 &&
    item.formationsFull &&
    item.formationsFull.length > 0 &&
    item.cuesFull &&
    item.cuesFull.length > 0
  ) {
    const formations = deepCloneJson(item.formationsFull);
    let cues: Cue[] = deepCloneJson(item.cuesFull);
    const fids = new Set(formations.map((f) => f.id));
    cues = cues.filter((c) => fids.has(c.formationId));
    const useTiming = opts.replaceTiming && item.hasTiming;
    if (!useTiming) {
      rescaleCueTimelinePreservingGaps(cues, {
        totalDurationSec: opts.totalDurationSec,
        minCueLengthSec: opts.minCueLengthSec ?? 0.8,
      });
    }
    const activeFormationId =
      formations.find((f) => f.id === cues[0]?.formationId)?.id ??
      formations[0]?.id ??
      "";
    const stageSettings =
      item.stageSettings != null
        ? normalizeStageSettings(item.stageSettings) ?? null
        : null;
    const memento = item.memento ? deepCloneJson(item.memento) : undefined;
    return { formations, cues, activeFormationId, stageSettings, memento };
  }

  /** id を新規採番（プロジェクト側の既存 id と衝突しないように） */
  const idMap = new Map<string, string>();
  for (const f of item.formations) {
    idMap.set(f.id, generateId());
  }
  const formations: Formation[] = item.formations.map((f) => ({
    id: idMap.get(f.id)!,
    name: f.name || "",
    setPieces: [],
    dancers: f.dancers.map<DancerSpot>((d, i) => ({
      id: generateId(),
      label: d.label || String(i + 1),
      xPct: d.xPct,
      yPct: d.yPct,
      colorIndex:
        typeof d.colorIndex === "number"
          ? modDancerColorIndex(d.colorIndex)
          : modDancerColorIndex(i),
      ...(d.note ? { note: d.note } : {}),
    })),
  }));

  const useTiming = opts.replaceTiming && item.hasTiming;
  const cuesOut: Cue[] = item.cues
    .map((c, i) => {
      const fid = idMap.get(c.formationIdRef);
      if (!fid) {
        /** 通常は normalize でフィルタ済みだが、防衛 */
        return null;
      }
    return {
      id: typeof c.id === "string" && c.id ? c.id : generateId(),
      tStartSec:
        useTiming && c.tStartSec != null ? c.tStartSec : i,
      tEndSec:
        useTiming && c.tEndSec != null
          ? c.tEndSec
          : i + Math.max(0.5, opts.minCueLengthSec ?? 1),
      formationId: fid,
      ...(c.name ? { name: c.name } : {}),
      ...(c.note ? { note: c.note } : {}),
      ...(c.gapApproachFromPrev
        ? { gapApproachFromPrev: c.gapApproachFromPrev }
        : {}),
    };
  })
    .filter((c): c is Cue => c !== null);

  if (!useTiming) {
    rescaleCueTimelinePreservingGaps(cuesOut, {
      totalDurationSec: opts.totalDurationSec,
      minCueLengthSec: opts.minCueLengthSec ?? 0.8,
    });
  }

  const activeFormationId = formations[0]?.id ?? "";
  const stageSettings =
    item.stageSettings != null
      ? normalizeStageSettings(item.stageSettings) ?? null
      : null;
  return { formations, cues: cuesOut, activeFormationId, stageSettings };
}

/** バックアップ: フロー全件を JSON 文字列に（音源は含まない。`exportFlowLibraryJsonAsync` を推奨） */
export function exportFlowLibraryJson(): string {
  return JSON.stringify(
    { version: 1, items: listFlowLibraryItems() },
    null,
    2
  );
}

/**
 * バックアップ: フロー全件 + 各フローの同梱ローカル音源（IndexedDB）を Base64 で JSON に含める。
 * 別端末・別ブラウザで取り込んでも音が再生できる。
 */
export async function exportFlowLibraryJsonAsync(): Promise<string> {
  const items = listFlowLibraryItems();
  const enriched = await Promise.all(
    items.map(async (it) => {
      const k = it.memento?.flowEmbeddedAudioKey;
      if (!k) return it;
      const blob = await getFlowLibraryAudio(k);
      if (!blob || blob.size === 0) return it;
      const ab = await blob.arrayBuffer();
      const b64 = uint8ToBase64(new Uint8Array(ab));
      return {
        ...it,
        memento: {
          ...it.memento!,
          flowEmbeddedAudioKey: k,
          flowEmbeddedAudioBase64: b64,
          flowEmbeddedAudioMimeType: blob.type || "audio/mpeg",
        },
      };
    })
  );
  return JSON.stringify(
    { version: 1, items: enriched, embeddedLocalAudio: true as const },
    null,
    2
  );
}

/** 取り込み: JSON テキストから取り込み（`flowEmbeddedAudioBase64` がある場合は IndexedDB に復元） */
export async function importFlowLibraryJsonAsync(text: string): Promise<{
  added: number;
  updated: number;
  skipped: number;
  message?: string;
}> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      added: 0,
      updated: 0,
      skipped: 0,
      message: e instanceof Error ? e.message : "JSON の解析に失敗しました。",
    };
  }
  const items =
    parsed && typeof parsed === "object" && "items" in (parsed as object)
      ? (parsed as { items: unknown[] }).items
      : Array.isArray(parsed)
        ? (parsed as unknown[])
        : [];
  let valid: FlowLibraryItem[] = items.filter(isValidItem).map(normalize);
  try {
    valid = await rehydrateEmbeddedAudioFromJsonItems(valid);
  } catch (e) {
    return {
      added: 0,
      updated: 0,
      skipped: 0,
      message:
        e instanceof Error ? e.message : "同梱音源の復元中にエラーが発生しました。",
    };
  }
  const cur = safeParseAll();
  const byId = new Map(cur.map((x) => [x.id, x]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const it of valid) {
    const existing = byId.get(it.id);
    if (!existing) {
      byId.set(it.id, it);
      added++;
    } else if (it.updatedAt > existing.updatedAt) {
      byId.set(it.id, it);
      updated++;
    } else {
      skipped++;
    }
  }
  try {
    writeAll([...byId.values()]);
    return { added, updated, skipped };
  } catch (e) {
    if (e instanceof FlowLibraryQuotaError) {
      return { added: 0, updated: 0, skipped: 0, message: e.message };
    }
    return {
      added: 0,
      updated: 0,
      skipped: 0,
      message:
        e instanceof Error ? e.message : "取り込み中にエラーが発生しました。",
    };
  }
}

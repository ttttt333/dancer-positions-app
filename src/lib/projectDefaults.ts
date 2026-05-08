import type {
  AudienceEdge,
  ChoreographyProjectJson,
  Formation,
} from "../types/choreography";

const LEGACY_KEY = "dance_stage_positions_v1";

/** プロジェクト既定のダンサー印直径（px）。「未変更」判定にも使う */
export const DEFAULT_DANCER_MARKER_DIAMETER_PX = 36;
/**
 * 名簿取り込み〜名簿からステージへ載せる直後の印直径（px）。
 * 既定より一回り小さく、名簿一覧で多数表示したときの見た目に合わせる。
 */
export const ROSTER_IMPORT_MARKER_DIAMETER_PX = 26;

/** 名簿フローで印を小さくする。ユーザーが既に直径を変えているときは維持 */
export function dancerMarkerDiameterAfterRosterImport(
  currentPx: number | null | undefined
): number {
  const cur = currentPx ?? DEFAULT_DANCER_MARKER_DIAMETER_PX;
  return cur === DEFAULT_DANCER_MARKER_DIAMETER_PX
    ? ROSTER_IMPORT_MARKER_DIAMETER_PX
    : cur;
}

/** ステージ上の印の直径クランプ（px） */
export const MARKER_DIAMETER_PX_MIN = 24;
export const MARKER_DIAMETER_PX_MAX = 140;

export function defaultFormation(): Formation {
  return {
    id: crypto.randomUUID(),
    name: "フォーメーション 1",
    setPieces: [],
    dancers: [],
  };
}

export function createEmptyProject(): ChoreographyProjectJson {
  const f = defaultFormation();
  return {
    version: 3,
    pieceTitle: "",
    pieceDancerCount: null,
    /** 画面下を客席（正面）の既定とする */
    audienceEdge: "bottom",
    stageWidthMm: null,
    stageDepthMm: null,
    sideStageMm: null,
    backStageMm: null,
    centerFieldGuideIntervalMm: null,
    hanamichiEnabled: false,
    hanamichiDepthPct: 14,
    formations: [f],
    savedSpotLayouts: [],
    activeFormationId: f.id,
    cues: [],
    playbackRate: 1,
    trimStartSec: 0,
    trimEndSec: null,
    snapGrid: false,
    gridStep: 2,
    stageGridLinesEnabled: false,
    stageGridLinesVerticalEnabled: false,
    stageGridLinesHorizontalEnabled: false,
    /** 旧単一フィールド互換：縦線間隔（幅方向）と同じ値を入れる */
    stageGridLineSpacingMm: 10,
    /** 縦に引くグリッド線の間隔＝幅方向の実寸（mm）。1〜100 cm */
    stageGridSpacingWidthMm: 10,
    /** 横に引くグリッド線の間隔＝奥行方向の実寸（mm）。1〜100 cm */
    stageGridSpacingDepthMm: 10,
    /**
     * 場ミリ規格の既定は 1.5 m（割センター 75 cm）。stageWidthMm が未設定の
     * うちは画面に効かない（％ベースのまま）が、ステージ寸法を入れた瞬間から
     * この規格で「＋ダンサー」やフォーメーション案がズバッと整列する。
     */
    dancerSpacingMm: 1500,
    dancerMarkerDiameterPx: DEFAULT_DANCER_MARKER_DIAMETER_PX,
    dancerLabelPosition: "inside",
    viewMode: "edit",
    crews: [],
    audioAssetId: null,
    audioSupabasePath: null,
    flowLocalAudioKey: null,
    waveformAmplitudeScale: 1,
  };
}

type LegacyStored = {
  formations: Formation[];
  activeFormationId: string;
};

export function tryMigrateFromLocalStorage(): ChoreographyProjectJson | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyStored;
    if (!parsed.formations?.length) return null;
    const p = createEmptyProject();
    p.formations = parsed.formations;
    p.activeFormationId = parsed.formations.some(
      (x) => x.id === parsed.activeFormationId
    )
      ? parsed.activeFormationId
      : parsed.formations[0].id;
    return p;
  } catch {
    return null;
  }
}

/** グリッド線・実寸スナップの軸ごと間隔（mm）：1 cm〜100 cm */
export const STAGE_GRID_AXIS_MM_MIN = 10;
export const STAGE_GRID_AXIS_MM_MAX = 1000;

export function clampStageGridAxisMm(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.min(
    STAGE_GRID_AXIS_MM_MAX,
    Math.max(STAGE_GRID_AXIS_MM_MIN, Math.round(raw))
  );
}

/** 保存データ上の客席向きを解釈。未対応・不正なら undefined（旧 left/right は下に読み替え） */
export function parseAudienceEdge(raw: unknown): AudienceEdge | undefined {
  if (raw === "top" || raw === "bottom") return raw;
  if (raw === "left" || raw === "right") return "bottom";
  return undefined;
}

/** プロジェクト JSON 用：解釈できなければ既定へ */
export function migrateAudienceEdge(raw: unknown, fallback: AudienceEdge): AudienceEdge {
  return parseAudienceEdge(raw) ?? fallback;
}

export function audienceRotationDeg(edge: AudienceEdge): number {
  switch (edge) {
    case "top":
      return 0;
    case "bottom":
      return 180;
    default:
      return 180;
  }
}

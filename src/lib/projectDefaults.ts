import type {
  AudienceEdge,
  ChoreographyProjectJson,
  Formation,
} from "../types/choreography";

const LEGACY_KEY = "dance_stage_positions_v1";

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
    /**
     * 場ミリ規格の既定は 1.5 m（割センター 75 cm）。stageWidthMm が未設定の
     * うちは画面に効かない（％ベースのまま）が、ステージ寸法を入れた瞬間から
     * この規格で「＋ダンサー」やフォーメーション案がズバッと整列する。
     */
    dancerSpacingMm: 1500,
    dancerMarkerDiameterPx: 44,
    dancerLabelPosition: "inside",
    viewMode: "edit",
    crews: [],
    audioAssetId: null,
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

export function audienceRotationDeg(edge: AudienceEdge): number {
  switch (edge) {
    case "top":
      return 0;
    case "right":
      return 90;
    case "bottom":
      return 180;
    case "left":
      return 270;
    default:
      return 0;
  }
}

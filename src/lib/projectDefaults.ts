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
    dancers: [
      {
        id: crypto.randomUUID(),
        label: "?",
        xPct: 50,
        yPct: 50,
        /** 既定は明るい白系（ステージ中央のマル） */
        colorIndex: 8,
      },
    ],
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
    dancerMarkerDiameterPx: 44,
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

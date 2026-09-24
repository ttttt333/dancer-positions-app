import type {
  ChoreographyProjectJson,
  StageCenterMark,
  StageSleeveCurtain,
  StageSleeveCurtainSide,
} from "../../types/choreography";
import {
  mmFromMeterAndCm,
  mmToMeterCm,
  STAGE_MAIN_FLOOR_MM_MAX,
} from "../../lib/stageDimensions";
import {
  clampStageGridAxisMm,
  STAGE_GRID_AXIS_MM_MIN,
} from "../../lib/projectDefaults";
import { inferFrontGridIntervalMm } from "../../lib/stageArchitectureGuides";
import {
  createDefaultSleeveCurtain,
  normalizeStageSleeveCurtains,
  sleeveCurtainsToDepthsMm,
} from "../../lib/stageSleeveCurtains";
import {
  createDefaultCenterMark,
  normalizeStageCenterMarks,
} from "../../lib/stageCenterMarks";

export type StageAreaMeterCmDraft = { m: string; cm: string };

export type StageAreaSleeveDraft = {
  id: string;
  label: string;
  depth: StageAreaMeterCmDraft;
  side: StageSleeveCurtainSide;
  inset: StageAreaMeterCmDraft;
  /** null = そで全幅（自動）。数値 = 舞台端からそで側へ mm */
  wingExtentMm: number | null;
};

export type StageAreaSettingsDraft = {
  audienceEdge: ChoreographyProjectJson["audienceEdge"];
  width: StageAreaMeterCmDraft;
  depth: StageAreaMeterCmDraft;
  side: StageAreaMeterCmDraft;
  back: StageAreaMeterCmDraft;
  guide: StageAreaMeterCmDraft;
  gridStep: number;
  stageGridLinesVerticalEnabled: boolean;
  stageGridLinesHorizontalEnabled: boolean;
  /** 幅方向グリッド間隔（場ミリと同じ m/cm） */
  gridWidth: StageAreaMeterCmDraft;
  /** 奥行方向＝前からのグリッド間隔（場ミリと同じ m/cm） */
  gridDepth: StageAreaMeterCmDraft;
  dancerLabelPosition: "inside" | "below";
  stageHesoVisible: boolean;
  stageCenterMarks: StageCenterMark[];
  stageSleeves: StageAreaSleeveDraft[];
};

export const STAGE_AREA_AUDIENCE_OPTIONS: {
  value: ChoreographyProjectJson["audienceEdge"];
  label: string;
}[] = [
  { value: "top", label: "上" },
  { value: "bottom", label: "下" },
];

export const STAGE_AREA_DIM_ROWS: {
  key: "width" | "depth" | "side" | "back" | "guide";
  title: string;
}[] = [
  { key: "width", title: "メイン幅（上手〜下手）" },
  { key: "depth", title: "奥行（客席方向）" },
  { key: "side", title: "サイド（片側）" },
  { key: "back", title: "バック" },
  { key: "guide", title: "場ミリ（センターから）" },
];

export function clampStageMainMm(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return 0;
  return Math.min(STAGE_MAIN_FLOOR_MM_MAX, Math.round(mm));
}

export function mmToMeterCmDraft(mm: number | null | undefined): StageAreaMeterCmDraft {
  if (mm == null || mm <= 0) return { m: "", cm: "" };
  const u = mmToMeterCm(clampStageMainMm(mm));
  return { m: String(u.m), cm: String(u.cm) };
}

/** 空欄なら null（未設定）。cm は 0〜99（10 mm 刻み） */
export function parseMeterCmDraftToMm(d: StageAreaMeterCmDraft): number | null {
  const mT = d.m.trim();
  const cT = d.cm.trim();
  if (mT === "" && cT === "") return null;
  const m = mT === "" ? 0 : parseInt(mT, 10);
  const cm = cT === "" ? 0 : parseInt(cT, 10);
  if (!Number.isFinite(m) || !Number.isFinite(cm)) return null;
  const mm = clampStageMainMm(mmFromMeterAndCm(m, cm));
  return mm > 0 ? mm : null;
}

/** 場ミリはメイン幅の半分以下（`StageDimensionFields` と同じ） */
export function clampGuideIntervalToWidth(
  widthMm: number | null,
  intervalMm: number | null
): number | null {
  if (intervalMm == null || widthMm == null || widthMm <= 0) return intervalMm;
  const maxHalf = Math.max(1, Math.floor(widthMm / 2));
  return Math.min(Math.max(1, Math.floor(intervalMm)), maxHalf);
}

export function emptyStageAreaSettingsDraft(): StageAreaSettingsDraft {
  return {
    audienceEdge: "bottom",
    width: { m: "", cm: "" },
    depth: { m: "", cm: "" },
    side: { m: "", cm: "" },
    back: { m: "", cm: "" },
    guide: { m: "", cm: "" },
    gridStep: 1,
    stageGridLinesVerticalEnabled: false,
    stageGridLinesHorizontalEnabled: false,
    gridWidth: { m: "0", cm: "1" },
    gridDepth: { m: "0", cm: "1" },
    dancerLabelPosition: "inside",
    stageHesoVisible: false,
    stageCenterMarks: [],
    stageSleeves: [],
  };
}

/** @deprecated cm UI 用。m/cm ドラフトへ移行後もテスト互換で残す */
export function clampGridSpacingCm(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(100, Math.round(raw)));
}

export function parseGridSpacingInput(raw: string): number {
  const normalized = raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[^\d]/g, "");
  return Number(normalized);
}

export function parseGridMeterCmDraftToMm(
  d: StageAreaMeterCmDraft,
  fallbackMm = STAGE_GRID_AXIS_MM_MIN
): number {
  const raw = parseMeterCmDraftToMm(d);
  return clampStageGridAxisMm(raw, fallbackMm);
}

export function sleeveToDraft(c: StageSleeveCurtain): StageAreaSleeveDraft {
  const insetMm = c.insetMm ?? 450;
  return {
    id: c.id,
    label: c.label?.trim() || "そで幕",
    depth: mmToMeterCmDraft(c.depthMm),
    side: c.side ?? "both",
    inset:
      insetMm <= 0
        ? { m: "0", cm: "0" }
        : mmToMeterCmDraft(insetMm),
    wingExtentMm:
      typeof c.wingExtentMm === "number" ? c.wingExtentMm : null,
  };
}

export function sleeveDraftToCurtain(d: StageAreaSleeveDraft): StageSleeveCurtain {
  const depthMm = parseMeterCmDraftToMm(d.depth) ?? 2000;
  const mT = d.inset.m.trim();
  const cT = d.inset.cm.trim();
  let insetMm = 450;
  if (mT !== "" || cT !== "") {
    const m = mT === "" ? 0 : parseInt(mT, 10);
    const cm = cT === "" ? 0 : parseInt(cT, 10);
    if (Number.isFinite(m) && Number.isFinite(cm)) {
      insetMm = Math.max(0, Math.min(20_000, Math.round(m * 1000 + cm * 10)));
    }
  }
  return {
    id: d.id || crypto.randomUUID(),
    depthMm: Math.max(100, Math.min(50_000, depthMm)),
    label: d.label.trim().slice(0, 48) || "そで幕",
    side: d.side,
    insetMm,
    ...(d.wingExtentMm != null
      ? { wingExtentMm: Math.max(0, Math.min(20_000, d.wingExtentMm)) }
      : {}),
  };
}

export function createEmptySleeveDraft(index = 1): StageAreaSleeveDraft {
  return sleeveToDraft(
    createDefaultSleeveCurtain(2000, `そで幕 ${index}`)
  );
}

export function projectToStageAreaDraft(
  p: ChoreographyProjectJson
): StageAreaSettingsDraft {
  const legacy = p.stageGridLineSpacingMm ?? 10;
  let gridWmm = clampStageGridAxisMm(
    p.stageGridSpacingWidthMm ?? p.stageGridLineSpacingMm,
    legacy
  );
  let gridDmm = clampStageGridAxisMm(
    p.stageGridSpacingDepthMm ?? p.stageGridLineSpacingMm,
    legacy
  );
  const inferred = inferFrontGridIntervalMm(p.stageFrontGridLinesMm);
  if (inferred != null && gridDmm <= 10) {
    gridDmm = clampStageGridAxisMm(inferred, gridDmm);
  }
  const sleeves = normalizeStageSleeveCurtains(
    p.stageSleeveCurtains,
    p.stageSleeveCurtainDepthsMm
  );
  const hesoVisible = p.stageHesoVisible === true;
  const centerMarks = normalizeStageCenterMarks(p.stageCenterMarks, {
    seedCenterIfEmpty: hesoVisible,
  });
  return {
    audienceEdge: p.audienceEdge,
    width: mmToMeterCmDraft(p.stageWidthMm),
    depth: mmToMeterCmDraft(p.stageDepthMm),
    side: mmToMeterCmDraft(p.sideStageMm),
    back: mmToMeterCmDraft(p.backStageMm),
    guide: mmToMeterCmDraft(p.centerFieldGuideIntervalMm),
    gridStep: p.gridStep,
    stageGridLinesVerticalEnabled:
      p.stageGridLinesVerticalEnabled ?? p.stageGridLinesEnabled ?? false,
    stageGridLinesHorizontalEnabled:
      p.stageGridLinesHorizontalEnabled ?? p.stageGridLinesEnabled ?? false,
    gridWidth: mmToMeterCmDraft(gridWmm),
    gridDepth: mmToMeterCmDraft(gridDmm),
    dancerLabelPosition: p.dancerLabelPosition ?? "inside",
    stageHesoVisible: hesoVisible,
    stageCenterMarks: centerMarks,
    stageSleeves: sleeves.map(sleeveToDraft),
  };
}

export function stageAreaDraftHasMainFloor(draft: StageAreaSettingsDraft): boolean {
  return (
    parseMeterCmDraftToMm(draft.width) != null &&
    parseMeterCmDraftToMm(draft.depth) != null
  );
}

export function stageAreaDraftToProjectPatch(
  draft: StageAreaSettingsDraft
): Pick<
  ChoreographyProjectJson,
  | "audienceEdge"
  | "stageWidthMm"
  | "stageDepthMm"
  | "sideStageMm"
  | "backStageMm"
  | "centerFieldGuideIntervalMm"
  | "gridStep"
  | "stageGridLinesVerticalEnabled"
  | "stageGridLinesHorizontalEnabled"
  | "stageGridSpacingWidthMm"
  | "stageGridSpacingDepthMm"
  | "dancerLabelPosition"
  | "stageHesoVisible"
  | "stageCenterMarks"
  | "stageFrontGridLinesMm"
  | "stageSleeveCurtainDepthsMm"
  | "stageSleeveCurtains"
> {
  const widthMm = parseMeterCmDraftToMm(draft.width);
  const guideRaw = parseMeterCmDraftToMm(draft.guide);
  const hasMain = widthMm != null && parseMeterCmDraftToMm(draft.depth) != null;
  const curtains = draft.stageSleeves.map(sleeveDraftToCurtain);
  return {
    audienceEdge: draft.audienceEdge,
    stageWidthMm: widthMm,
    stageDepthMm: parseMeterCmDraftToMm(draft.depth),
    sideStageMm: parseMeterCmDraftToMm(draft.side),
    backStageMm: parseMeterCmDraftToMm(draft.back),
    centerFieldGuideIntervalMm: clampGuideIntervalToWidth(widthMm, guideRaw),
    gridStep: draft.gridStep,
    stageGridLinesVerticalEnabled: draft.stageGridLinesVerticalEnabled,
    stageGridLinesHorizontalEnabled: draft.stageGridLinesHorizontalEnabled,
    stageGridSpacingWidthMm: hasMain
      ? parseGridMeterCmDraftToMm(draft.gridWidth)
      : undefined,
    stageGridSpacingDepthMm: hasMain
      ? parseGridMeterCmDraftToMm(draft.gridDepth)
      : undefined,
    dancerLabelPosition: draft.dancerLabelPosition,
    stageHesoVisible: draft.stageHesoVisible,
    stageCenterMarks: draft.stageHesoVisible
      ? normalizeStageCenterMarks(draft.stageCenterMarks, {
          seedCenterIfEmpty: true,
        })
      : draft.stageCenterMarks,
    stageFrontGridLinesMm: [],
    stageSleeveCurtains: curtains,
    stageSleeveCurtainDepthsMm: sleeveCurtainsToDepthsMm(curtains),
  };
}

/** 表示 ON 時にマークが空なら中央ヘソを 1 点追加 */
export function ensureCenterMarksWhenVisible(
  visible: boolean,
  marks: readonly StageCenterMark[]
): StageCenterMark[] {
  if (!visible) return [...marks];
  if (marks.length > 0) return [...marks];
  return [createDefaultCenterMark(50, 50, "ヘソ")];
}

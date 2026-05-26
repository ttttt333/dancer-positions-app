import type { ChoreographyProjectJson } from "../../types/choreography";
import {
  mmFromMeterAndCm,
  mmToMeterCm,
  STAGE_MAIN_FLOOR_MM_MAX,
} from "../../lib/stageDimensions";

export type StageAreaMeterCmDraft = { m: string; cm: string };

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
  gridWidthCm: number;
  gridDepthCm: number;
  dancerLabelPosition: "inside" | "below";
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
    gridWidthCm: 1,
    gridDepthCm: 1,
    dancerLabelPosition: "inside",
  };
}

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

export function projectToStageAreaDraft(
  p: ChoreographyProjectJson
): StageAreaSettingsDraft {
  const gridWmm = p.stageGridSpacingWidthMm ?? p.stageGridLineSpacingMm ?? 10;
  const gridDmm = p.stageGridSpacingDepthMm ?? p.stageGridLineSpacingMm ?? 10;
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
    gridWidthCm: clampGridSpacingCm(gridWmm / 10),
    gridDepthCm: clampGridSpacingCm(gridDmm / 10),
    dancerLabelPosition: p.dancerLabelPosition ?? "inside",
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
> {
  const widthMm = parseMeterCmDraftToMm(draft.width);
  const guideRaw = parseMeterCmDraftToMm(draft.guide);
  const hasMain = widthMm != null && parseMeterCmDraftToMm(draft.depth) != null;
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
    stageGridSpacingWidthMm: hasMain ? clampGridSpacingCm(draft.gridWidthCm) * 10 : null,
    stageGridSpacingDepthMm: hasMain ? clampGridSpacingCm(draft.gridDepthCm) * 10 : null,
    dancerLabelPosition: draft.dancerLabelPosition,
  };
}

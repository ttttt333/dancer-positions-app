/**
 * @file `StageBoardBody` 用レイアウト束: シェル外寸・回転、メイン床 ResizeObserver、mm スナップグリッド。`useStageBoardController` と併用。
 */
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { AudienceEdge, ChoreographyProjectJson } from "../types/choreography";
import type { StageShellLayout } from "../lib/stageShellLayout";
import { useStageBoardMainFloorResizeObserver } from "./useStageBoardMainFloorResizeObserver";
import {
  useStageBoardMmSnapGrid,
  type StageBoardMmSnapGridBundle,
} from "./useStageBoardMmSnapGrid";
import { useStageBoardStageShellLayout } from "./useStageBoardStageShellLayout";

export type UseStageBoardLayoutAfterDraftParams = {
  stageResizeDraft: { stageWidthMm: number; stageDepthMm: number } | null;
  stageWidthMm: number | null | undefined;
  stageDepthMm: number | null | undefined;
  sideStageMm: number | null | undefined;
  backStageMm: number | null | undefined;
  audienceEdge: AudienceEdge;
  floorRef: RefObject<HTMLDivElement | null>;
  setMainFloorPxWidth: Dispatch<SetStateAction<number>>;
  project: ChoreographyProjectJson;
  stageGridLinesVertical: boolean;
  stageGridLinesHorizontal: boolean;
};

export type StageBoardLayoutAfterDraftBundle = StageShellLayout &
  StageBoardMmSnapGridBundle;

/** @see モジュール先頭 `@file` */
export function useStageBoardLayoutAfterDraft(
  p: UseStageBoardLayoutAfterDraftParams
): StageBoardLayoutAfterDraftBundle {
  const stageShell = useStageBoardStageShellLayout({
    stageResizeDraft: p.stageResizeDraft,
    stageWidthMm: p.stageWidthMm,
    stageDepthMm: p.stageDepthMm,
    sideStageMm: p.sideStageMm,
    backStageMm: p.backStageMm,
    audienceEdge: p.audienceEdge,
  });

  useStageBoardMainFloorResizeObserver({
    floorRef: p.floorRef,
    setMainFloorPxWidth: p.setMainFloorPxWidth,
    remeasureDeps: {
      Wmm: stageShell.Wmm,
      Dmm: stageShell.Dmm,
      Smm: stageShell.Smm,
      Bmm: stageShell.Bmm,
      rot: stageShell.rot,
      showShell: stageShell.showShell,
      draftStageWidthMm: stageShell.draftStageWidthMm,
      draftStageDepthMm: stageShell.draftStageDepthMm,
    },
  });

  const snap = useStageBoardMmSnapGrid({
    effStageWidthMm: stageShell.effStageWidthMm,
    effStageDepthMm: stageShell.effStageDepthMm,
    stageWidthMm: p.stageWidthMm,
    stageDepthMm: p.stageDepthMm,
    project: p.project,
    stageGridLinesVertical: p.stageGridLinesVertical,
    stageGridLinesHorizontal: p.stageGridLinesHorizontal,
  });

  return {
    ...stageShell,
    ...snap,
  };
}

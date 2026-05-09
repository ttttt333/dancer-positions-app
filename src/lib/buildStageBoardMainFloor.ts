/**
 * @file `StageShellWithMainFloor` 向け mainFloor 束。編集時のみ `floorMarkupToolbar` を渡し、`baseOverlays` に `showStageFloorMarkup` を合成する純関数。
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import type { StageFloorMarkupToolbarHostProps } from "../components/StageFloorMarkupToolbarHost";
import type { StageMainFloorBaseOverlaysProps } from "../components/StageMainFloorBaseOverlays";
import type { StageMainFloorInteractionLayerProps } from "../components/StageMainFloorInteractionLayer";
import type {
  StageShellDimsInput,
  StageShellWithMainFloorProps,
} from "../components/StageShellWithMainFloor";

export type BuildStageBoardMainFloorParams = {
  shellDims: StageShellDimsInput;
  stageMainFloorRef: RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  trimStartSec: number;
  onPointerDownFloor: (e: ReactPointerEvent<HTMLDivElement>) => void;
  mainFloorStyle: CSSProperties;
  setPiecesEditable: boolean;
  /** `setPiecesEditable` が true のときに `floorMarkupToolbar` に渡す中身 */
  floorMarkupToolbarWhenEditable: StageFloorMarkupToolbarHostProps;
  /** `showStageFloorMarkup` 以外（床線・テキスト・格子など） */
  baseOverlaysWithoutShow: Omit<
    StageMainFloorBaseOverlaysProps,
    "showStageFloorMarkup"
  >;
  /** `displayFloorMarkup.length > 0 || !!floorLineDraft` など */
  showStageFloorMarkup: boolean;
  /** 大道具ブロック群（最背面に描画） */
  setPieceElements: ReactNode;
  interaction: StageMainFloorInteractionLayerProps;
};

/** @see モジュール先頭 `@file` */
export function buildStageBoardMainFloor(
  p: BuildStageBoardMainFloorParams
): StageShellWithMainFloorProps {
  return {
    shellDims: p.shellDims,
    stageMainFloorRef: p.stageMainFloorRef,
    isPlaying: p.isPlaying,
    trimStartSec: p.trimStartSec,
    onPointerDownFloor: p.onPointerDownFloor,
    mainFloorStyle: p.mainFloorStyle,
    floorMarkupToolbar: p.setPiecesEditable
      ? p.floorMarkupToolbarWhenEditable
      : undefined,
    setPieceElements: p.setPieceElements,
    baseOverlays: {
      ...p.baseOverlaysWithoutShow,
      showStageFloorMarkup: p.showStageFloorMarkup,
    },
    interaction: p.interaction,
  };
}

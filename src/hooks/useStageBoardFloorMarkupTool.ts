import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import type { StageFloorMarkupTool } from "../components/stageBoardTypes";

export type UseStageBoardFloorMarkupToolParams = {
  floorMarkupToolProp: StageFloorMarkupTool | undefined;
  onFloorMarkupToolChange?: Dispatch<SetStateAction<StageFloorMarkupTool>>;
};

export type StageBoardFloorMarkupToolBundle = {
  floorMarkupTool: StageFloorMarkupTool;
  setFloorMarkupTool: Dispatch<SetStateAction<StageFloorMarkupTool>>;
};

/**
 * 床マークのツール選択（親と共有可）。線ドラフトは `useFloorLineDraw`。
 */
export function useStageBoardFloorMarkupTool({
  floorMarkupToolProp,
  onFloorMarkupToolChange,
}: UseStageBoardFloorMarkupToolParams): StageBoardFloorMarkupToolBundle {
  const [floorMarkupToolUncontrolled, setFloorMarkupToolUncontrolled] =
    useState<StageFloorMarkupTool>(null);
  const markupControlled = typeof onFloorMarkupToolChange === "function";
  const floorMarkupTool = markupControlled
    ? (floorMarkupToolProp as StageFloorMarkupTool)
    : floorMarkupToolUncontrolled;
  const setFloorMarkupTool = markupControlled
    ? onFloorMarkupToolChange!
    : setFloorMarkupToolUncontrolled;

  return {
    floorMarkupTool,
    setFloorMarkupTool,
  };
}

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useRef, useState } from "react";
import type { StageFloorMarkupTool } from "../components/stageBoardTypes";

export type UseStageBoardFloorMarkupToolParams = {
  floorMarkupToolProp: StageFloorMarkupTool | undefined;
  onFloorMarkupToolChange?: Dispatch<SetStateAction<StageFloorMarkupTool>>;
};

export type StageBoardFloorMarkupToolBundle = {
  floorMarkupTool: StageFloorMarkupTool;
  setFloorMarkupTool: Dispatch<SetStateAction<StageFloorMarkupTool>>;
  floorLineDraft: [number, number][] | null;
  setFloorLineDraft: Dispatch<SetStateAction<[number, number][] | null>>;
  floorLineSessionRef: MutableRefObject<{
    points: [number, number][];
    lastClientX: number;
    lastClientY: number;
  } | null>;
};

/**
 * 床マークのツール選択（親と共有可）と、線ツール用ドラフト／セッション ref。
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
  const [floorLineDraft, setFloorLineDraft] = useState<
    [number, number][] | null
  >(null);
  const floorLineSessionRef = useRef<{
    points: [number, number][];
    lastClientX: number;
    lastClientY: number;
  } | null>(null);

  return {
    floorMarkupTool,
    setFloorMarkupTool,
    floorLineDraft,
    setFloorLineDraft,
    floorLineSessionRef,
  };
}

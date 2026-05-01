import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import type { StageBoardBodyProps } from "../components/stageBoardTypes";
import { useStageBoardFloorMarkupTool } from "./useStageBoardFloorMarkupTool";
import { useStageBoardFloorMetrics } from "./useStageBoardFloorMetrics";
import { useStageBoardProjectDerived } from "./useStageBoardProjectDerived";

export type StageBoardControllerInput = Pick<
  StageBoardBodyProps,
  "project" | "floorMarkupTool" | "onFloorMarkupToolChange"
>;

/**
 * `StageBoardBody` 用: 再生フラグ・`project` 派生・床寸法／マーカー基準 px・床マークツール束（段階的に拡張）。
 */
export function useStageBoardController({
  project,
  floorMarkupTool: floorMarkupToolProp,
  onFloorMarkupToolChange,
}: StageBoardControllerInput) {
  const isPlaying = usePlaybackUiStore((s) => s.isPlaying);
  const derived = useStageBoardProjectDerived(project);
  const floorMetrics = useStageBoardFloorMetrics({
    dancerMarkerDiameterMm: derived.dancerMarkerDiameterMm,
    stageWidthMm: derived.stageWidthMm,
    dancerMarkerDiameterPx: derived.dancerMarkerDiameterPx,
  });
  return {
    isPlaying,
    ...derived,
    ...floorMetrics,
    ...useStageBoardFloorMarkupTool({
      floorMarkupToolProp,
      onFloorMarkupToolChange,
    }),
  };
}

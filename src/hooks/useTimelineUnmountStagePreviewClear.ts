import { useEffect } from "react";
import type { DancerSpot } from "../types/choreography";

/** アンマウント時にステージのキュー案プレビューを解除 */
export function useTimelineUnmountStagePreviewClear(
  onStagePreviewChange?: (next: DancerSpot[] | null) => void
) {
  useEffect(() => {
    return () => {
      onStagePreviewChange?.(null);
    };
  }, [onStagePreviewChange]);
}

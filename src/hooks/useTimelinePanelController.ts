import type { Ref } from "react";
import type {
  TimelinePanelBodyProps,
  TimelinePanelHandle,
} from "../components/timelinePanelTypes";
import type { TimelinePanelLayoutProps } from "../components/TimelinePanelLayout";
import { buildTimelinePanelLayoutProps } from "../lib/timelinePanelLayoutProps";
import { useTimelinePanelSessionBundle } from "./useTimelinePanelSessionBundle";
import { useTimelinePanelWaveHandlersBundle } from "./useTimelinePanelWaveHandlersBundle";
import { useRegisterTimelineWaveBridge } from "./useRegisterTimelineWaveBridge";

/**
 * `TimelinePanelBody` 用: セッション → 波形ポインタ → レイアウト props。
 */
export function useTimelinePanelController(
  props: TimelinePanelBodyProps,
  ref: Ref<TimelinePanelHandle>
): TimelinePanelLayoutProps {
  const { waveBundleParams, layoutInputWithoutWavePointers, viewportControls } =
    useTimelinePanelSessionBundle(props, ref);
  const waveHandlers = useTimelinePanelWaveHandlersBundle(waveBundleParams);

  useRegisterTimelineWaveBridge(
    waveBundleParams,
    waveHandlers,
    viewportControls,
    layoutInputWithoutWavePointers.isPlaying
  );

  return buildTimelinePanelLayoutProps({
    ...layoutInputWithoutWavePointers,
    ...waveHandlers,
  });
}

import type { TimelinePanelLayoutProps } from "../components/TimelinePanelLayout";

/** `TimelinePanelLayout` 用 props の組み立て前入力（`hasPeaks` は `peaks` から導出） */
export type BuildTimelinePanelLayoutInput = Omit<
  TimelinePanelLayoutProps,
  "hasPeaks" | "waveTimelineDockTop"
> & {
  peaks: number[] | null;
  waveTimelineDockTop?: boolean;
};

export function buildTimelinePanelLayoutProps(
  p: BuildTimelinePanelLayoutInput
): TimelinePanelLayoutProps {
  const { peaks, waveTimelineDockTop, ...rest } = p;
  return {
    ...rest,
    hasPeaks: !!peaks,
    waveTimelineDockTop: waveTimelineDockTop ?? false,
  };
}

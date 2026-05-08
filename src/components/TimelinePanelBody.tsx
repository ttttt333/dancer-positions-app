import { forwardRef } from "react";
import { useTimelinePanelController } from "../hooks/useTimelinePanelController";
import { TimelinePanelLayout } from "./TimelinePanelLayout";
import type { TimelinePanelBodyProps, TimelinePanelHandle } from "./timelinePanelTypes";

export type { TimelinePanelHandle } from "./timelinePanelTypes";

/** 公開 API は `TimelinePanel.tsx`。実装は `useTimelinePanelController` に集約。 */
export const TimelinePanelBody = forwardRef<
  TimelinePanelHandle,
  TimelinePanelBodyProps
>(function TimelinePanelBody(props, ref) {
  const layoutProps = useTimelinePanelController(props, ref);
  return <TimelinePanelLayout {...layoutProps} />;
});

TimelinePanelBody.displayName = "TimelinePanel";

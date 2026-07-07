import type { RefObject } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { TimelinePanelHandle } from "./timelinePanelTypes";
import { ChoreoViewerTransportControls } from "./ChoreoViewerBottomBar";

type Props = {
  project: ChoreographyProjectJson;
  timelineRef: RefObject<TimelinePanelHandle | null>;
  trimStartSec: number;
  trimEndSec: number | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onBeforeTransport?: () => void | Promise<void>;
};

/** 横画面など: ステージ上に浮かせる再生コントロール */
export function ChoreoViewerStageTransport({
  project,
  timelineRef,
  trimStartSec,
  trimEndSec,
  isPlaying,
  currentTime,
  duration,
  onBeforeTransport,
}: Props) {
  return (
    <div className="choreo-viewer-stage-transport">
      <ChoreoViewerTransportControls
        project={project}
        timelineRef={timelineRef}
        trimStartSec={trimStartSec}
        trimEndSec={trimEndSec}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        compact
        onBeforeTransport={onBeforeTransport}
      />
    </div>
  );
}

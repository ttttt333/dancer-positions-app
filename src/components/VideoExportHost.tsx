import { useEffect } from "react";
import { preloadFFmpegWasm } from "../lib/ffmpegWasm";
import { getVideoExportCanvasRef } from "../lib/videoExportCanvasRef";
import {
  cancelVideoExportRun,
  useVideoExportRunStore,
  type ExportEncodeSubphase,
  type ExportPhase,
} from "../store/videoExportRunStore";
import { ChoreoViewerVideoExportOverlay } from "./ChoreoViewerVideoExportOverlay";

const PHASE_LABEL: Record<Exclude<ExportPhase, null>, string> = {
  recording: "ステージを描画中…",
  converting: "MP4 に変換中…",
  done: "完了",
};

function exportOverlayMessage(
  phase: ExportPhase,
  encodeSubphase: ExportEncodeSubphase | null,
  progressMessage: string
): string {
  if (progressMessage.trim()) return progressMessage;
  if (!phase) return "";
  if (phase === "converting") {
    if (encodeSubphase === "load") return "FFmpeg を準備中…";
    if (encodeSubphase === "mux") return "MP4 に結合中…";
    return "MP4 に変換中…";
  }
  return PHASE_LABEL[phase];
}

/**
 * 動画書き出しのキャンバスと進捗オーバーレイ。
 * モバイル/PC レイアウト切替でもアンマウントされないよう EditorPageLayout 直下に置く。
 */
export function VideoExportHost() {
  const phase = useVideoExportRunStore((s) => s.phase);
  const progress = useVideoExportRunStore((s) => s.progress);
  const progressMessage = useVideoExportRunStore((s) => s.progressMessage);
  const encodeSubphase = useVideoExportRunStore((s) => s.encodeSubphase);
  const canvasRef = getVideoExportCanvasRef();

  useEffect(() => {
    void preloadFFmpegWasm();
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        aria-hidden
        style={{
          position: "fixed",
          left: -9999,
          top: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
      {phase ? (
        <ChoreoViewerVideoExportOverlay
          progress={{
            phase:
              phase === "recording"
                ? "frames"
                : phase === "converting"
                  ? "encode"
                  : "done",
            ratio: progress / 100,
            message: exportOverlayMessage(
              phase,
              encodeSubphase,
              progressMessage
            ),
          }}
          onCancel={cancelVideoExportRun}
        />
      ) : null}
    </>
  );
}

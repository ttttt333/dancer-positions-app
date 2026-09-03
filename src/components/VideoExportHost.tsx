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
  if (phase === "saving") return "共有シートを開いています…";
  if (phase === "recording") return "ステージを描画中…";
  return "完了";
}

function exportOverlayPhase(
  phase: ExportPhase
): "prepare" | "frames" | "encode" | "save" | "done" {
  if (phase === "recording") return "frames";
  if (phase === "converting") return "encode";
  if (phase === "saving") return "save";
  return "done";
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
  const phaseLabel = useVideoExportRunStore((s) => s.phaseLabel);
  const qualityHint = useVideoExportRunStore((s) => s.qualityHint);
  const canvasRef = getVideoExportCanvasRef();

  useEffect(() => {
    void preloadFFmpegWasm();
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
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
            phase: exportOverlayPhase(phase),
            ratio: progress / 100,
            message: exportOverlayMessage(
              phase,
              encodeSubphase,
              progressMessage
            ),
            phaseLabel,
            qualityHint,
          }}
          onCancel={cancelVideoExportRun}
        />
      ) : null}
    </>
  );
}

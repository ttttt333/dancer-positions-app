import { useCallback } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { buildVideoExportOptions } from "../lib/buildVideoExportOptions";
import { resolveVideoExportFileName } from "../lib/videoExportFileName";
import { getVideoExportCanvasRef } from "../lib/videoExportCanvasRef";
import { checkVideoExportCapabilities } from "../lib/videoExportCapabilities";
import { formatVideoExportError } from "../lib/videoExportErrors";
import { useVideoExport } from "../hooks/useVideoExport";
import { useExportToast } from "../hooks/useExportToast";
import { ExportToast } from "./ExportToast";

type Props = {
  project: ChoreographyProjectJson;
  durationSec: number;
  fileName: string;
  className?: string;
};

/** 閲覧画面向けのコンパクトな動画保存ボタン */
export function ChoreoViewerVideoSaveButton({
  project,
  durationSec,
  fileName,
  className,
}: Props) {
  const { toast, showToast, dismiss } = useExportToast();
  const { isExporting, progress, startExport } = useVideoExport();
  const capabilities = checkVideoExportCapabilities();
  const disabled =
    isExporting || durationSec <= 0 || !capabilities.supported;

  const onSave = useCallback(async () => {
    try {
      const options = buildVideoExportOptions(
        project,
        durationSec,
        fileName,
        getVideoExportCanvasRef()
      );
      const result = await startExport({
        ...options,
        shareAfter: false,
        onFfmpegFirstLoad: () =>
          showToast({
            kind: "info",
            title: "FFmpeg コアを読み込み中…",
            description: "初回は 10〜30 秒かかることがあります",
          }),
        onAudioSkipped: () =>
          showToast({
            kind: "info",
            title: "音源なしで書き出し",
            description:
              "音源の取得に失敗したため、映像のみの MP4 として保存します",
          }),
      });
      showToast({
        kind: "success",
        title: "エクスポート完了",
        description: `${result.downloadName} をダウンロードしました`,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const { title, description } = formatVideoExportError(e);
      showToast({ kind: "error", title, description });
      console.error("Viewer video export failed:", e);
    }
  }, [project, durationSec, fileName, startExport, showToast]);

  const exportName = resolveVideoExportFileName(project, fileName);

  return (
    <>
      <ExportToast toast={toast} onDismiss={dismiss} />
      <button
        type="button"
        className={["choreo-viewer-bars__video-btn", className]
          .filter(Boolean)
          .join(" ")}
        disabled={disabled}
        title={
          capabilities.supported
            ? `動画を保存（${exportName}.mp4）`
            : capabilities.blockReason ?? "この環境では動画保存に対応していません"
        }
        aria-label="動画を保存"
        onClick={() => void onSave()}
      >
        {isExporting ? `${progress}%` : "動画"}
      </button>
    </>
  );
}

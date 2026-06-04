import { useCallback, useMemo } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { buildVideoExportOptions } from "../lib/buildVideoExportOptions";
import { resolveVideoExportFileName } from "../lib/videoExportFileName";
import { getVideoExportCanvasRef } from "../lib/videoExportCanvasRef";
import {
  checkVideoExportCapabilities,
  formatVideoExportCapabilityHint,
} from "../lib/videoExportCapabilities";
import { formatVideoExportError } from "../lib/videoExportErrors";
import { useVideoExport } from "../hooks/useVideoExport";
import { useExportToast } from "../hooks/useExportToast";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { ExportToast } from "./ExportToast";

export type VideoExportButtonProps = {
  project: ChoreographyProjectJson;
  durationSec: number;
  fileName: string;
  /** コンパクト表示（横画面の下バー用） */
  compact?: boolean;
};

export function VideoExportButton({
  project,
  durationSec,
  fileName,
  compact = false,
}: VideoExportButtonProps) {
  const { toast, showToast, dismiss } = useExportToast();
  const { isExporting, progress, startExport } = useVideoExport();

  const capabilities = useMemo(() => checkVideoExportCapabilities(), []);
  const exportBaseName = useMemo(
    () => resolveVideoExportFileName(project, fileName),
    [project, fileName]
  );
  const exportBlocked = !capabilities.supported;
  const capabilityHint = useMemo(
    () => formatVideoExportCapabilityHint(capabilities),
    [capabilities]
  );

  const run = useCallback(
    async (shareAfter: boolean) => {
      try {
        const options = buildVideoExportOptions(
          project,
          durationSec,
          fileName,
          getVideoExportCanvasRef()
        );
        const result = await startExport({
          ...options,
          shareAfter,
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

        if (shareAfter && result.shared) {
          showToast({
            kind: "success",
            title: "共有しました",
            description: `${result.downloadName} を共有シートで送れます`,
          });
        } else if (result.format === "webm") {
          showToast({
            kind: "info",
            title: "WebM で保存しました",
            description:
              result.fallbackReason
                ? `MP4 変換できなかったため WebM 形式で保存しました（${result.fallbackReason}）`
                : "MP4 変換できなかったため WebM 形式で保存しました。PC では VLC 等で再生できます",
          });
        } else if (shareAfter) {
          showToast({
            kind: "info",
            title: "ダウンロードしました",
            description: `共有に未対応のため ${result.downloadName} を保存しました`,
          });
        } else {
          showToast({
            kind: "success",
            title: "エクスポート完了",
            description: `${result.downloadName} をダウンロードしました`,
          });
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        const { title, description } = formatVideoExportError(e);
        showToast({
          kind: "error",
          title,
          description,
        });
        console.error("Export failed:", e);
      }
    },
    [project, durationSec, fileName, startExport, showToast]
  );

  const busy = isExporting;
  const disabled = busy || durationSec <= 0 || exportBlocked;

  return (
    <>
      <ExportToast toast={toast} onDismiss={dismiss} />
      {capabilityHint ? (
        <p
          className="choreo-viewer-video-export-hint"
          style={{ marginBottom: compact ? 6 : 8 }}
        >
          {capabilityHint}
        </p>
      ) : null}
      <p
        className="choreo-viewer-video-export-hint"
        style={{ marginBottom: compact ? 6 : 10 }}
      >
        保存名: {exportBaseName}.mp4
      </p>
      <div
        className="choreo-viewer-video-export-prompt"
        style={compact ? { gap: 6 } : undefined}
      >
        <button
          type="button"
          disabled={disabled}
          style={{
            ...btnAccent,
            fontWeight: 700,
            flex: "1 1 auto",
            minHeight: compact ? 36 : 40,
            fontSize: compact ? 12 : 13,
          }}
          onClick={() => void run(true)}
        >
          {busy ? `${progress}%` : "動画を共有"}
        </button>
        <button
          type="button"
          disabled={disabled}
          style={{
            ...btnSecondary,
            flex: "1 1 auto",
            minHeight: compact ? 36 : 40,
            fontSize: compact ? 12 : 13,
          }}
          onClick={() => void run(false)}
        >
          動画を保存
        </button>
      </div>
    </>
  );
}

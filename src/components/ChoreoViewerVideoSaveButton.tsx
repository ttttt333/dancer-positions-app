import { useCallback, useState } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { buildVideoExportOptions } from "../lib/buildVideoExportOptions";
import { resolveVideoExportFileName } from "../lib/videoExportFileName";
import { getVideoExportCanvasRef } from "../lib/videoExportCanvasRef";
import { checkVideoExportCapabilities } from "../lib/videoExportCapabilities";
import { formatVideoExportError } from "../lib/videoExportErrors";
import type { VideoExportQualityPreset } from "../lib/videoExportQualityPresets";
import { useVideoExport } from "../hooks/useVideoExport";
import { useVideoExportGate } from "../hooks/useVideoExportGate";
import { useExportToast } from "../hooks/useExportToast";
import { ExportToast } from "./ExportToast";
import { VideoExportQualitySheet } from "./VideoExportQualitySheet";

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
  const [qualitySheetOpen, setQualitySheetOpen] = useState(false);
  const { toast, showToast, dismiss } = useExportToast();
  const { isExporting, progress, startExport } = useVideoExport();
  const {
    remaining,
    limitReached,
    gateBeforeExport,
    openUpgradeIfNeeded,
    upgradeModal,
  } = useVideoExportGate();
  const capabilities = checkVideoExportCapabilities();
  const disabled =
    isExporting || durationSec <= 0 || !capabilities.supported;

  const runExport = useCallback(
    async (quality: VideoExportQualityPreset) => {
      try {
        const options = buildVideoExportOptions(
          project,
          durationSec,
          fileName,
          getVideoExportCanvasRef(),
          quality
        );
        const result = await startExport({
          ...options,
          quality,
          shareAfter: true,
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

        if (result.shared) {
          showToast({
            kind: "success",
            title: "共有シートを開きました",
            description:
              "「ビデオを保存」をタップするとカメラロールに保存できます",
          });
        } else if (result.format === "webm") {
          showToast({
            kind: "info",
            title: "WebM で保存しました",
            description:
              result.fallbackReason ??
              "MP4 変換できなかったため WebM 形式で保存しました",
          });
        } else {
          showToast({
            kind: "info",
            title: "ダウンロードしました",
            description: `共有に未対応のため ${result.downloadName} を保存しました`,
          });
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const { title, description } = formatVideoExportError(e);
        showToast({ kind: "error", title, description });
        console.error("Viewer video export failed:", e);
      }
    },
    [project, durationSec, fileName, startExport, showToast]
  );

  const onQualitySelect = useCallback(
    (quality: VideoExportQualityPreset) => {
      setQualitySheetOpen(false);
      void runExport(quality);
    },
    [runExport]
  );

  const onOpenQualitySheet = useCallback(async () => {
    if (openUpgradeIfNeeded()) return;
    try {
      const ok = await gateBeforeExport();
      if (ok) setQualitySheetOpen(true);
    } catch (e) {
      const { title, description } = formatVideoExportError(e);
      showToast({ kind: "error", title, description });
    }
  }, [gateBeforeExport, openUpgradeIfNeeded, showToast]);

  const exportName = resolveVideoExportFileName(project, fileName);

  return (
    <>
      <ExportToast toast={toast} onDismiss={dismiss} />
      {upgradeModal}
      <VideoExportQualitySheet
        open={qualitySheetOpen}
        onClose={() => setQualitySheetOpen(false)}
        onSelect={onQualitySelect}
        viewerMode
      />
      <button
        type="button"
        className={["choreo-viewer-bars__video-btn", className]
          .filter(Boolean)
          .join(" ")}
        style={{
          opacity: limitReached ? 0.55 : disabled ? 0.45 : 1,
        }}
        disabled={disabled}
        title={
          limitReached
            ? "動画書き出しの上限に達しました（PROで無制限）"
            : capabilities.supported
              ? `動画を保存（${exportName}.mp4）`
              : capabilities.blockReason ?? "この環境では動画保存に対応していません"
        }
        aria-label="動画を保存"
        onClick={() => void onOpenQualitySheet()}
      >
        {isExporting
          ? `${progress}%`
          : limitReached
            ? "動画（上限）"
            : remaining != null
              ? `動画（残${remaining}）`
              : "動画"}
      </button>
    </>
  );
}

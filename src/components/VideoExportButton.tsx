import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { preloadFFmpegWasm } from "../lib/ffmpegWasm";
import { buildVideoExportOptions } from "../lib/buildVideoExportOptions";
import {
  checkVideoExportCapabilities,
  formatVideoExportCapabilityHint,
} from "../lib/videoExportCapabilities";
import {
  useVideoExport,
  type ExportEncodeSubphase,
  type ExportPhase,
} from "../hooks/useVideoExport";
import { useExportToast } from "../hooks/useExportToast";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { ChoreoViewerVideoExportOverlay } from "./ChoreoViewerVideoExportOverlay";
import { ExportToast } from "./ExportToast";

export type VideoExportButtonProps = {
  project: ChoreographyProjectJson;
  durationSec: number;
  fileName: string;
  /** コンパクト表示（横画面の下バー用） */
  compact?: boolean;
};

const PHASE_LABEL: Record<Exclude<ExportPhase, null>, string> = {
  recording: "ステージを描画中…",
  converting: "MP4 に変換中…",
  done: "完了",
};

function phaseMessage(
  phase: ExportPhase,
  encodeSubphase: ExportEncodeSubphase | null
): string {
  if (!phase) return "";
  if (phase === "converting") {
    if (encodeSubphase === "load") return "FFmpeg を準備中…";
    if (encodeSubphase === "mux") return "MP4 に結合中…（数十秒かかることがあります）";
    return "MP4 に変換中…";
  }
  return PHASE_LABEL[phase];
}

function exportProgressIndeterminate(
  phase: ExportPhase,
  encodeSubphase: ExportEncodeSubphase | null
): boolean {
  return phase === "converting" && encodeSubphase === "mux";
}

export function VideoExportButton({
  project,
  durationSec,
  fileName,
  compact = false,
}: VideoExportButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { toast, showToast, dismiss } = useExportToast();
  const { isExporting, progress, phase, encodeSubphase, startExport, cancelExport } =
    useVideoExport();

  useEffect(() => {
    void preloadFFmpegWasm();
  }, []);

  const capabilities = useMemo(() => checkVideoExportCapabilities(), []);
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
          canvasRef
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
        });

        if (shareAfter && result.shared) {
          showToast({
            kind: "success",
            title: "共有しました",
            description: `${result.downloadName} を共有シートで送れます`,
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
        const msg =
          e instanceof Error ? e.message : "動画の保存に失敗しました";
        showToast({
          kind: "error",
          title: "エクスポート失敗",
          description: msg,
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
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
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
            message: phaseMessage(phase, encodeSubphase),
            indeterminate: exportProgressIndeterminate(phase, encodeSubphase),
          }}
          onCancel={cancelExport}
        />
      ) : null}
      {capabilityHint ? (
        <p
          className="choreo-viewer-video-export-hint"
          style={{ marginBottom: compact ? 6 : 8 }}
        >
          {capabilityHint}
        </p>
      ) : null}
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

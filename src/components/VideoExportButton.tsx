import { useCallback, useMemo, useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { buildVideoExportOptions } from "../lib/buildVideoExportOptions";
import { checkVideoExportCapabilities } from "../lib/videoExportCapabilities";
import { useVideoExport, type ExportPhase } from "../hooks/useVideoExport";
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
  recording: "録画中…",
  converting: "MP4 に変換中…",
  done: "完了",
};

function phaseMessage(phase: ExportPhase, progress: number): string {
  if (!phase) return "";
  const base = PHASE_LABEL[phase];
  return `${base} ${progress}%`;
}

/**
 * 閲覧モード等: `useVideoExport` + 進捗オーバーレイ + 保存／共有ボタン。
 * EditorPage を変更せず EditorStageRowOverlays / ChoreoViewerBottomBar から使う。
 */
export function VideoExportButton({
  project,
  durationSec,
  fileName,
  compact = false,
}: VideoExportButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { toast, showToast, dismiss } = useExportToast();
  const { isExporting, progress, phase, startExport, cancelExport } =
    useVideoExport();

  const capabilities = useMemo(() => checkVideoExportCapabilities(), []);
  const exportBlocked = !capabilities.supported;
  const capabilityHint =
    capabilities.blockReason ??
    (capabilities.warnings.length > 0 ? capabilities.warnings[0] : null);

  const run = useCallback(
    async (shareAfter: boolean) => {
      try {
        const options = buildVideoExportOptions(
          project,
          durationSec,
          fileName,
          canvasRef
        );
        const result = await startExport({ ...options, shareAfter });

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
            message: phaseMessage(phase, progress),
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

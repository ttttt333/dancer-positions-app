import { useEffect, useState } from "react";
import { btnSecondary } from "./stageButtonStyles";

export type VideoExportOverlayProgress = {
  phase: "prepare" | "frames" | "encode" | "save" | "done";
  ratio: number;
  message: string;
  phaseLabel?: string;
  qualityHint?: string;
  /** FFmpeg 結合中など UI が更新されにくい区間 */
  indeterminate?: boolean;
};

type Props = {
  progress: VideoExportOverlayProgress;
  onCancel: () => void;
};

function useSmoothProgress(targetPct: number): number {
  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setDisplayPct((prev) => {
        const next = prev + (targetPct - prev) * 0.18;
        if (Math.abs(targetPct - next) < 0.4) return targetPct;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetPct]);

  return Math.round(Math.max(0, Math.min(100, displayPct)));
}

export function ChoreoViewerVideoExportOverlay({ progress, onCancel }: Props) {
  const indeterminate = Boolean(progress.indeterminate);
  const targetPct = Math.round(
    Math.max(0, Math.min(100, progress.ratio * 100))
  );
  const pct = useSmoothProgress(targetPct);
  const phaseLabel = progress.phaseLabel?.trim() ?? "";

  return (
    <div className="choreo-viewer-video-export-overlay" role="dialog" aria-modal="true">
      <div className="choreo-viewer-video-export-card">
        <p className="choreo-viewer-video-export-title">動画を作成中</p>
        {phaseLabel ? (
          <p className="choreo-viewer-video-export-phase">{phaseLabel}</p>
        ) : null}
        <p className="choreo-viewer-video-export-msg">{progress.message}</p>
        <div
          className="choreo-viewer-video-export-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div
            className={
              indeterminate
                ? "choreo-viewer-video-export-barFill choreo-viewer-video-export-barFill--indeterminate"
                : "choreo-viewer-video-export-barFill"
            }
            style={
              indeterminate
                ? undefined
                : {
                    width: `${pct}%`,
                    transition: "width 0.35s ease-out",
                  }
            }
          />
        </div>
        <p className="choreo-viewer-video-export-pct">
          {indeterminate ? "処理中…" : `${pct}%`}
        </p>
        <p className="choreo-viewer-video-export-hint">
          {progress.qualityHint
            ? `${progress.qualityHint} で書き出しています。画面を閉じずにお待ちください。`
            : "舞台の枠・グリッド・客席前番号を描画して書き出します。画面を閉じずにお待ちください。"}
        </p>
        <button type="button" style={btnSecondary} onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

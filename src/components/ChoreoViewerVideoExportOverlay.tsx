import { btnSecondary } from "./stageButtonStyles";

export type VideoExportOverlayProgress = {
  phase: "prepare" | "frames" | "encode" | "done";
  ratio: number;
  message: string;
  /** FFmpeg 結合中など UI が更新されにくい区間 */
  indeterminate?: boolean;
};

type Props = {
  progress: VideoExportOverlayProgress;
  onCancel: () => void;
};

export function ChoreoViewerVideoExportOverlay({ progress, onCancel }: Props) {
  const indeterminate = Boolean(progress.indeterminate);
  const pct = Math.round(Math.max(0, Math.min(100, progress.ratio * 100)));

  return (
    <div className="choreo-viewer-video-export-overlay" role="dialog" aria-modal="true">
      <div className="choreo-viewer-video-export-card">
        <p className="choreo-viewer-video-export-title">動画を作成中</p>
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
            style={indeterminate ? undefined : { width: `${pct}%` }}
          />
        </div>
        <p className="choreo-viewer-video-export-pct">
          {indeterminate ? "処理中…" : `${pct}%`}
        </p>
        <p className="choreo-viewer-video-export-hint">
          舞台の枠・グリッド・番号を描画して書き出します（12fps・速さ優先）。画面を閉じずにお待ちください。
        </p>
        <button type="button" style={btnSecondary} onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

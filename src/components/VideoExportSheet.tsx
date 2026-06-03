import type { ChoreographyProjectJson } from "../types/choreography";
import { EditorSideSheet } from "./EditorSideSheet";
import { VideoExportButton } from "./VideoExportButton";
import { btnSecondary } from "./stageButtonStyles";
import { useVideoExportRunStore } from "../store/videoExportRunStore";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  durationSec: number;
  fileName: string;
};

/**
 * エディタ用: 動画の共有・保存 UI（閲覧者下バーと同じ `VideoExportButton`）。
 */
export function VideoExportSheet({
  open,
  onClose,
  project,
  durationSec,
  fileName,
}: Props) {
  const isExporting = useVideoExportRunStore((s) => s.isExporting);

  return (
    <EditorSideSheet
      open={open}
      onClose={onClose}
      blockDismiss={isExporting}
      zIndex={76}
      width="min(400px, 92vw)"
      sheetId="video-export"
      ariaLabelledBy="video-export-sheet-title"
    >
      <div style={{ padding: "16px 18px 22px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2
            id="video-export-sheet-title"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "#e2e8f0",
            }}
          >
            動画書き出し
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            disabled={isExporting}
            onClick={onClose}
            style={{
              ...btnSecondary,
              minWidth: 36,
              minHeight: 36,
              padding: "4px 10px",
              opacity: isExporting ? 0.45 : 1,
            }}
          >
            ✕
          </button>
        </div>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 12,
            lineHeight: 1.5,
            color: "#94a3b8",
          }}
        >
          ステージの動きと音源を同期した MP4 を作成します。初回は変換エンジンの読み込みに時間がかかることがあります。
        </p>
        <VideoExportButton
          project={project}
          durationSec={durationSec}
          fileName={fileName}
        />
      </div>
    </EditorSideSheet>
  );
}

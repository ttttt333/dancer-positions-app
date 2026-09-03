import type { ChoreographyProjectJson } from "../types/choreography";
import { EditorSideSheet } from "./EditorSideSheet";
import { VideoExportButton } from "./VideoExportButton";
import { btnSecondary } from "./stageButtonStyles";
import { useVideoExportRunStore } from "../store/videoExportRunStore";
import { shell } from "../theme/choreoShell";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  durationSec: number;
  fileName: string;
};

/**
 * 右バー1ページでサイズを選んで MP4 を書き出す。
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
      width="min(320px, 92vw)"
      sheetId="video-export"
      ariaLabelledBy="video-export-sheet-title"
      panelStyle={{
        background: shell.bgDeep,
        borderLeft: `1px solid ${shell.borderStrong}`,
      }}
    >
      <div style={{ padding: "16px 16px 22px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div>
            <h2
              id="video-export-sheet-title"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: shell.text,
                letterSpacing: "0.01em",
              }}
            >
              動画書き出し
            </h2>
          </div>
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
            margin: "0 0 16px",
            fontSize: 12,
            lineHeight: 1.55,
            color: shell.textMuted,
          }}
        >
          サイズを選んで書き出します。共有できる端末では保存のあと共有シートが開きます。
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

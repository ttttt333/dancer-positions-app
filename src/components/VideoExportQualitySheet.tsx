import { useEffect } from "react";
import { EditorSideSheet } from "./EditorSideSheet";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import {
  formatVideoExportQualitySpec,
  VIDEO_EXPORT_QUALITY_PRESETS,
  type VideoExportQualityPreset,
} from "../lib/videoExportQualityPresets";
import { getDirectMp4RecorderMimeType } from "../lib/videoExportCapabilities";
import { preloadFFmpegWasm } from "../lib/ffmpegWasm";
import { useVideoExportRunStore } from "../store/videoExportRunStore";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (quality: VideoExportQualityPreset) => void;
  /** 閲覧画面向けの簡潔な説明 */
  viewerMode?: boolean;
};

/**
 * 書き出し開始前の画質選択シート（低・中・高）。
 */
export function VideoExportQualitySheet({
  open,
  onClose,
  onSelect,
  viewerMode = false,
}: Props) {
  const isExporting = useVideoExportRunStore((s) => s.isExporting);

  // M: 画質選択中に FFmpeg コアを先読み。
  // Safari 等の MP4 直接出力環境では FFmpeg 自体が不要なので先読みしない。
  useEffect(() => {
    if (!open) return;
    if (getDirectMp4RecorderMimeType()) return;
    void preloadFFmpegWasm();
  }, [open]);

  return (
    <EditorSideSheet
      open={open}
      onClose={onClose}
      blockDismiss={isExporting}
      zIndex={95}
      width="min(400px, 92vw)"
      sheetId="video-export-quality"
      ariaLabelledBy="video-export-quality-title"
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
            id="video-export-quality-title"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "#e2e8f0",
            }}
          >
            画質を選ぶ
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
            lineHeight: 1.55,
            color: "#94a3b8",
          }}
        >
          {viewerMode
            ? "書き出し完了後、共有シートが自動で開きます。iOS では「ビデオを保存」をタップしてカメラロールへ保存してください。"
            : "画質が高いほどきれいですが、書き出しに時間がかかります。"}
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {VIDEO_EXPORT_QUALITY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={isExporting}
              onClick={() => onSelect(preset)}
              style={{
                ...btnAccent,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
                width: "100%",
                minHeight: 56,
                padding: "12px 14px",
                textAlign: "left",
                fontWeight: 700,
              }}
            >
              <span style={{ fontSize: 14, color: "#f8fafc" }}>
                {preset.label}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#cbd5e1",
                  }}
                >
                  {formatVideoExportQualitySpec(preset)}
                </span>
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#fde68a",
                  lineHeight: 1.4,
                }}
              >
                {preset.timeHint}
              </span>
            </button>
          ))}
        </div>
      </div>
    </EditorSideSheet>
  );
}

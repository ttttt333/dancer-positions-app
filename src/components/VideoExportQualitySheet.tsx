import { useEffect, useState } from "react";
import { EditorSideSheet } from "./EditorSideSheet";
import { VideoExportRangeFields } from "./VideoExportRangeFields";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { formatSecToClock } from "../lib/buildRangeExcerptProject";
import {
  parseVideoExportRangeInput,
  type VideoExportTimeRange,
} from "../lib/stageExportRange";
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
  onSelect: (
    quality: VideoExportQualityPreset,
    range: VideoExportTimeRange
  ) => void;
  /** 曲の長さ（秒）。範囲入力の上限・初期値に使う */
  durationSec: number;
  /** 初期開始（秒）。省略時は 0 */
  defaultStartSec?: number;
  /** 初期終了（秒）。null/省略で曲末尾（空欄） */
  defaultEndSec?: number | null;
  /** 閲覧画面向けの簡潔な説明 */
  viewerMode?: boolean;
};

/**
 * 書き出し開始前の画質選択シート（低・中・高・最高）＋範囲指定。
 */
export function VideoExportQualitySheet({
  open,
  onClose,
  onSelect,
  durationSec,
  defaultStartSec = 0,
  defaultEndSec = null,
  viewerMode = false,
}: Props) {
  const isExporting = useVideoExportRunStore((s) => s.isExporting);
  const [startStr, setStartStr] = useState(() =>
    formatSecToClock(defaultStartSec)
  );
  const [endStr, setEndStr] = useState(() =>
    defaultEndSec != null && Number.isFinite(defaultEndSec) && defaultEndSec > 0
      ? formatSecToClock(defaultEndSec)
      : ""
  );
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStartStr(formatSecToClock(defaultStartSec));
    setEndStr(
      defaultEndSec != null &&
        Number.isFinite(defaultEndSec) &&
        defaultEndSec > 0
        ? formatSecToClock(defaultEndSec)
        : ""
    );
    setRangeError(null);
  }, [open, defaultStartSec, defaultEndSec]);

  // M: 画質選択中に FFmpeg コアを先読み。
  // 音声結合は常に FFmpeg で行う（WebCodecs 映像 + FFmpeg 音声結合）ため、
  // 音源付き作品ではほぼ確実に FFmpeg を使う。先読みで待ち時間を隠す。
  // WebCodecs 非対応かつ直接録画のみ可（古い Safari）の場合だけ不要。
  useEffect(() => {
    if (!open) return;
    if (getDirectMp4RecorderMimeType() && typeof VideoEncoder === "undefined") {
      return;
    }
    void preloadFFmpegWasm();
  }, [open]);

  const pick = (preset: VideoExportQualityPreset) => {
    const parsed = parseVideoExportRangeInput(startStr, endStr, durationSec);
    if (!parsed.ok) {
      setRangeError(parsed.error);
      return;
    }
    setRangeError(null);
    onSelect(preset, parsed.range);
  };

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

        <div style={{ marginBottom: 16 }}>
          <VideoExportRangeFields
            startStr={startStr}
            endStr={endStr}
            onStartChange={(v) => {
              setStartStr(v);
              setRangeError(null);
            }}
            onEndChange={(v) => {
              setEndStr(v);
              setRangeError(null);
            }}
            trackDurationSec={durationSec}
            disabled={isExporting}
            error={rangeError}
          />
        </div>

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
              onClick={() => pick(preset)}
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

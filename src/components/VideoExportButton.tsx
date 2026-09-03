import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { buildVideoExportOptions } from "../lib/buildVideoExportOptions";
import { resolveVideoExportFileName } from "../lib/videoExportFileName";
import { getVideoExportCanvasRef } from "../lib/videoExportCanvasRef";
import {
  checkVideoExportCapabilities,
  formatVideoExportCapabilityHint,
  getDirectMp4RecorderMimeType,
} from "../lib/videoExportCapabilities";
import { formatVideoExportError } from "../lib/videoExportErrors";
import {
  DEFAULT_VIDEO_EXPORT_QUALITY,
  VIDEO_EXPORT_QUALITY_PRESETS,
  formatVideoExportQualitySpec,
  formatVideoExportSizeLabel,
  type VideoExportQualityId,
  type VideoExportQualityPreset,
} from "../lib/videoExportQualityPresets";
import { preloadFFmpegWasm } from "../lib/ffmpegWasm";
import { useVideoExport } from "../hooks/useVideoExport";
import { useVideoExportGate } from "../hooks/useVideoExportGate";
import { useExportToast } from "../hooks/useExportToast";
import { btnAccent } from "./stageButtonStyles";
import { ExportToast } from "./ExportToast";
import { shell } from "../theme/choreoShell";

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
  const [qualityId, setQualityId] = useState<VideoExportQualityId>(
    DEFAULT_VIDEO_EXPORT_QUALITY.id
  );
  const { toast, showToast, dismiss } = useExportToast();
  const { isExporting, progress, progressMessage, startExport } = useVideoExport();
  const {
    remaining,
    limitReached,
    gateBeforeExport,
    openUpgradeIfNeeded,
    upgradeModal,
  } = useVideoExportGate();

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
  const selected =
    VIDEO_EXPORT_QUALITY_PRESETS.find((p) => p.id === qualityId) ??
    DEFAULT_VIDEO_EXPORT_QUALITY;

  useEffect(() => {
    if (getDirectMp4RecorderMimeType() && typeof VideoEncoder === "undefined") {
      return;
    }
    void preloadFFmpegWasm();
  }, []);

  const run = useCallback(
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
            title: "書き出しました",
            description: `${result.downloadName} を共有できます`,
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
        } else {
          showToast({
            kind: "success",
            title: "書き出しました",
            description: `${result.downloadName} を保存しました`,
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

  const onExport = useCallback(async () => {
    if (openUpgradeIfNeeded()) return;
    try {
      const ok = await gateBeforeExport();
      if (!ok) return;
      await run(selected);
    } catch (e) {
      const { title, description } = formatVideoExportError(e);
      showToast({ kind: "error", title, description });
    }
  }, [gateBeforeExport, openUpgradeIfNeeded, run, selected, showToast]);

  const busy = isExporting;
  const disabled = busy || durationSec <= 0 || exportBlocked || limitReached;

  return (
    <>
      <ExportToast toast={toast} onDismiss={dismiss} />
      {upgradeModal}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compact ? 10 : 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: shell.accent,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            サイズ
          </div>
          <div
            role="radiogroup"
            aria-label="動画サイズ"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {VIDEO_EXPORT_QUALITY_PRESETS.map((preset) => {
              const active = preset.id === qualityId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy}
                  onClick={() => setQualityId(preset.id)}
                  style={sizeCardStyle(active, busy, compact)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: compact ? 16 : 18,
                        fontWeight: 800,
                        letterSpacing: "0.02em",
                        color: active ? shell.accent : shell.text,
                        lineHeight: 1,
                      }}
                    >
                      {formatVideoExportSizeLabel(preset)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: active ? "#e7d48a" : shell.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      {formatVideoExportQualitySpec(preset)}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      lineHeight: 1.45,
                      color: active ? shell.text : shell.textSubtle,
                    }}
                  >
                    {preset.timeHint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(212,175,55,0.06)",
            border: `1px solid ${shell.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: shell.textMuted,
              lineHeight: 1.5,
              wordBreak: "break-all",
            }}
          >
            {exportBaseName}.mp4
          </div>
          {remaining != null ? (
            <div style={{ marginTop: 4, fontSize: 11, color: shell.accent }}>
              あと{remaining}回書き出せます
            </div>
          ) : null}
          {capabilityHint ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "#fbbf24" }}>
              {capabilityHint}
            </div>
          ) : null}
          {durationSec <= 0 ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "#fbbf24" }}>
              音源を読み込むか、キューを置いてから書き出してください
            </div>
          ) : null}
        </div>

        {busy ? (
          <div>
            <div
              style={{
                height: 4,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(4, Math.min(100, progress))}%`,
                  height: "100%",
                  background: shell.accent,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: shell.textMuted,
              }}
            >
              {progress}%
              {progressMessage ? ` · ${progressMessage}` : ""}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={disabled}
          onClick={() => void onExport()}
          style={{
            ...btnAccent,
            width: "100%",
            minHeight: compact ? 40 : 44,
            fontSize: 14,
            fontWeight: 800,
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {busy
            ? "書き出し中…"
            : limitReached
              ? "書き出し上限です"
              : `${formatVideoExportSizeLabel(selected)} で書き出す`}
        </button>
      </div>
    </>
  );
}

function sizeCardStyle(
  active: boolean,
  busy: boolean,
  compact: boolean
): CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: compact ? "10px 12px" : "12px 14px",
    borderRadius: 12,
    border: active
      ? `1px solid ${shell.accent}`
      : `1px solid ${shell.borderStrong}`,
    background: active ? shell.accentSoft : "rgba(255,255,255,0.03)",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.7 : 1,
  };
}

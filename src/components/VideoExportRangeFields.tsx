import type { CSSProperties } from "react";
import { formatSecToClock } from "../lib/buildRangeExcerptProject";
import { MAX_VIDEO_EXPORT_SEC } from "../lib/stageExportRange";
import { shell } from "../theme/choreoShell";

export type VideoExportRangeFieldsProps = {
  startStr: string;
  endStr: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  trackDurationSec: number;
  disabled?: boolean;
  error?: string | null;
  hint?: string | null;
};

const inputStyle: CSSProperties = {
  width: 72,
  minHeight: 36,
  padding: "6px 8px",
  borderRadius: 10,
  border: `1px solid ${shell.borderStrong}`,
  background: "rgba(0,0,0,0.38)",
  color: shell.text,
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  textAlign: "center",
};

/**
 * 動画書き出しの開始・終了（分:秒）。終わりを空にすると曲の末尾。
 */
export function VideoExportRangeFields({
  startStr,
  endStr,
  onStartChange,
  onEndChange,
  trackDurationSec,
  disabled = false,
  error = null,
  hint = null,
}: VideoExportRangeFieldsProps) {
  const trackLabel = formatSecToClock(Math.max(0, trackDurationSec));
  const maxMin = Math.floor(MAX_VIDEO_EXPORT_SEC / 60);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          color: shell.accent,
          fontWeight: 700,
        }}
      >
        書き出し範囲
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <input
          aria-label="書き出し開始（分:秒）"
          data-video-export-start
          value={startStr}
          disabled={disabled}
          onChange={(e) => onStartChange(e.target.value)}
          placeholder="0:00"
          style={{ ...inputStyle, opacity: disabled ? 0.55 : 1 }}
        />
        <span style={{ color: shell.textMuted, fontSize: 13 }}>〜</span>
        <input
          aria-label="書き出し終了（分:秒）"
          data-video-export-end
          value={endStr}
          disabled={disabled}
          onChange={(e) => onEndChange(e.target.value)}
          placeholder={trackLabel}
          style={{ ...inputStyle, opacity: disabled ? 0.55 : 1 }}
        />
        <span style={{ color: shell.textSubtle, fontSize: 11 }}>
          （曲の長さ {trackLabel}）
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          lineHeight: 1.45,
          color: shell.textSubtle,
        }}
      >
        終わりを空欄にすると曲の最後まで。一度に書き出せるのは最大 {maxMin}{" "}
        分です。
      </p>
      {hint ? (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.45,
            color: "#fde68a",
          }}
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.45,
            color: "#f0a8a8",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

import type { ChangeEvent, CSSProperties, RefObject } from "react";
import { createPortal } from "react-dom";

/** 動画→音声抽出などの進捗（`TimelinePanel` の state と共有） */
export type TimelineExtractProgress = {
  ratio: number;
  stage: "decode" | "wasm" | "record" | "loading";
  message?: string;
};

export type TimelineAudioChromeProps = {
  audioFileInputRef: RefObject<HTMLInputElement | null>;
  extractProgress: TimelineExtractProgress | null;
  onPickAudio: (e: ChangeEvent<HTMLInputElement>) => void;
  /** ファイルダイアログを開く直前に FFmpeg を先読みする */
  onPreloadFfmpegPointer: () => void;
};

const FILE_INPUT_ACCEPT =
  "audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.mp4,.mov,.m4v,.mkv,.avi,.webm";

/**
 * iOS Safari は `display:none` や非表示祖先内の `<input type="file">` へ
 * プログラムから `.click()` してもファイルピッカーが開かない。
 */
const IOS_SAFE_FILE_INPUT_STYLE: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "1px",
  height: "1px",
  opacity: 0,
  overflow: "hidden",
  border: 0,
  padding: 0,
  margin: 0,
  zIndex: 9999,
};

/**
 * 非表示の音源 `<input type="file">` と、抽出中のステータスバー。
 * `TimelineToolbar` のラベルは `id="choreogrid-timeline-audio-file"` と対応。
 */
export function TimelineAudioChrome({
  audioFileInputRef,
  extractProgress,
  onPickAudio,
  onPreloadFfmpegPointer,
}: TimelineAudioChromeProps) {
  const fileInput = (
    <input
      ref={audioFileInputRef}
      id="choreogrid-timeline-audio-file"
      type="file"
      accept={FILE_INPUT_ACCEPT}
      style={IOS_SAFE_FILE_INPUT_STYLE}
      onChange={onPickAudio}
      onClick={() => {
        onPreloadFfmpegPointer();
      }}
    />
  );

  return (
    <>
      {typeof document !== "undefined"
        ? createPortal(fileInput, document.body)
        : fileInput}
      {extractProgress && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 12,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "6px 10px",
            borderRadius: "8px",
            background:
              "linear-gradient(90deg, rgba(79,70,229,0.22), rgba(14,165,233,0.18))",
            border: "1px solid rgba(99,102,241,0.5)",
            color: "#e2e8f0",
            fontSize: "12px",
            fontWeight: 600,
            boxShadow: "0 6px 20px rgba(15,23,42,0.35)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
            <span>
              {extractProgress.stage === "loading"
                ? "🔧"
                : extractProgress.stage === "decode"
                  ? "⚡"
                  : extractProgress.stage === "wasm"
                    ? "🎛️"
                    : "🎙️"}{" "}
              {extractProgress.message ?? "音声を抽出中…"}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: "#a5b4fc" }}>
              {Math.round(extractProgress.ratio * 100)}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: "rgba(15,23,42,0.6)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(2, Math.min(100, extractProgress.ratio * 100))}%`,
                height: "100%",
                background: "linear-gradient(90deg, #6366f1, #22d3ee)",
                transition: "width 160ms ease-out",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

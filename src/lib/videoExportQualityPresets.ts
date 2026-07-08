export type VideoExportQualityId = "low" | "medium" | "high";

export type VideoExportQualityPreset = {
  id: VideoExportQualityId;
  label: string;
  /** 選択前に表示する時間の目安 */
  timeHint: string;
  width: number;
  height: number;
  /** 出力 MP4 のフレームレート */
  fps: number;
  /**
   * キャプチャ・補間サンプル用 fps（出力より低くすると撮影が速い）。
   * FFmpeg が出力 fps へ引き上げる。
   */
  captureFps: number;
  ffmpegPreset: "ultrafast" | "veryfast" | "fast";
  crf: number;
};

export const VIDEO_EXPORT_QUALITY_PRESETS: VideoExportQualityPreset[] = [
  {
    id: "low",
    label: "低画質",
    timeHint: "すぐ確認したいとき（軽量・最短）",
    width: 640,
    height: 360,
    fps: 15,
    captureFps: 10,
    ffmpegPreset: "ultrafast",
    crf: 28,
  },
  {
    id: "medium",
    label: "中画質",
    timeHint: "友人に送る・普段使い（バランス重視）",
    width: 960,
    height: 540,
    fps: 24,
    captureFps: 12,
    ffmpegPreset: "ultrafast",
    crf: 26,
  },
  {
    id: "high",
    label: "高画質",
    timeHint: "保存用・きれいに残したい（やや時間がかかります）",
    width: 1280,
    height: 720,
    fps: 30,
    captureFps: 15,
    ffmpegPreset: "veryfast",
    crf: 23,
  },
];

export const DEFAULT_VIDEO_EXPORT_QUALITY: VideoExportQualityPreset =
  VIDEO_EXPORT_QUALITY_PRESETS[1];

export function getVideoExportQualityPreset(
  id: VideoExportQualityId
): VideoExportQualityPreset {
  return (
    VIDEO_EXPORT_QUALITY_PRESETS.find((p) => p.id === id) ??
    DEFAULT_VIDEO_EXPORT_QUALITY
  );
}

export function formatVideoExportQualitySpec(preset: VideoExportQualityPreset): string {
  return `${preset.width}×${preset.height} · ${preset.fps}fps`;
}

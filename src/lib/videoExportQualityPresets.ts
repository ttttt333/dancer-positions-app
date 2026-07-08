export type VideoExportQualityId = "low" | "medium" | "high";

export type VideoExportQualityPreset = {
  id: VideoExportQualityId;
  label: string;
  /** 選択前に表示する時間の目安 */
  timeHint: string;
  width: number;
  height: number;
  fps: number;
  /** フォーメーション補間サンプル（書き出し fps と揃える） */
  sampleFps: number;
  ffmpegPreset: "ultrafast" | "veryfast" | "fast";
  crf: number;
};

export const VIDEO_EXPORT_QUALITY_PRESETS: VideoExportQualityPreset[] = [
  {
    id: "low",
    label: "低画質",
    timeHint: "すぐ確認したいとき（軽量・数十秒）",
    width: 640,
    height: 360,
    fps: 15,
    sampleFps: 15,
    ffmpegPreset: "ultrafast",
    crf: 28,
  },
  {
    id: "medium",
    label: "中画質",
    timeHint: "友人に送る・普段使い（1〜2分程度）",
    width: 960,
    height: 540,
    fps: 24,
    sampleFps: 24,
    ffmpegPreset: "veryfast",
    crf: 24,
  },
  {
    id: "high",
    label: "高画質",
    timeHint: "保存用・きれいに残したい（書き出しに時間がかかります）",
    width: 1280,
    height: 720,
    fps: 30,
    sampleFps: 30,
    ffmpegPreset: "fast",
    crf: 22,
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

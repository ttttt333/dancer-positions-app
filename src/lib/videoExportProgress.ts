/** 全体進捗のフェーズ割当（%） */
export const VIDEO_EXPORT_PROGRESS = {
  captureStart: 0,
  captureEnd: 40,
  encodeStart: 40,
  encodeEnd: 90,
  saveStart: 90,
  saveEnd: 100,
} as const;

export type VideoExportProgressPhase = "capture" | "encode" | "save";

export function mapVideoExportPhaseProgress(
  phase: VideoExportProgressPhase,
  ratio: number
): number {
  const t = Math.min(1, Math.max(0, ratio));
  const p = VIDEO_EXPORT_PROGRESS;
  switch (phase) {
    case "capture":
      return p.captureStart + t * (p.captureEnd - p.captureStart);
    case "encode":
      return p.encodeStart + t * (p.encodeEnd - p.encodeStart);
    case "save":
      return p.saveStart + t * (p.saveEnd - p.saveStart);
    default:
      return 0;
  }
}

export const VIDEO_EXPORT_PHASE_LABELS: Record<
  VideoExportProgressPhase,
  string
> = {
  capture: "撮影中…",
  encode: "書き出し中…",
  save: "保存準備中…",
};

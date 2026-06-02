/** 1 回の動画書き出しの最大尺（秒） */
const MAX_EXPORT_SEC = 240;

export function resolveStageExportRange(
  durationSec: number,
  trimStartSec: number,
  trimEndSec: number | null | undefined
): { startSec: number; endSec: number; durationSec: number } {
  const startSec = Math.max(0, trimStartSec ?? 0);
  const endRaw =
    trimEndSec != null && Number.isFinite(trimEndSec) && trimEndSec > startSec
      ? trimEndSec
      : durationSec;
  const endSec = Math.max(startSec, Math.min(endRaw, durationSec));
  const span = Math.max(0, endSec - startSec);
  const capped = Math.min(span, MAX_EXPORT_SEC);
  return {
    startSec,
    endSec: startSec + capped,
    durationSec: capped,
  };
}

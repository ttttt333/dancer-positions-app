import { parseClockToSec } from "./buildRangeExcerptProject";

/** 1 回の動画書き出しの最大尺（秒） */
export const MAX_VIDEO_EXPORT_SEC = 240;

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
  const capped = Math.min(span, MAX_VIDEO_EXPORT_SEC);
  return {
    startSec,
    endSec: startSec + capped,
    durationSec: capped,
  };
}

export type VideoExportTimeRange = {
  startSec: number;
  endSec: number;
};

/**
 * UI の「分:秒」入力を書き出し範囲に正規化する。
 * 終わりが空なら曲の末尾。最大尺は {@link MAX_VIDEO_EXPORT_SEC} で切る。
 */
export function parseVideoExportRangeInput(
  startStr: string,
  endStr: string,
  trackDurationSec: number
):
  | { ok: true; range: VideoExportTimeRange; capped: boolean }
  | { ok: false; error: string } {
  const track = Math.max(0, trackDurationSec);
  const s = parseClockToSec(startStr);
  const e =
    endStr.trim() === ""
      ? track
      : parseClockToSec(endStr);
  if (s == null || e == null) {
    return {
      ok: false,
      error: "時間は「0:00」や「2:30」のように 分:秒 で入力してください。",
    };
  }
  if (!(e > s)) {
    return {
      ok: false,
      error: "終わりの時間は、始めの時間より後にしてください。",
    };
  }
  const resolved = resolveStageExportRange(track, s, e);
  if (resolved.durationSec <= 0) {
    return {
      ok: false,
      error: "書き出しできる範囲がありません。",
    };
  }
  const requestedSpan = Math.min(track, e) - Math.max(0, s);
  return {
    ok: true,
    range: { startSec: resolved.startSec, endSec: resolved.endSec },
    capped: requestedSpan > MAX_VIDEO_EXPORT_SEC + 1e-6,
  };
}

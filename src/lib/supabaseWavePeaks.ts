import { getSupabase, requireSupabaseAuthSession } from "./supabaseClient";
import { CHOREOCORE_AUDIO_BUCKET } from "./supabaseAudio";
import {
  createWavePeaksPayload,
  normalizeWavePeaksPayload,
  type WavePeaksPayload,
} from "./wavePeaksTypes";

export function wavePeaksSidecarPath(audioPath: string): string {
  return `${audioPath}.wavepeaks.json`;
}

export async function supabaseDownloadWavePeaks(
  audioPath: string,
  signal?: AbortSignal
): Promise<WavePeaksPayload | null> {
  if (signal?.aborted) {
    throw new DOMException("Download aborted", "AbortError");
  }
  const sb = getSupabase();
  const sidecarPath = wavePeaksSidecarPath(audioPath);
  const { data, error } = await sb.storage
    .from(CHOREOCORE_AUDIO_BUCKET)
    .download(sidecarPath);
  if (signal?.aborted) {
    throw new DOMException("Download aborted", "AbortError");
  }
  if (error || !data) return null;
  try {
    const text = await data.text();
    const parsed = normalizeWavePeaksPayload(JSON.parse(text));
    return parsed;
  } catch {
    return null;
  }
}

/** @returns アップロード成功なら true（セッション無効・RLS 失敗は false） */
export async function supabaseUploadWavePeaks(
  audioPath: string,
  peaks: number[],
  durationSec: number
): Promise<boolean> {
  if (!peaks.length) return false;
  if (!(await requireSupabaseAuthSession())) {
    console.warn(
      "[supabaseWavePeaks] upload skipped: no valid Supabase session (log in and retry)"
    );
    return false;
  }
  const sb = getSupabase();
  const payload = createWavePeaksPayload(peaks, durationSec);
  const sidecarPath = wavePeaksSidecarPath(audioPath);
  const body = JSON.stringify(payload);
  const { error } = await sb.storage.from(CHOREOCORE_AUDIO_BUCKET).upload(
    sidecarPath,
    new Blob([body], { type: "application/json" }),
    {
      contentType: "application/json",
      upsert: true,
    }
  );
  if (error) {
    console.warn("[supabaseWavePeaks] upload failed:", error.message);
    return false;
  }
  return true;
}

export async function supabaseDeleteWavePeaks(audioPath: string): Promise<void> {
  const path = audioPath.trim();
  if (!path) return;
  if (!(await requireSupabaseAuthSession())) return;
  const sb = getSupabase();
  const sidecarPath = wavePeaksSidecarPath(path);
  const { error } = await sb.storage
    .from(CHOREOCORE_AUDIO_BUCKET)
    .remove([sidecarPath]);
  if (error) {
    console.warn("[supabaseWavePeaks] delete failed:", error.message);
  }
}

import { getSupabase } from "./supabaseClient";
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
  audioPath: string
): Promise<WavePeaksPayload | null> {
  const sb = getSupabase();
  const sidecarPath = wavePeaksSidecarPath(audioPath);
  const { data, error } = await sb.storage.from(CHOREOCORE_AUDIO_BUCKET).download(sidecarPath);
  if (error || !data) return null;
  try {
    const text = await data.text();
    const parsed = normalizeWavePeaksPayload(JSON.parse(text));
    return parsed;
  } catch {
    return null;
  }
}

export async function supabaseUploadWavePeaks(
  audioPath: string,
  peaks: number[],
  durationSec: number
): Promise<void> {
  if (!peaks.length) return;
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
  }
}

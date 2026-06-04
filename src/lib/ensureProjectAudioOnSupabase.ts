import { compressAudioFileToMp3ForUpload } from "./compressAudioToMp3";
import { isSupabaseBackend } from "./supabaseClient";
import { supabaseUploadProjectAudio } from "./supabaseAudio";
import type { ChoreographyProjectJson } from "../types/choreography";

function hasSupabaseAudioPath(project: ChoreographyProjectJson): string | null {
  const raw = project.audioSupabasePath;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * 作品 JSON に Supabase 音源パスが無いがエディタ上で blob 再生中のとき、
 * MP3 に変換して Storage へ上げ、`audioSupabasePath` を返す。
 */
export async function ensureProjectAudioOnSupabase(
  projectId: number,
  project: ChoreographyProjectJson,
  getBlob: () => Promise<Blob | null>,
  onProgress?: (ratio: number, message: string) => void
): Promise<string | null> {
  if (!isSupabaseBackend() || !Number.isFinite(projectId) || projectId <= 0) {
    return null;
  }
  const existing = hasSupabaseAudioPath(project);
  if (existing) return existing;
  if (project.audioAssetId != null) return null;

  const blob = await getBlob();
  if (!blob || blob.size === 0) return null;

  onProgress?.(0.05, "MP3 に変換してクラウドへ保存中…");
  const baseName = project.pieceTitle?.trim() || "audio";
  const file = new File([blob], `${baseName}.upload`, {
    type: blob.type || "audio/mpeg",
  });
  const mp3File = await compressAudioFileToMp3ForUpload(file, (ratio, msg) => {
    onProgress?.(0.05 + ratio * 0.5, msg);
  });
  onProgress?.(0.6, "Supabase にアップロード中…");
  const { path } = await supabaseUploadProjectAudio({
    projectId: Math.floor(projectId),
    file: mp3File,
    filename: mp3File.name,
    contentType: "audio/mpeg",
  });
  onProgress?.(1, "音源をクラウドに保存しました");
  return path;
}

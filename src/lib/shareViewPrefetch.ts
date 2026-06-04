import { isSupabaseBackend } from "./supabaseClient";
import { supabaseDownloadProjectAudioWithCache } from "./supabaseAudio";
import type { ChoreographyProjectJson } from "../types/choreography";

const inflightAudio = new Set<string>();

/**
 * 閲覧共有: 音源 blob を先にキャッシュ（再生ボタン・ステージ表示を早くする）。
 */
export function prefetchShareViewAudio(project: ChoreographyProjectJson): void {
  if (!isSupabaseBackend()) return;
  const path =
    typeof project.audioSupabasePath === "string"
      ? project.audioSupabasePath.trim()
      : "";
  if (!path || inflightAudio.has(path)) return;
  inflightAudio.add(path);
  void supabaseDownloadProjectAudioWithCache(path)
    .catch(() => {
      /* 権限・オフラインは閲覧 UI 側で再試行 */
    })
    .finally(() => {
      inflightAudio.delete(path);
    });
}

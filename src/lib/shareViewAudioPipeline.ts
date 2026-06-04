import { playbackEngine } from "../core/playbackEngine";
import { waitForAudioElementReady } from "./audioElementReady";
import type { ChoreographyProjectJson } from "../types/choreography";
import { isSupabaseBackend } from "./supabaseClient";
import { supabaseDownloadProjectAudioWithCache } from "./supabaseAudio";
import { useShareViewAudioLoadStore } from "../store/shareViewAudioLoadStore";
import { setPersistedSupabaseAudio } from "./timelineAudioBlobPersist";
import { waveMediaCacheKeyForSupabase } from "./waveMediaCache";

const inflightPaths = new Set<string>();

function shareAudioPath(project: ChoreographyProjectJson): string {
  const raw = project.audioSupabasePath;
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 共有閲覧: 音源を先読みし、`<audio>` に接続して UI を「再生準備完了」へ。
 */
export function preloadShareViewAudioForPlayback(
  project: ChoreographyProjectJson
): void {
  if (!isSupabaseBackend()) return;

  const path = shareAudioPath(project);
  const store = useShareViewAudioLoadStore.getState();

  if (!path) {
    store.setUnconfigured();
    return;
  }

  if (inflightPaths.has(path)) return;
  inflightPaths.add(path);

  store.setLoading(0.02, "音源を読み込み中…");

  void (async () => {
    try {
      const { buffer, mime } = await supabaseDownloadProjectAudioWithCache(
        path,
        (ratio) => {
          useShareViewAudioLoadStore
            .getState()
            .setLoading(
              ratio,
              ratio < 0.35
                ? "音源をダウンロード中…"
                : ratio < 0.95
                  ? "再生の準備中…"
                  : "再生の準備中…"
            );
        }
      );

      const blob = new Blob([buffer], { type: mime || "audio/mpeg" });
      const blobUrl = URL.createObjectURL(blob);
      setPersistedSupabaseAudio(blobUrl, path);

      const engineUrl = playbackEngine.getMediaSourceUrl();
      if (engineUrl !== blobUrl || !playbackEngine.getMediaElement()?.src) {
        playbackEngine.setMediaSourceUrl(blobUrl, { force: true });
      }

      await waitForAudioElementReady(playbackEngine.getMediaElement());
      useShareViewAudioLoadStore.getState().setReady("再生準備完了");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "音源の読み込みに失敗しました";
      useShareViewAudioLoadStore.getState().setError(msg);
    } finally {
      inflightPaths.delete(path);
    }
  })();
}

/** キャッシュキー（オフライン・PWA 用の識別子） */
export function shareViewAudioCacheKey(path: string): string {
  return waveMediaCacheKeyForSupabase(path);
}

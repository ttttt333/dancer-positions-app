import { playbackEngine } from "../core/playbackEngine";
import { waitForAudioElementReady } from "./audioElementReady";
import type { ChoreographyProjectJson } from "../types/choreography";
import { isSupabaseBackend } from "./supabaseClient";
import { useShareViewAudioLoadStore } from "../store/shareViewAudioLoadStore";
import { materializeSupabasePlaybackUrl } from "./audioPlaybackCache";
import { waveMediaCacheKeyForSupabase } from "./waveMediaCache";
import { restorePlaybackBlobUrl } from "./restorePlaybackAudio";
import { fulfillViewerPendingPlay } from "./playbackViewerIntent";

const inflightPaths = new Set<string>();

function shareAudioPath(project: ChoreographyProjectJson): string {
  const raw = project.audioSupabasePath;
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 共有閲覧: Cache API に保存 → 短命 blob URL を生成 → `<audio>` 接続。
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
  playbackEngine.ensureDomMediaElement();

  void (async () => {
    try {
      const blobUrl = await materializeSupabasePlaybackUrl(path, (ratio) => {
        useShareViewAudioLoadStore.getState().setLoading(
          ratio,
          ratio < 0.35
            ? "音源をダウンロード中…"
            : ratio < 0.95
              ? "再生の準備中…"
              : "再生の準備中…"
        );
      });
      if (!blobUrl) throw new Error("音源の読み込みに失敗しました");

      playbackEngine.setMediaSourceUrl(blobUrl, { force: true });
      await waitForAudioElementReady(playbackEngine.getMediaElement());
      useShareViewAudioLoadStore.getState().setReady();
      fulfillViewerPendingPlay();
    } catch (e) {
      const rebuilt = await restorePlaybackBlobUrl({
        audioSupabasePath: path,
      });
      if (rebuilt) {
        playbackEngine.setMediaSourceUrl(rebuilt, { force: true });
        await waitForAudioElementReady(playbackEngine.getMediaElement());
        useShareViewAudioLoadStore.getState().setReady();
        fulfillViewerPendingPlay();
        return;
      }
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

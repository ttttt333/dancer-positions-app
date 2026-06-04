import type { ChoreographyProjectJson } from "../types/choreography";
import { preloadShareViewAudioForPlayback } from "./shareViewAudioPipeline";

/**
 * 閲覧共有: 音源を先読みし `<audio>` に接続（進捗 UI・オフラインキャッシュ兼用）。
 */
export function prefetchShareViewAudio(project: ChoreographyProjectJson): void {
  preloadShareViewAudioForPlayback(project);
}

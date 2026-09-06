/**
 * Fly.io song_structure_v2 へのフロント向けクライアント層。
 * 実体の正規化・Edge 経由取得は `songAnalyzeClient` に委譲する。
 */

import {
  fetchRemoteStructureV2,
  normalizeStructureResultV2,
} from "../songAnalyzeClient";
import type { StructureResultV2 } from "../choreocore/types/songStructure";

/** 直接叩き用。未設定時は Edge analyze-song 経由のみ。 */
export function getFlyAnalyzerBaseUrl(): string | null {
  const raw = (
    import.meta.env.VITE_ANALYZER_API_URL as string | undefined
  )?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/**
 * 音源 URL から StructureResultV2 を取得する。
 * 1) Edge `analyze-song`（キャッシュ付き）経由
 * 2) `VITE_ANALYZER_API_URL` があれば Fly `/api/v2/analyze-structure` 直叩き
 * 失敗時は null（呼び出し側でレガシー近似へフォールバック）。
 */
export async function fetchSongStructureV2(
  audioUrl: string,
  opts?: {
    audioSupabasePath?: string | null;
    trackTitle?: string | null;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<StructureResultV2 | null> {
  const url = audioUrl?.trim();
  if (!url && !opts?.audioSupabasePath) return null;

  try {
    const viaBundle = await fetchRemoteStructureV2({
      audioUrl: url || null,
      audioSupabasePath: opts?.audioSupabasePath,
      trackTitle: opts?.trackTitle,
      signal: opts?.signal,
      timeoutMs: opts?.timeoutMs,
    });
    if (viaBundle) return viaBundle;

    // 明示的な直叩き（Edge 未設定・バンドルなし時の最終手段）
    const base = getFlyAnalyzerBaseUrl();
    if (!base || !url || !/^https?:\/\//i.test(url)) return null;

    const response = await fetch(`${base}/api/v2/analyze-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_url: url }),
      signal: opts?.signal,
    });
    if (!response.ok) {
      console.warn(
        "Song structure v2 API failed, fallback to legacy structure.",
        response.status
      );
      return null;
    }
    return normalizeStructureResultV2(await response.json());
  } catch (error) {
    console.error("Failed to connect to Fly.io song structure service:", error);
    return null;
  }
}

export { normalizeStructureResultV2 };

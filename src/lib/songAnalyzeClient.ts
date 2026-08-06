/**
 * Fly.io 音源解析（/analyze）を Edge Function `analyze-song` 経由で呼び出す。
 * 失敗時は null（呼び出し側でブラウザ解析にフォールバック）。
 */

import { getSupabaseAccessToken, isSupabaseBackend } from "./supabaseClient";
import {
  CHOREOCORE_AUDIO_BUCKET,
  supabaseGetProjectAudioSignedUrl,
} from "./supabaseAudio";
import type {
  ChangePoint,
  EightGridEntry,
  SongAnalysisResult,
} from "./choreocore/types";

/** Python analyzer / Edge と揃える */
export const REMOTE_ANALYZER_VERSION = "algo-v1.0.0";

export type RemoteSongAnalysis = SongAnalysisResult & {
  source: "cache" | "fresh" | "direct";
  audio_hash?: string;
};

async function sha256Hex(buffer: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function asChangePoints(raw: unknown): ChangePoint[] {
  if (!Array.isArray(raw)) return [];
  const out: ChangePoint[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const tier = o.tier;
    if (tier !== "major" && tier !== "medium" && tier !== "minor") continue;
    const eight_index = Number(o.eight_index);
    const time = Number(o.time);
    const score = Number(o.score);
    if (!Number.isFinite(eight_index) || !Number.isFinite(time)) continue;
    out.push({
      eight_index,
      time,
      score: Number.isFinite(score) ? score : 0,
      tier,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

function asEightGrid(raw: unknown): EightGridEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const index = Number(o.index);
      const start_time = Number(o.start_time);
      if (!Number.isFinite(index) || !Number.isFinite(start_time)) return null;
      return { index, start_time };
    })
    .filter((x): x is EightGridEntry => x != null);
}

function normalizeRemotePayload(
  data: Record<string, unknown>,
  source: RemoteSongAnalysis["source"]
): RemoteSongAnalysis | null {
  const bpm = Number(data.bpm);
  const duration = Number(
    data.duration ?? data.duration_seconds ?? data.durationSec
  );
  const change_points = asChangePoints(data.change_points);
  if (!Number.isFinite(bpm) || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  if (change_points.length === 0) return null;
  return {
    bpm,
    duration,
    eight_grid: asEightGrid(data.eight_grid),
    change_points,
    song_dynamism: Math.min(
      1,
      Math.max(0, Number(data.song_dynamism) || 0.5)
    ),
    analyzer_version: String(data.analyzer_version ?? REMOTE_ANALYZER_VERSION),
    source,
    audio_hash:
      typeof data.audio_hash === "string" ? data.audio_hash : undefined,
  };
}

async function resolveAnalyzableAudioUrl(opts: {
  audioSupabasePath?: string | null;
  audioUrl?: string | null;
}): Promise<string | null> {
  const path = opts.audioSupabasePath?.trim();
  if (path && isSupabaseBackend()) {
    try {
      return await supabaseGetProjectAudioSignedUrl(path, 3600);
    } catch {
      /* fall through */
    }
  }
  const url = opts.audioUrl?.trim() ?? "";
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

/**
 * Edge `analyze-song` → Fly `/analyze`（キャッシュ付き）。
 * Edge が無い／失敗時は `VITE_ANALYZER_API_URL` へ直接 POST。
 */
export async function fetchRemoteSongAnalysis(opts: {
  audioSupabasePath?: string | null;
  audioUrl?: string | null;
  trackTitle?: string | null;
  signal?: AbortSignal;
}): Promise<RemoteSongAnalysis | null> {
  const audioUrl = await resolveAnalyzableAudioUrl(opts);
  if (!audioUrl) return null;

  let audioHash = "";
  try {
    const res = await fetch(audioUrl, { signal: opts.signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    audioHash = await sha256Hex(buf);
  } catch {
    // 署名URLの再取得失敗時は path ベースの弱いキー
    const path = opts.audioSupabasePath?.trim();
    if (path) {
      audioHash = await sha256Hex(new TextEncoder().encode(`path:${path}`));
    } else {
      return null;
    }
  }

  const body = {
    audio_url: audioUrl,
    audio_hash: audioHash,
    track_title: opts.trackTitle?.trim() || undefined,
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
    | string
    | undefined;

  if (supabaseUrl && supabaseKey) {
    try {
      const token = getSupabaseAccessToken() || supabaseKey;
      const res = await fetch(`${supabaseUrl}/functions/v1/analyze-song`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const source =
          data.source === "cache" || data.source === "fresh"
            ? data.source
            : "cache";
        const normalized = normalizeRemotePayload(data, source);
        if (normalized) return { ...normalized, audio_hash: audioHash };
      }
      // 503 など → 直接 Fly を試す
    } catch {
      /* direct fallback */
    }
  }

  const direct = (
    import.meta.env.VITE_ANALYZER_API_URL as string | undefined
  )?.replace(/\/$/, "");
  if (!direct) return null;

  try {
    const res = await fetch(`${direct}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const normalized = normalizeRemotePayload(data, "direct");
    if (normalized) return { ...normalized, audio_hash: audioHash };
  } catch {
    return null;
  }
  return null;
}

/** デバッグ用 */
export function analyzerBucketName(): string {
  return CHOREOCORE_AUDIO_BUCKET;
}

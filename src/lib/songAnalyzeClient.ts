/**
 * Fly.io 音源解析（/analyze）を Edge Function `analyze-song` 経由で呼び出す。
 * 失敗時は null（呼び出し側でブラウザ解析にフォールバック）。
 */

import { getSupabaseAccessToken, isSupabaseBackend } from "./supabaseClient";
import {
  CHOREOCORE_AUDIO_BUCKET,
  supabaseGetProjectAudioSignedUrl,
} from "./supabaseAudio";
import { parseSectionFamilies } from "./choreocore/engine/music/sectionFamilies";
import type {
  ChangePoint,
  EightGridEntry,
  SongAnalysisResult,
} from "./choreocore/types";

/** Python analyzer / Edge と揃える */
export const REMOTE_ANALYZER_VERSION = "algo-v1.3.0";

/** Fly 冷起動＋解析が遅いので、これを超えたらブラウザ解析に切替 */
export const REMOTE_ANALYZE_TIMEOUT_MS = 12000;

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
    const st = o.section_type;
    const section_type =
      st === "CHORUS_START" ||
      st === "CHORUS" ||
      st === "VERSE" ||
      st === "INTRO" ||
      st === "OUTRO" ||
      st === "DROP" ||
      st === "PRE_CHORUS" ||
      st === "SE_TRIGGER"
        ? st
        : undefined;
    out.push({
      eight_index,
      time,
      score: Number.isFinite(score) ? score : 0,
      tier,
      section_type,
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

/** テストとデバッグ用。Fly の生 JSON を既存経路が読める形に揃える */
export function normalizeRemoteSongAnalysis(
  data: Record<string, unknown>,
  source: RemoteSongAnalysis["source"]
): RemoteSongAnalysis | null {
  return normalizeRemotePayload(data, source);
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
  const section_families = parseSectionFamilies(data.section_families);
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
    section_families: section_families.length > 0 ? section_families : undefined,
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
 * キャッシュキー。フル音源のダウンロードはしない（提案の体感速度を優先）。
 */
async function resolveAudioHash(opts: {
  audioSupabasePath?: string | null;
  audioUrl: string;
}): Promise<string> {
  const path = opts.audioSupabasePath?.trim();
  if (path) {
    return sha256Hex(
      new TextEncoder().encode(`path:${REMOTE_ANALYZER_VERSION}:${path}`)
    );
  }
  return sha256Hex(
    new TextEncoder().encode(`url:${REMOTE_ANALYZER_VERSION}:${opts.audioUrl}`)
  );
}

function mergeAbortSignals(
  a?: AbortSignal,
  b?: AbortSignal
): AbortSignal | undefined {
  if (!a && !b) return undefined;
  if (a && !b) return a;
  if (!a && b) return b;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a!.addEventListener("abort", onAbort, { once: true });
  b!.addEventListener("abort", onAbort, { once: true });
  if (a!.aborted || b!.aborted) ctrl.abort();
  return ctrl.signal;
}

/**
 * Edge `analyze-song` → Fly `/analyze`（キャッシュ付き）。
 * 既定で数秒タイムアウト。失敗／遅延時は null。
 */
export async function fetchRemoteSongAnalysis(opts: {
  audioSupabasePath?: string | null;
  audioUrl?: string | null;
  trackTitle?: string | null;
  signal?: AbortSignal;
  /** 既定 REMOTE_ANALYZE_TIMEOUT_MS。0 で無効 */
  timeoutMs?: number;
}): Promise<RemoteSongAnalysis | null> {
  const audioUrl = await resolveAnalyzableAudioUrl(opts);
  if (!audioUrl) return null;

  const audioHash = await resolveAudioHash({
    audioSupabasePath: opts.audioSupabasePath,
    audioUrl,
  });

  const body = {
    audio_url: audioUrl,
    audio_hash: audioHash,
    track_title: opts.trackTitle?.trim() || undefined,
  };

  const timeoutMs =
    opts.timeoutMs === 0
      ? 0
      : (opts.timeoutMs ?? REMOTE_ANALYZE_TIMEOUT_MS);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timeoutSignal: AbortSignal | undefined;
  if (timeoutMs > 0) {
    const tc = new AbortController();
    timeoutSignal = tc.signal;
    timer = setTimeout(() => tc.abort(), timeoutMs);
  }
  const signal = mergeAbortSignals(opts.signal, timeoutSignal);

  try {
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
          signal,
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
        signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      const normalized = normalizeRemotePayload(data, "direct");
      if (normalized) return { ...normalized, audio_hash: audioHash };
    } catch {
      return null;
    }
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** デバッグ用 */
export function analyzerBucketName(): string {
  return CHOREOCORE_AUDIO_BUCKET;
}

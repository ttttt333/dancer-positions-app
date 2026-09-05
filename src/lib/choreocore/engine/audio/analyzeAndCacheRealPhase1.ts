/**
 * Real PCM → AudioAnalyzer → versioned cache。
 * Suggest のたびに FFT しない。synthetic Phase1 は拒否する。
 */

import { analyzeAudio } from "./AudioAnalyzer";
import { isMusicEnginePhase12Enabled } from "./musicEngineFlag";
import { recordMusicEngineTrace } from "../music/productionTimeline";
import {
  getRealPhase1Cached,
  realPhase1StorageKey,
  setRealPhase1Cached,
} from "./realPhase1Cache";
import { ANALYSIS_VERSION } from "../constants";
import type { EngineAudioBuffer, MusicAnalysisResultPhase1 } from "../types";
import { AudioAnalysisError } from "../types/AudioError";

const inflight = new Map<string, Promise<MusicAnalysisResultPhase1 | null>>();

/**
 * 互換用。Suggest ではタイムアウトで切り捨てない。
 * 明示的に短い待ちが必要な呼び出しだけ timeoutMs に渡す。
 */
export const REAL_PHASE1_WAIT_MS = 12_000;

const LOG_PREFIX = "[ChoreoCore MusicEngine]";

export function audioBufferToEngineBuffer(
  audioBuf: Pick<
    AudioBuffer,
    "sampleRate" | "length" | "numberOfChannels" | "duration" | "getChannelData"
  >
): EngineAudioBuffer {
  return {
    sampleRate: audioBuf.sampleRate,
    length: audioBuf.length,
    numberOfChannels: audioBuf.numberOfChannels,
    duration: audioBuf.duration,
    getChannelData: (channel: number) => audioBuf.getChannelData(channel),
  };
}

export function clearRealPhase1Inflight(): void {
  inflight.clear();
}

export async function analyzeAndCacheRealPhase1(input: {
  audioBuffer: EngineAudioBuffer;
  cacheKey: string | null | undefined;
  /** テスト用。true なら flag を無視して実行する */
  force?: boolean;
}): Promise<MusicAnalysisResultPhase1 | null> {
  if (!input.force && !isMusicEnginePhase12Enabled()) return null;
  const cacheKey = input.cacheKey?.trim() || "";
  if (!cacheKey) return null;

  const cached = getRealPhase1Cached(cacheKey, ANALYSIS_VERSION);
  if (cached) {
    recordMusicEngineTrace({
      analysisSource: "engine-phase12",
      analysisVersion: cached.analysisVersion,
      cacheHit: true,
      cacheMiss: false,
    });
    return cached.phase1;
  }

  const storageKey = realPhase1StorageKey(cacheKey, ANALYSIS_VERSION);
  const pending = inflight.get(storageKey);
  if (pending) return pending;

  const work = runRealPhase1(input.audioBuffer, cacheKey);
  inflight.set(storageKey, work);
  try {
    return await work;
  } finally {
    inflight.delete(storageKey);
  }
}

async function runRealPhase1(
  audioBuffer: EngineAudioBuffer,
  cacheKey: string
): Promise<MusicAnalysisResultPhase1 | null> {
  const t0 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  try {
    const phase1 = await analyzeAudio(audioBuffer);
    if (phase1.provenance !== "real" || phase1.frames.length === 0) {
      recordMusicEngineTrace({
        analysisSource: "engine-phase12",
        analysisVersion: ANALYSIS_VERSION,
        cacheHit: false,
        cacheMiss: true,
        fallbackReason: "invalid-phase1",
      });
      console.warn(
        `${LOG_PREFIX} Real Phase1 invalid (provenance/frames) key=${cacheKey}`
      );
      return null;
    }
    setRealPhase1Cached(cacheKey, phase1);
    const t1 =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    recordMusicEngineTrace({
      analysisSource: "engine-phase12",
      analysisVersion: phase1.analysisVersion,
      phase1DurationMs: t1 - t0,
      cacheHit: false,
      cacheMiss: true,
    });
    return phase1;
  } catch (err) {
    const reason =
      err instanceof AudioAnalysisError ? err.code : "phase1-error";
    recordMusicEngineTrace({
      analysisSource: "engine-phase12",
      analysisVersion: ANALYSIS_VERSION,
      cacheHit: false,
      cacheMiss: true,
      fallbackReason: String(reason),
    });
    console.warn(
      `${LOG_PREFIX} Real Phase1 analyze failed reason=${reason} key=${cacheKey}`,
      err
    );
    return null;
  }
}

/** 波形デコード後。flag OFF や失敗は握りつぶし、ピーク表示を止めない。 */
export function scheduleRealPhase1FromDecodedAudio(
  audioBuf: AudioBuffer,
  cacheKey: string | null | undefined
): void {
  if (!isMusicEnginePhase12Enabled()) return;
  if (!cacheKey?.trim()) return;
  void analyzeAndCacheRealPhase1({
    audioBuffer: audioBufferToEngineBuffer(audioBuf),
    cacheKey,
  });
}

/**
 * in-flight の Real Phase1 を待つ。
 * timeoutMs を省略 / null / Infinity のときは完了まで待つ（Suggest 用）。
 * 有限の ms を渡したときだけ打ち切る（互換・テスト用）。
 */
export async function waitForRealPhase1Cache(
  cacheKey: string | null | undefined,
  timeoutMs: number | null = null
): Promise<MusicAnalysisResultPhase1 | null> {
  if (!isMusicEnginePhase12Enabled()) return null;
  const key = cacheKey?.trim() || "";
  if (!key) return null;
  const cached = getRealPhase1Cached(key, ANALYSIS_VERSION);
  if (cached) return cached.phase1;
  const pending = inflight.get(realPhase1StorageKey(key, ANALYSIS_VERSION));
  if (!pending) return null;

  const waitForever =
    timeoutMs == null ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs < 0 ||
    timeoutMs === Infinity;

  if (waitForever) {
    return await pending;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raced = await Promise.race([
      pending.then((v) => ({ kind: "done" as const, v })),
      new Promise<{ kind: "timeout" }>((resolve) => {
        timer = setTimeout(
          () => resolve({ kind: "timeout" }),
          Math.max(0, timeoutMs)
        );
      }),
    ]);
    if (raced.kind === "timeout") {
      console.warn(
        `${LOG_PREFIX} waitForRealPhase1Cache timed out after ${timeoutMs}ms key=${key} (caller requested finite wait)`
      );
      return null;
    }
    return raced.v;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * FLAG ON のとき、Suggest の直前に Real Phase1 を揃える。
 * キャッシュ → in-flight 完了待ち（打ち切りなし）→ 音源から解析。
 * 失敗時のみ null（暫定経路）。理由は必ず warn する。
 */
export async function ensureRealPhase1ForSuggest(input: {
  cacheKey?: string | null;
  audioUrl?: string | null;
  signal?: AbortSignal;
}): Promise<MusicAnalysisResultPhase1 | null> {
  if (!isMusicEnginePhase12Enabled()) {
    console.warn(
      `${LOG_PREFIX} provisional: VITE_MUSIC_ENGINE_PHASE12 is off — Real Phase1/2 skipped`
    );
    return null;
  }
  const cacheKey = input.cacheKey?.trim() || "";
  if (!cacheKey) {
    console.warn(
      `${LOG_PREFIX} provisional: missing peaksCacheKey — cannot bind Real Phase1/2`
    );
    return null;
  }
  const cached = getRealPhase1Cached(cacheKey, ANALYSIS_VERSION);
  if (cached) return cached.phase1;

  // 裏解析が走っていれば、12秒で切り捨てず完了まで待つ
  const waited = await waitForRealPhase1Cache(cacheKey, null);
  if (waited) return waited;
  if (input.signal?.aborted) {
    console.warn(
      `${LOG_PREFIX} provisional: aborted while waiting for Real Phase1 key=${cacheKey}`
    );
    return null;
  }

  const url = input.audioUrl?.trim() || "";
  if (!url) {
    console.warn(
      `${LOG_PREFIX} provisional: cache miss and no audioUrl to re-analyze key=${cacheKey}`
    );
    return null;
  }
  try {
    const res = await fetch(url, { signal: input.signal });
    if (!res.ok) {
      console.warn(
        `${LOG_PREFIX} provisional: audioUrl fetch failed status=${res.status} key=${cacheKey}`
      );
      return null;
    }
    const buf = await res.arrayBuffer();
    if (input.signal?.aborted) {
      console.warn(
        `${LOG_PREFIX} provisional: aborted after audio fetch key=${cacheKey}`
      );
      return null;
    }
    const { decodeArrayBufferToAudioBuffer } = await import(
      "../../../audioContext"
    );
    const audioBuf = await decodeArrayBufferToAudioBuffer(buf);
    const phase1 = await analyzeAndCacheRealPhase1({
      audioBuffer: audioBufferToEngineBuffer(audioBuf),
      cacheKey,
    });
    if (!phase1) {
      console.warn(
        `${LOG_PREFIX} provisional: Real Phase1 analyze returned null after fetch key=${cacheKey}`
      );
    }
    return phase1;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(
        `${LOG_PREFIX} provisional: aborted during Real Phase1 fetch/decode key=${cacheKey}`
      );
      return null;
    }
    console.warn(
      `${LOG_PREFIX} provisional: Real Phase1 fetch/decode/analyze failed key=${cacheKey}`,
      err
    );
    return null;
  }
}

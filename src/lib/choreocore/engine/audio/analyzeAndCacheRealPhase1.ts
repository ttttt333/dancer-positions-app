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

/** Suggest 前に in-flight の Phase1 を待つ上限。失敗したら従来経路。 */
export const REAL_PHASE1_WAIT_MS = 12_000;

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

export async function waitForRealPhase1Cache(
  cacheKey: string | null | undefined,
  timeoutMs: number = REAL_PHASE1_WAIT_MS
): Promise<MusicAnalysisResultPhase1 | null> {
  if (!isMusicEnginePhase12Enabled()) return null;
  const key = cacheKey?.trim() || "";
  if (!key) return null;
  const cached = getRealPhase1Cached(key, ANALYSIS_VERSION);
  if (cached) return cached.phase1;
  const pending = inflight.get(realPhase1StorageKey(key, ANALYSIS_VERSION));
  if (!pending) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), Math.max(0, timeoutMs));
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * FLAG ON のとき、Suggest の直前に Real Phase1 を揃える。
 * キャッシュ → in-flight 待ち → 音源から解析。どれも失敗なら null（従来経路）。
 */
export async function ensureRealPhase1ForSuggest(input: {
  cacheKey?: string | null;
  audioUrl?: string | null;
  signal?: AbortSignal;
}): Promise<MusicAnalysisResultPhase1 | null> {
  if (!isMusicEnginePhase12Enabled()) return null;
  const cacheKey = input.cacheKey?.trim() || "";
  if (!cacheKey) return null;
  const cached = getRealPhase1Cached(cacheKey, ANALYSIS_VERSION);
  if (cached) return cached.phase1;
  const waited = await waitForRealPhase1Cache(cacheKey);
  if (waited) return waited;
  if (input.signal?.aborted) return null;
  const url = input.audioUrl?.trim() || "";
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (input.signal?.aborted) return null;
    const { decodeArrayBufferToAudioBuffer } = await import("../../../audioContext");
    const audioBuf = await decodeArrayBufferToAudioBuffer(buf);
    return await analyzeAndCacheRealPhase1({
      audioBuffer: audioBufferToEngineBuffer(audioBuf),
      cacheKey,
    });
  } catch {
    return null;
  }
}

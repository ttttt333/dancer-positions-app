import type { DecodePeaksOptions } from "../hooks/useTimelineWaveDecode";
import {
  computeServerWavePeaksFromBlob,
  fetchServerWavePeaksWithPoll,
  payloadToPeaksResult,
  tryFetchServerWavePeaksReady,
} from "./wavePeaksServerApi";
import { supabaseDownloadWavePeaks } from "./supabaseWavePeaks";
import {
  getCachedPeaksPayload,
  putCachedPeaksPayload,
} from "./waveMediaCache";
import {
  refinePeaksForTimeline,
  isWavePeaksResolutionStale,
} from "./computeWavePeaksFromChannelData";
import { decodeWavePeaksFromBuffer } from "./wavePeakDecodeWorkerClient";
import { isPlaceholderLikeWavePeaks } from "./placeholderWavePeaks";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { reportWaveLoadProgress } from "./waveLoadProgress";

type PeaksResult = { peaks: number[]; durationSec: number };

type ApplyPeaks = (
  buf: ArrayBuffer,
  options?: DecodePeaksOptions
) => Promise<void>;

/** 事前計算済みピークを反映（空バッファ可） */
export async function applyPrecomputedWavePeaks(
  applyPeaks: ApplyPeaks,
  precomputed: PeaksResult,
  options: Omit<DecodePeaksOptions, "precomputed">
): Promise<void> {
  await applyPeaks(new ArrayBuffer(0), {
    ...options,
    precomputed,
  });
}

function peaksPayloadIsUsable(peaks: PeaksResult): boolean {
  return (
    peaks.peaks.length > 0 &&
    !isPlaceholderLikeWavePeaks(peaks.peaks) &&
    !isWavePeaksResolutionStale(peaks.peaks, peaks.durationSec)
  );
}

async function cacheAndApplyPeaks(
  applyPeaks: ApplyPeaks,
  peaks: PeaksResult,
  options: Omit<DecodePeaksOptions, "precomputed">
): Promise<boolean> {
  if (!peaksPayloadIsUsable(peaks)) return false;
  const refined = {
    peaks: refinePeaksForTimeline(peaks.peaks, peaks.durationSec),
    durationSec: peaks.durationSec,
  };
  if (options.cacheKey) {
    void putCachedPeaksPayload(
      options.cacheKey,
      refined.peaks,
      refined.durationSec
    );
  }
  await applyPrecomputedWavePeaks(applyPeaks, refined, options);
  return true;
}

/** 端末 decodeAudioData の前にサーバー生成を試す（88% で止まる重い処理を回避） */
async function fallbackPeaksViaServerCompute(
  buf: ArrayBuffer,
  applyPeaks: ApplyPeaks,
  options: Omit<DecodePeaksOptions, "precomputed">,
  filename: string
): Promise<boolean> {
  if (!buf.byteLength) return false;
  reportWaveLoadProgress(0.82, "サーバーで波形を生成中…");
  try {
    const payload = await computeServerWavePeaksFromBlob(
      new Blob([buf], { type: "audio/mpeg" }),
      filename
    );
    return await cacheAndApplyPeaks(
      applyPeaks,
      payloadToPeaksResult(payload),
      options
    );
  } catch (err) {
    console.warn("[wavePeaks] server compute fallback failed:", err);
    return false;
  }
}

/** サーバー波形 API が使えないとき、端末で音声バッファからピークを生成 */
async function fallbackPeaksViaClientDecode(
  buf: ArrayBuffer,
  applyPeaks: ApplyPeaks,
  options: Omit<DecodePeaksOptions, "precomputed">
): Promise<boolean> {
  if (!buf.byteLength) return false;
  reportWaveLoadProgress(0.88, "波形を端末で解析中…");
  try {
    const { peaks, durationSec } = await decodeWavePeaksFromBuffer(buf);
    return await cacheAndApplyPeaks(applyPeaks, { peaks, durationSec }, options);
  } catch (err) {
    console.warn("[wavePeaks] client decode fallback failed:", err);
    return false;
  }
}

/**
 * サーバー音源: キャッシュ → GET peaks → ポーリング → サーバー compute → 端末解析（最終）
 */
export async function resolveServerAssetWavePeaks(
  assetId: number,
  readBuffer: () => Promise<ArrayBuffer>,
  applyPeaks: ApplyPeaks,
  options: Omit<DecodePeaksOptions, "precomputed">
): Promise<void> {
  if (options.cacheKey) {
    const mediaCached = await getCachedPeaksPayload(options.cacheKey);
    if (mediaCached?.peaks.length && peaksPayloadIsUsable(mediaCached)) {
      await applyPrecomputedWavePeaks(applyPeaks, mediaCached, options);
      return;
    }
  }

  const ready = await tryFetchServerWavePeaksReady(assetId);
  if (ready && peaksPayloadIsUsable(ready)) {
    if (await cacheAndApplyPeaks(applyPeaks, ready, options)) return;
  }

  reportWaveLoadProgress(0.4, "波形データを取得中…");
  const peaksTask = fetchServerWavePeaksWithPoll(assetId);
  const bufTask = readBuffer();

  let serverPeaks = await peaksTask;
  if (serverPeaks && peaksPayloadIsUsable(serverPeaks)) {
    if (await cacheAndApplyPeaks(applyPeaks, serverPeaks, options)) return;
  }

  reportWaveLoadProgress(0.78, "サーバーで波形を生成中…");
  serverPeaks = await fetchServerWavePeaksWithPoll(assetId, {
    maxAttempts: 48,
    intervalMs: 500,
  });
  if (serverPeaks && peaksPayloadIsUsable(serverPeaks)) {
    if (await cacheAndApplyPeaks(applyPeaks, serverPeaks, options)) return;
  }

  const buf = await bufTask;
  if (
    await fallbackPeaksViaServerCompute(
      buf,
      applyPeaks,
      options,
      `audio-${assetId}.m4a`
    )
  ) {
    return;
  }

  if (await fallbackPeaksViaClientDecode(buf, applyPeaks, options)) {
    return;
  }

  await applyPlaceholderWavePeaks(applyPeaks, options);
}

async function applyPlaceholderWavePeaks(
  applyPeaks: ApplyPeaks,
  options: Omit<DecodePeaksOptions, "precomputed">
): Promise<void> {
  const ui = usePlaybackUiStore.getState();
  const durationSec =
    ui.trustedAudioDurationSec ?? ui.durationSec ?? 120;
  reportWaveLoadProgress(0.95, "簡易波形を表示中…");
  const { createPlaceholderWavePeaks } = await import("./placeholderWavePeaks");
  await applyPrecomputedWavePeaks(
    applyPeaks,
    {
      peaks: createPlaceholderWavePeaks(durationSec),
      durationSec,
    },
    options
  );
}

/**
 * Supabase 音源: サイドカー JSON と本体を並列取得し、サイドカーがあればデコードを省略。
 */
export async function downloadSupabaseAudioWithSidecar(
  audioPath: string,
  downloadAudio: () => Promise<ArrayBuffer>
): Promise<{ buf: ArrayBuffer; sidecar: Awaited<ReturnType<typeof supabaseDownloadWavePeaks>> }> {
  reportWaveLoadProgress(0.1, "音源と波形を並列取得中…");
  const [sidecar, buf] = await Promise.all([
    supabaseDownloadWavePeaks(audioPath).catch(() => null),
    downloadAudio(),
  ]);
  return { buf, sidecar };
}

function filenameFromStoragePath(path: string): string {
  const base = path.trim().split("/").pop();
  return base && base.length > 0 ? base : "audio.m4a";
}

/** Supabase: サイドカー → サーバー compute → 端末解析（最終） */
export async function resolveSupabaseReuseWavePeaks(
  audioPath: string,
  readBuffer: () => Promise<ArrayBuffer>,
  applyPeaks: ApplyPeaks,
  options: Omit<DecodePeaksOptions, "precomputed">
): Promise<void> {
  if (options.cacheKey) {
    const mediaCached = await getCachedPeaksPayload(options.cacheKey);
    if (mediaCached?.peaks.length && peaksPayloadIsUsable(mediaCached)) {
      await applyPrecomputedWavePeaks(applyPeaks, mediaCached, options);
      return;
    }
  }

  reportWaveLoadProgress(0.4, "クラウドの波形データを確認中…");
  const sidecar = await supabaseDownloadWavePeaks(audioPath).catch(() => null);
  if (sidecar?.peaks.length && peaksPayloadIsUsable(sidecar)) {
    if (
      await cacheAndApplyPeaks(
        applyPeaks,
        { peaks: sidecar.peaks, durationSec: sidecar.durationSec },
        options
      )
    ) {
      return;
    }
  }

  const buf = await readBuffer();
  if (
    await fallbackPeaksViaServerCompute(
      buf,
      applyPeaks,
      options,
      filenameFromStoragePath(audioPath)
    )
  ) {
    return;
  }

  if (await fallbackPeaksViaClientDecode(buf, applyPeaks, options)) {
    return;
  }

  await applyPlaceholderWavePeaks(applyPeaks, options);
}

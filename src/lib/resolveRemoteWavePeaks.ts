import type { DecodePeaksOptions } from "../hooks/useTimelineWaveDecode";
import {
  fetchServerWavePeaksWithPoll,
  tryFetchServerWavePeaksReady,
} from "./wavePeaksServerApi";
import { supabaseDownloadWavePeaks } from "./supabaseWavePeaks";
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

/**
 * サーバー音源（再利用）: キャッシュ済み blob から波形を解決。
 * サーバー側ピークを優先し、無ければローカルデコード用に ArrayBuffer を読む。
 */
export async function resolveServerAssetWavePeaks(
  assetId: number,
  readBuffer: () => Promise<ArrayBuffer>,
  applyPeaks: ApplyPeaks,
  options: Omit<DecodePeaksOptions, "precomputed">
): Promise<void> {
  const ready = await tryFetchServerWavePeaksReady(assetId);
  if (ready) {
    await applyPrecomputedWavePeaks(applyPeaks, ready, options);
    return;
  }

  reportWaveLoadProgress(0.12, "波形を取得中…");
  const peaksTask = fetchServerWavePeaksWithPoll(assetId, {
    maxAttempts: 10,
    intervalMs: 120,
  });
  const bufTask = readBuffer();

  const serverPeaks = await peaksTask;
  if (serverPeaks?.peaks.length) {
    await applyPrecomputedWavePeaks(applyPeaks, serverPeaks, options);
    return;
  }

  const buf = await bufTask;
  await applyPeaks(buf, options);
}

/**
 * Supabase 音源: サイドカー JSON と本体を並列取得し、サイドカーがあればデコードを省略。
 * （呼び出し側で再生 URL の設定後に applyPeaks を実行する想定）
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

/** Supabase 再利用 blob: サイドカーを先に試し、無ければ blob からデコード */
export async function resolveSupabaseReuseWavePeaks(
  audioPath: string,
  readBuffer: () => Promise<ArrayBuffer>,
  applyPeaks: ApplyPeaks,
  options: Omit<DecodePeaksOptions, "precomputed">
): Promise<void> {
  reportWaveLoadProgress(0.12, "クラウドの波形データを確認中…");
  const sidecar = await supabaseDownloadWavePeaks(audioPath).catch(() => null);
  if (sidecar?.peaks.length) {
    await applyPrecomputedWavePeaks(
      applyPeaks,
      { peaks: sidecar.peaks, durationSec: sidecar.durationSec },
      options
    );
    return;
  }

  reportWaveLoadProgress(0.35, "波形を解析中…");
  const buf = await readBuffer();
  await applyPeaks(buf, options);
}

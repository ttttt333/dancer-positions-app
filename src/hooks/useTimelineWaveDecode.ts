import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { expandShortCuesAfterAudioLoad } from "../core/timelineController";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { useWavePeaksStore } from "../store/wavePeaksStore";
import { refinePeaksForTimeline, isWavePeaksResolutionStale } from "../lib/computeWavePeaksFromChannelData";
import { isPlaceholderLikeWavePeaks } from "../lib/placeholderWavePeaks";
import { createPlaceholderWavePeaks } from "../lib/placeholderWavePeaks";
import { decodeWavePeaksFromBuffer } from "../lib/wavePeakDecodeWorkerClient";
import {
  getWavePeaksCache,
  setWavePeaksCache,
} from "../lib/wavePeaksCache";
import { putCachedPeaksPayload } from "../lib/waveMediaCache";
import { supabaseDownloadWavePeaks, supabaseUploadWavePeaks } from "../lib/supabaseWavePeaks";
import {
  clearWaveLoadProgress,
  reportWaveLoadError,
  reportWaveLoadProgress,
  runIndeterminateDecodeProgress,
} from "../lib/waveLoadProgress";
import type { WavePeaksPayload } from "../lib/wavePeaksTypes";
import { hasUsablePeaksInStore, shouldApplyPeaksPayload } from "../lib/wavePeaksSession";
import { playbackEngine } from "../core/playbackEngine";

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
};

const CLIENT_DECODE_TIMEOUT_MS = 45_000;

/** 空バッファ経路では再生中 blob から音声を読み直す */
async function resolveAudioBufferForDecode(buf: ArrayBuffer): Promise<ArrayBuffer> {
  if (buf.byteLength > 0) return buf;
  const url = playbackEngine.getMediaSourceUrl();
  if (!url) return buf;
  try {
    const res = await fetch(url);
    if (!res.ok) return buf;
    const fetched = await res.arrayBuffer();
    return fetched.byteLength > 0 ? fetched : buf;
  } catch {
    return buf;
  }
}

function withDecodeTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("波形解析がタイムアウトしました")),
      ms
    );
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export type DecodePeaksOptions = {
  /** キャッシュキー。ヒット時はデコードを省略して即表示 */
  cacheKey?: string | null;
  /** サーバー／Supabase サイドカーなど事前計算済みピーク */
  precomputed?: { peaks: number[]; durationSec: number } | null;
  /** Supabase 音源パス（サイドカー読み書き用） */
  supabaseAudioPath?: string | null;
};

/**
 * ArrayBuffer をデコードして波形ピークと再生 UI の長さを更新する。
 */
export function useTimelineWaveDecode({ setProject }: Params) {
  const setDuration = usePlaybackUiStore((s) => s.setDurationSec);
  const setPeaks = useWavePeaksStore((s) => s.setPeaks);

  const applyPeaksAndDuration = useCallback(
    (rawPeaks: number[], durSec: number, cacheKey?: string | null) => {
      if (
        !shouldApplyPeaksPayload(
          { peaks: rawPeaks, durationSec: durSec },
          cacheKey ?? null
        )
      ) {
        clearWaveLoadProgress();
        return;
      }
      const peaks = refinePeaksForTimeline(rawPeaks, durSec);
      if (Number.isFinite(durSec) && durSec > 0) {
        usePlaybackUiStore.getState().setTrustedAudioDurationSec(durSec);
        setDuration(durSec);
        setProject((p) => expandShortCuesAfterAudioLoad(p, durSec));
      }
      setPeaks(peaks, cacheKey ?? null);
      reportWaveLoadProgress(1, "完了");
      clearWaveLoadProgress();
    },
    [setDuration, setProject, setPeaks]
  );

  const decodePeaksFromBuffer = useCallback(
    async (buf: ArrayBuffer, options?: DecodePeaksOptions) => {
      const cacheKey = options?.cacheKey ?? null;
      const supabaseAudioPath = options?.supabaseAudioPath ?? null;

      try {
        if (options?.precomputed?.peaks.length) {
          const pre = options.precomputed;
          const resolutionStale = isWavePeaksResolutionStale(
            pre.peaks,
            pre.durationSec
          );
          const rejectPrecomputed =
            isPlaceholderLikeWavePeaks(pre.peaks) ||
            (resolutionStale && buf.byteLength === 0);
          if (!rejectPrecomputed) {
            reportWaveLoadProgress(0.92, "波形を反映中…");
            applyPeaksAndDuration(pre.peaks, pre.durationSec, cacheKey);
            if (cacheKey) {
              await setWavePeaksCache(cacheKey, pre.peaks, pre.durationSec);
              void putCachedPeaksPayload(cacheKey, pre.peaks, pre.durationSec);
            }
            if (supabaseAudioPath && !isPlaceholderLikeWavePeaks(pre.peaks)) {
              void supabaseUploadWavePeaks(
                supabaseAudioPath,
                pre.peaks,
                pre.durationSec
              );
            }
            return;
          }
        }

        if (cacheKey) {
          const cached = await getWavePeaksCache(cacheKey);
          if (cached?.peaks.length) {
            const stale =
              isWavePeaksResolutionStale(cached.peaks, cached.durationSec) ||
              isPlaceholderLikeWavePeaks(cached.peaks);
            if (!stale) {
              reportWaveLoadProgress(0.9, "保存済み波形を読み込み中…");
              applyPeaksAndDuration(cached.peaks, cached.durationSec, cacheKey);
              void putCachedPeaksPayload(cacheKey, cached.peaks, cached.durationSec);
              return;
            }
          }
        }

        if (supabaseAudioPath) {
          reportWaveLoadProgress(0.12, "クラウドの波形データを確認中…");
          const sidecar = await supabaseDownloadWavePeaks(supabaseAudioPath);
          if (sidecar?.peaks.length) {
            const stale =
              isWavePeaksResolutionStale(sidecar.peaks, sidecar.durationSec) ||
              isPlaceholderLikeWavePeaks(sidecar.peaks);
            if (!stale) {
              reportWaveLoadProgress(0.9, "クラウド波形を反映中…");
              applyPeaksAndDuration(sidecar.peaks, sidecar.durationSec, cacheKey);
              if (cacheKey) {
                await setWavePeaksCache(cacheKey, sidecar.peaks, sidecar.durationSec);
                void putCachedPeaksPayload(cacheKey, sidecar.peaks, sidecar.durationSec);
              }
              return;
            }
          }
        }

        const audioBuf = await resolveAudioBufferForDecode(buf);
        if (!audioBuf.byteLength) {
          if (hasUsablePeaksInStore()) {
            clearWaveLoadProgress();
            return;
          }
          throw new Error("音声データが空です。音源を再度追加してください。");
        }
        usePlaybackUiStore.getState().setTrustedAudioDurationSec(null);
        reportWaveLoadProgress(0.92, "波形を端末で解析中…");
        const stopTick = runIndeterminateDecodeProgress(0.92, 0.99, "波形を端末で解析中…");
        let peaks: number[];
        let durationSec: number;
        try {
          ({ peaks, durationSec } = await withDecodeTimeout(
            decodeWavePeaksFromBuffer(audioBuf),
            CLIENT_DECODE_TIMEOUT_MS
          ));
        } catch (decodeErr) {
          console.warn("[waveDecode] client decode failed, using placeholder:", decodeErr);
          const ui = usePlaybackUiStore.getState();
          durationSec =
            ui.trustedAudioDurationSec ?? ui.durationSec ?? 120;
          peaks = createPlaceholderWavePeaks(durationSec);
        } finally {
          stopTick();
        }
        applyPeaksAndDuration(peaks, durationSec, cacheKey);
        if (cacheKey) {
          await setWavePeaksCache(cacheKey, peaks, durationSec);
          void putCachedPeaksPayload(cacheKey, peaks, durationSec);
        }
        if (supabaseAudioPath) {
          void supabaseUploadWavePeaks(supabaseAudioPath, peaks, durationSec);
        }
      } catch (err) {
        reportWaveLoadError(
          err instanceof Error ? err.message : "波形の読み込みに失敗しました"
        );
        throw err;
      }
    },
    [applyPeaksAndDuration]
  );

  const applyPrecomputedPeaks = useCallback(
    async (
      payload: WavePeaksPayload,
      options?: Pick<DecodePeaksOptions, "cacheKey" | "supabaseAudioPath">
    ) => {
      await decodePeaksFromBuffer(new ArrayBuffer(0), {
        cacheKey: options?.cacheKey,
        supabaseAudioPath: options?.supabaseAudioPath,
        precomputed: {
          peaks: payload.peaks,
          durationSec: payload.durationSec,
        },
      });
    },
    [decodePeaksFromBuffer]
  );

  return { decodePeaksFromBuffer, applyPrecomputedPeaks };
}

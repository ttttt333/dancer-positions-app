import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { expandShortCuesAfterAudioLoad } from "../core/timelineController";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
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

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  setPeaks: Dispatch<SetStateAction<number[] | null>>;
};

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
export function useTimelineWaveDecode({ setProject, setPeaks }: Params) {
  const setDuration = usePlaybackUiStore((s) => s.setDurationSec);

  const applyPeaksAndDuration = useCallback(
    (peaks: number[], durSec: number) => {
      if (Number.isFinite(durSec) && durSec > 0) {
        usePlaybackUiStore.getState().setTrustedAudioDurationSec(durSec);
        setDuration(durSec);
        setProject((p) => expandShortCuesAfterAudioLoad(p, durSec));
      }
      setPeaks(peaks);
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
          reportWaveLoadProgress(0.92, "波形を反映中…");
          applyPeaksAndDuration(
            options.precomputed.peaks,
            options.precomputed.durationSec
          );
          if (cacheKey) {
            await setWavePeaksCache(
              cacheKey,
              options.precomputed.peaks,
              options.precomputed.durationSec
            );
            void putCachedPeaksPayload(
              cacheKey,
              options.precomputed.peaks,
              options.precomputed.durationSec
            );
          }
          if (supabaseAudioPath) {
            void supabaseUploadWavePeaks(
              supabaseAudioPath,
              options.precomputed.peaks,
              options.precomputed.durationSec
            );
          }
          return;
        }

        if (cacheKey) {
          const cached = await getWavePeaksCache(cacheKey);
          if (cached?.peaks.length) {
            reportWaveLoadProgress(0.9, "保存済み波形を読み込み中…");
            applyPeaksAndDuration(cached.peaks, cached.durationSec);
            void putCachedPeaksPayload(cacheKey, cached.peaks, cached.durationSec);
            return;
          }
        }

        if (supabaseAudioPath) {
          reportWaveLoadProgress(0.12, "クラウドの波形データを確認中…");
          const sidecar = await supabaseDownloadWavePeaks(supabaseAudioPath);
          if (sidecar?.peaks.length) {
            reportWaveLoadProgress(0.9, "クラウド波形を反映中…");
            applyPeaksAndDuration(sidecar.peaks, sidecar.durationSec);
            if (cacheKey) {
              await setWavePeaksCache(cacheKey, sidecar.peaks, sidecar.durationSec);
              void putCachedPeaksPayload(cacheKey, sidecar.peaks, sidecar.durationSec);
            }
            return;
          }
        }

        usePlaybackUiStore.getState().setTrustedAudioDurationSec(null);
        if (!buf.byteLength) {
          throw new Error("音声データが空です。音源を再度追加してください。");
        }
        reportWaveLoadProgress(0.92, "波形を端末で解析中…");
        const stopTick = runIndeterminateDecodeProgress(0.92, 0.99, "波形を端末で解析中…");
        let peaks: number[];
        let durationSec: number;
        try {
          ({ peaks, durationSec } = await decodeWavePeaksFromBuffer(buf));
        } finally {
          stopTick();
        }
        applyPeaksAndDuration(peaks, durationSec);
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

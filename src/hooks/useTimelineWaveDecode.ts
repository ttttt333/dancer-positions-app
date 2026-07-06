import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { expandShortCuesAfterAudioLoad } from "../core/timelineController";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { refinePeaksForTimeline, isWavePeaksResolutionStale } from "../lib/computeWavePeaksFromChannelData";
import { isPlaceholderLikeWavePeaks } from "../lib/placeholderWavePeaks";
import { createPlaceholderWavePeaks } from "../lib/placeholderWavePeaks";
import { decodeWavePeaksFromBuffer } from "../lib/wavePeakDecodeWorkerClient";
import { getWavePeaksCache } from "../lib/wavePeaksCache";
import { supabaseDownloadWavePeaks } from "../lib/supabaseWavePeaks";
import {
  clearWaveLoadProgress,
  reportWaveLoadError,
  reportWaveLoadProgress,
  runIndeterminateDecodeProgress,
} from "../lib/waveLoadProgress";
import type { WavePeaksPayload } from "../lib/wavePeaksTypes";
import {
  commitPeaksToStoreIfAllowed,
  hasUsablePeaksInStore,
  persistWavePeaksPayload,
  type WavePeaksPayload as SessionWavePeaksPayload,
} from "../lib/wavePeaksSession";
import { playbackEngine } from "../core/playbackEngine";
import { alignPlaybackDurationWithWaveform } from "../lib/wavePlaybackDuration";

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
};

/** 端末デコードのタイムアウト（ms）。Worker 切替の 44100*45 サンプル閾値とは無関係 */
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
  /**
   * true のときキャッシュ／precomputed のみ反映（即時プレビュー用）。
   * 音源バイトが手元にあっても端末デコードは行わない。
   */
  previewOnly?: boolean;
};

/**
 * ArrayBuffer をデコードして波形ピークと再生 UI の長さを更新する。
 */
export function useTimelineWaveDecode({ setProject }: Params) {
  const setDuration = usePlaybackUiStore((s) => s.setDurationSec);

  const applyPeaksAndDuration = useCallback(
    async (
      rawPeaks: number[],
      durSec: number,
      cacheKey?: string | null
    ): Promise<SessionWavePeaksPayload | null> => {
      const peaks = refinePeaksForTimeline(rawPeaks, durSec);
      const payload: SessionWavePeaksPayload = { peaks, durationSec: durSec };
      const committed = commitPeaksToStoreIfAllowed(payload, {
        cacheKey: cacheKey ?? null,
      });
      if (!committed) {
        clearWaveLoadProgress();
        return null;
      }
      if (Number.isFinite(durSec) && durSec > 0) {
        await alignPlaybackDurationWithWaveform(durSec);
        setDuration(durSec);
        setProject((p) => expandShortCuesAfterAudioLoad(p, durSec));
      }
      reportWaveLoadProgress(1, "完了");
      clearWaveLoadProgress();
      return committed;
    },
    [setDuration, setProject]
  );

  const persistIfApplied = useCallback(
    async (
      applied: SessionWavePeaksPayload | null,
      cacheKey: string | null,
      supabaseAudioPath: string | null
    ) => {
      if (!applied) return;
      await persistWavePeaksPayload(applied, { cacheKey, supabaseAudioPath });
    },
    []
  );

  const decodePeaksFromBuffer = useCallback(
    async (buf: ArrayBuffer, options?: DecodePeaksOptions) => {
      const cacheKey = options?.cacheKey ?? null;
      const supabaseAudioPath = options?.supabaseAudioPath ?? null;
      const previewOnly = options?.previewOnly === true;

      const decodeClientPeaks = async (audioBuf: ArrayBuffer) => {
        reportWaveLoadProgress(0.92, "波形を端末で解析中…");
        const stopTick = runIndeterminateDecodeProgress(
          0.92,
          0.99,
          "波形を端末で解析中…"
        );
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
        const applied = await applyPeaksAndDuration(peaks, durationSec, cacheKey);
        await persistIfApplied(applied, cacheKey, supabaseAudioPath);
      };

      try {
        const audioBuf = await resolveAudioBufferForDecode(buf);

        /** 再生中の音源バイトが取れるときは常に端末デコード（尺と波形の一致を保証） */
        if (audioBuf.byteLength > 0 && !previewOnly) {
          await decodeClientPeaks(audioBuf);
          return;
        }

        if (options?.precomputed?.peaks.length) {
          const pre = options.precomputed;
          const resolutionStale = isWavePeaksResolutionStale(
            pre.peaks,
            pre.durationSec
          );
          const rejectPrecomputed =
            isPlaceholderLikeWavePeaks(pre.peaks) ||
            (resolutionStale && !previewOnly);
          if (!rejectPrecomputed) {
            reportWaveLoadProgress(0.92, "波形を反映中…");
            const applied = await applyPeaksAndDuration(
              pre.peaks,
              pre.durationSec,
              cacheKey
            );
            if (!previewOnly) {
              await persistIfApplied(applied, cacheKey, supabaseAudioPath);
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
              const applied = await applyPeaksAndDuration(
                cached.peaks,
                cached.durationSec,
                cacheKey
              );
              await persistIfApplied(applied, cacheKey, supabaseAudioPath);
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
              const applied = await applyPeaksAndDuration(
                sidecar.peaks,
                sidecar.durationSec,
                cacheKey
              );
              await persistIfApplied(applied, cacheKey, supabaseAudioPath);
              return;
            }
          }
        }

        if (audioBuf.byteLength > 0) {
          await decodeClientPeaks(audioBuf);
          return;
        }

        if (hasUsablePeaksInStore()) {
          clearWaveLoadProgress();
          return;
        }
        throw new Error("音声データが空です。音源を再度追加してください。");
      } catch (err) {
        reportWaveLoadError(
          err instanceof Error ? err.message : "波形の読み込みに失敗しました"
        );
        throw err;
      }
    },
    [applyPeaksAndDuration, persistIfApplied]
  );

  const applyPrecomputedPeaks = useCallback(
    async (
      payload: WavePeaksPayload,
      options?: Pick<DecodePeaksOptions, "cacheKey" | "supabaseAudioPath" | "previewOnly">
    ) => {
      await decodePeaksFromBuffer(new ArrayBuffer(0), {
        cacheKey: options?.cacheKey,
        supabaseAudioPath: options?.supabaseAudioPath,
        previewOnly: options?.previewOnly,
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

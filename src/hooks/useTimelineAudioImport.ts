import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useRef, useState } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { audioApiUpload } from "../api/client";
import {
  extractAudioBufferFromVideoFile,
  guessAudioMimeFromFilename,
  isVideoFile,
  mimeForExtractedVideoAudio,
  preloadFFmpeg,
  tryNativeDecodeAudioFallback,
} from "../lib/extractVideoAudio";
import { playCompletionWoof } from "../lib/playCompletionWoof";
import { playbackEngine } from "../core/playbackEngine";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import {
  revokeBlobUrlUnlessCloudPersisted,
  revokePersistedServerAudioBlob,
  revokePersistedSupabaseAudioBlob,
  setPersistedServerAudio,
  setPersistedSupabaseAudio,
} from "../lib/timelineAudioBlobPersist";
import type { TimelineExtractProgress } from "../components/TimelineAudioChrome";
import {
  wavePeaksCacheKeyForServerAsset,
  wavePeaksCacheKeyForSupabase,
} from "../lib/wavePeaksCache";
import type { DecodePeaksOptions } from "./useTimelineWaveDecode";
import {
  computeServerWavePeaksFromBlob,
  payloadToPeaksResult,
} from "../lib/wavePeaksServerApi";
import { resolveServerAssetWavePeaks } from "../lib/resolveRemoteWavePeaks";
import {
  clearWaveLoadProgress,
  reportWaveLoadError,
  reportWaveLoadProgress,
} from "../lib/waveLoadProgress";
import {
  generateWaveformPeaksFromArrayBuffer,
  generateWaveformPeaksFromFile,
  validateAudioFile,
  type WaveformPeaksResult,
} from "../lib/generateWaveformPeaks";
import { waitForAudioElementReady } from "../lib/audioElementReady";
import { resyncEditorPlaybackMedia } from "../lib/resyncPlaybackMedia";
import { putFlowLibraryAudio } from "../lib/flowLibraryLocalAudio";

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  loggedIn: boolean;
  serverProjectId: number | null;
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksFromBuffer: (
    buf: ArrayBuffer,
    options?: DecodePeaksOptions
  ) => Promise<void>;
  persistProjectToCloudAfterAudioImport?: (
    audioPatch?: Pick<
      ChoreographyProjectJson,
      "audioSupabasePath" | "audioAssetId" | "flowLocalAudioKey"
    >
  ) => Promise<unknown>;
};

async function decodePeaksWithNativeFallback(
  file: File,
  buf: ArrayBuffer,
  isVideo: boolean,
  decodePeaksFromBuffer: (
    buf: ArrayBuffer,
    options?: DecodePeaksOptions
  ) => Promise<void>,
  options?: DecodePeaksOptions
): Promise<ArrayBuffer> {
  try {
    await decodePeaksFromBuffer(buf, options);
    return buf;
  } catch (err) {
    if (isVideo) throw err;
    const native = await tryNativeDecodeAudioFallback(file).catch(() => null);
    if (!native) throw err;
    await decodePeaksFromBuffer(native, options);
    return native;
  }
}

async function applyQuickPeaksIfReady(
  decodePeaksFromBuffer: Params["decodePeaksFromBuffer"],
  quick: WaveformPeaksResult | null,
  options?: DecodePeaksOptions
) {
  if (!quick?.peaks.length || !(quick.durationSec > 0)) return;
  await decodePeaksFromBuffer(new ArrayBuffer(0), {
    ...options,
    precomputed: { peaks: quick.peaks, durationSec: quick.durationSec },
  });
}

async function mountLocalPlaybackBlob(
  blobUrlRef: MutableRefObject<string | null>,
  buf: ArrayBuffer,
  mime: string
): Promise<string> {
  const url = URL.createObjectURL(new Blob([buf], { type: mime }));
  if (blobUrlRef.current && blobUrlRef.current !== url) {
    revokeBlobUrlUnlessCloudPersisted(blobUrlRef.current);
  }
  blobUrlRef.current = url;
  usePlaybackUiStore.getState().setTrustedAudioDurationSec(null);
  playbackEngine.setMediaSourceUrl(url);
  await waitForAudioElementReady(playbackEngine.getMediaElement()).catch(() => {});
  void resyncEditorPlaybackMedia(blobUrlRef, { force: true }).catch(() => {});
  clearWaveLoadProgress();
  return url;
}

export function useTimelineAudioImport({
  setProject,
  loggedIn,
  serverProjectId,
  blobUrlRef,
  decodePeaksFromBuffer,
  persistProjectToCloudAfterAudioImport,
}: Params) {
  const [extractProgress, setExtractProgress] = useState<TimelineExtractProgress | null>(
    null
  );
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const updateExtractProgress = useCallback((progress: TimelineExtractProgress | null) => {
    setExtractProgress(progress);
    if (progress) {
      reportWaveLoadProgress(progress.ratio, progress.message ?? "音声を抽出中…");
    }
  }, []);

  const onPickAudio = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;

      try {
        if (!isVideoFile(f)) {
          validateAudioFile(f);
        }
      } catch (err) {
        reportWaveLoadError(
          err instanceof Error ? err.message : "ファイルを読み込めませんでした"
        );
        alert(err instanceof Error ? err.message : "ファイルを読み込めませんでした");
        return;
      }

      reportWaveLoadProgress(0.05, "音源ファイルを読み込み中…");
      setProject((p) => ({ ...p, flowLocalAudioKey: null }));
      const isVideo = isVideoFile(f);
      if (isVideo) {
        const ok = window.confirm(
          `動画「${f.name}」から音声を抽出します。\nMP4 / AVI / MOV / MKV / WMV などほとんどの形式に対応。AAC / MP3 / Opus などの一般的な音声は再エンコードせず demux するので、大容量の動画でも数秒〜十数秒で完了します。\nFFmpeg コア（約 30MB）はエディタ起動時と「音源追加」ボタンのホバー時点で先読み済みのはずなので、通常は読み込み待ちなしで抽出が始まります。\n著作権・利用範囲はご利用者の責任です。続行しますか？`
        );
        if (!ok) return;
      }

      /** クラウド保存: クイック波形 → 即再生 → アップロード → 高精度波形 */
      if (loggedIn && serverProjectId != null && !isVideo) {
        try {
          reportWaveLoadProgress(0.1, "波形を解析中…");
          const [quickPeaks, buf] = await Promise.all([
            generateWaveformPeaksFromFile(f).catch(() => null),
            f.arrayBuffer(),
          ]);
          const mime =
            f.type || guessAudioMimeFromFilename(f.name) || "audio/mpeg";

          await mountLocalPlaybackBlob(blobUrlRef, buf, mime);
          await applyQuickPeaksIfReady(decodePeaksFromBuffer, quickPeaks);

          const fd = new FormData();
          fd.append("file", f);
          fd.append("projectId", String(serverProjectId));
          const up = await audioApiUpload(fd, (ratio, msg) => {
            reportWaveLoadProgress(
              ratio < 0.45 ? 0.1 + ratio * 0.7 : 0.4,
              msg
            );
          });
          reportWaveLoadProgress(0.45, "クラウドに保存中…");

          if (up.kind === "supabase") {
            revokePersistedServerAudioBlob();
            revokePersistedSupabaseAudioBlob();
            setPersistedSupabaseAudio(blobUrlRef.current!, up.path);
            setProject((p) => ({
              ...p,
              audioSupabasePath: up.path,
              audioAssetId: null,
              flowLocalAudioKey: null,
            }));
            if (persistProjectToCloudAfterAudioImport) {
              try {
                await persistProjectToCloudAfterAudioImport({
                  audioSupabasePath: up.path,
                  audioAssetId: null,
                  flowLocalAudioKey: null,
                });
              } catch (persistErr) {
                console.warn(
                  "[audioImport] cloud project save after upload:",
                  persistErr
                );
                reportWaveLoadError(
                  "音源はアップロード済みですが作品の保存に失敗しました。上書き保存を実行してください。"
                );
              }
            }
          } else {
            revokePersistedSupabaseAudioBlob();
            revokePersistedServerAudioBlob();
            setPersistedServerAudio(blobUrlRef.current!, up.id);
            setProject((p) => ({
              ...p,
              audioAssetId: up.id,
              audioSupabasePath: null,
              flowLocalAudioKey: null,
            }));
          }

          reportWaveLoadProgress(0.55, "高精度波形を取得中…");
          const decodeOpts: DecodePeaksOptions =
            up.kind === "supabase"
              ? {
                  cacheKey: wavePeaksCacheKeyForSupabase(up.path),
                  supabaseAudioPath: up.path,
                }
              : { cacheKey: wavePeaksCacheKeyForServerAsset(up.id) };

          if (up.kind === "server") {
            await resolveServerAssetWavePeaks(
              up.id,
              () => Promise.resolve(buf),
              decodePeaksFromBuffer,
              decodeOpts
            );
          } else {
            try {
              const payload = await computeServerWavePeaksFromBlob(
                new Blob([buf], { type: mime }),
                f.name
              );
              await decodePeaksFromBuffer(new ArrayBuffer(0), {
                ...decodeOpts,
                precomputed: payloadToPeaksResult(payload),
              });
            } catch (err) {
              console.warn("[audioImport] server peaks failed, keeping quick waveform:", err);
            }
          }
          return;
        } catch (err) {
          console.warn("[audioImport] cloud upload failed, falling back to local:", err);
          reportWaveLoadError(
            err instanceof Error
              ? err.message
              : "クラウドへの音源保存に失敗しました。ログイン状態とネットワークを確認してください。"
          );
        }
      }

      if (loggedIn && serverProjectId != null && isVideo) {
        setProject((p) => ({
          ...p,
          audioAssetId: null,
          audioSupabasePath: null,
          flowLocalAudioKey: null,
        }));
      }

      let buf: ArrayBuffer;
      try {
        if (isVideo) {
          updateExtractProgress({ ratio: 0, stage: "decode", message: "抽出準備中…" });
          buf = await extractAudioBufferFromVideoFile(f, (p) => {
            updateExtractProgress(p);
          });
        } else {
          reportWaveLoadProgress(0.12, "波形を解析中…");
          const [quickPeaks, fileBuf] = await Promise.all([
            generateWaveformPeaksFromFile(f).catch(() => null),
            f.arrayBuffer(),
          ]);
          buf = fileBuf;
          const mime = f.type || guessAudioMimeFromFilename(f.name);
          await mountLocalPlaybackBlob(blobUrlRef, buf, mime);
          await applyQuickPeaksIfReady(decodePeaksFromBuffer, quickPeaks);
          if (loggedIn && serverProjectId != null) {
            const flowKey = crypto.randomUUID();
            await putFlowLibraryAudio(flowKey, new Blob([buf], { type: mime }));
            setProject((p) => ({
              ...p,
              flowLocalAudioKey: flowKey,
              audioSupabasePath: null,
              audioAssetId: null,
            }));
          }
          reportWaveLoadProgress(0.45, "波形を高精度化中…");
        }
      } catch (err) {
        updateExtractProgress(null);
        reportWaveLoadError(
          err instanceof Error ? err.message : "読み込みに失敗しました"
        );
        alert(err instanceof Error ? err.message : "読み込みに失敗しました");
        return;
      } finally {
        if (isVideo) {
          setTimeout(() => setExtractProgress(null), 400);
        }
      }

      const mime = isVideo
        ? mimeForExtractedVideoAudio(buf)
        : f.type || guessAudioMimeFromFilename(f.name);

      if (isVideo) {
        await mountLocalPlaybackBlob(blobUrlRef, buf, mime);
        reportWaveLoadProgress(0.35, "波形を解析中…");
      }

      try {
        let quickFromBuf: WaveformPeaksResult | null = null;
        if (isVideo) {
          quickFromBuf = await generateWaveformPeaksFromArrayBuffer(buf).catch(
            () => null
          );
          await applyQuickPeaksIfReady(decodePeaksFromBuffer, quickFromBuf);
        }

        const decodedBuf = await decodePeaksWithNativeFallback(
          f,
          buf,
          isVideo,
          decodePeaksFromBuffer
        );
        if (decodedBuf !== buf) {
          const wavUrl = URL.createObjectURL(
            new Blob([decodedBuf], { type: "audio/wav" })
          );
          if (blobUrlRef.current) {
            revokeBlobUrlUnlessCloudPersisted(blobUrlRef.current);
          }
          blobUrlRef.current = wavUrl;
          playbackEngine.setMediaSourceUrl(wavUrl);
        }
      } catch (err) {
        alert(
          err instanceof Error
            ? err.message
            : "音声のデコードに失敗しました。別の形式（MP3 / M4A / WAV）でお試しください。"
        );
        return;
      }
      if (isVideo) {
        playCompletionWoof();
      }
    },
    [
      blobUrlRef,
      decodePeaksFromBuffer,
      loggedIn,
      serverProjectId,
      setProject,
      updateExtractProgress,
      persistProjectToCloudAfterAudioImport,
    ]
  );

  const openAudioImport = useCallback(() => {
    void preloadFFmpeg();
    audioFileInputRef.current?.click();
  }, []);

  return {
    extractProgress,
    audioFileInputRef,
    onPickAudio,
    openAudioImport,
  };
}

import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useRef, useState } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { audioApiUpload } from "../api/client";
import {
  extractAudioBufferFromVideoFile,
  mimeForExtractedVideoAudio,
  preloadFFmpeg,
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

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  loggedIn: boolean;
  serverProjectId: number | null;
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksFromBuffer: (buf: ArrayBuffer) => Promise<void>;
};

export function useTimelineAudioImport({
  setProject,
  loggedIn,
  serverProjectId,
  blobUrlRef,
  decodePeaksFromBuffer,
}: Params) {
  const [extractProgress, setExtractProgress] = useState<TimelineExtractProgress | null>(
    null
  );
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const clearPlaybackTrustedDurationSec = () =>
    usePlaybackUiStore.getState().setTrustedAudioDurationSec(null);

  const onPickAudio = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      setProject((p) => ({ ...p, flowLocalAudioKey: null }));
      const isVideo = f.type.startsWith("video/");
      if (isVideo) {
        const ok = window.confirm(
          `動画「${f.name}」から音声を抽出します。\nMP4 / AVI / MOV / MKV / WMV などほとんどの形式に対応。AAC / MP3 / Opus などの一般的な音声は再エンコードせず demux するので、大容量の動画でも数秒〜十数秒で完了します。\nFFmpeg コア（約 30MB）はエディタ起動時と「音源追加」ボタンのホバー時点で先読み済みのはずなので、通常は読み込み待ちなしで抽出が始まります。\n著作権・利用範囲はご利用者の責任です。続行しますか？`
        );
        if (!ok) return;
      }
      /** クラウド保存とローカル読みを並列化し、成功直後は blob で即再生（useEffect は再利用のみネット無し） */
      if (loggedIn && serverProjectId != null && !isVideo) {
        try {
          const fd = new FormData();
          fd.append("file", f);
          fd.append("projectId", String(serverProjectId));
          const [up, buf] = await Promise.all([
            audioApiUpload(fd),
            f.arrayBuffer(),
          ]);
          const mime =
            f.type ||
            (up.kind === "supabase" ? up.mime : "audio/mpeg") ||
            "audio/mpeg";
          const url = URL.createObjectURL(new Blob([buf], { type: mime }));

          if (blobUrlRef.current && blobUrlRef.current !== url) {
            revokeBlobUrlUnlessCloudPersisted(blobUrlRef.current);
          }
          blobUrlRef.current = url;

          if (up.kind === "supabase") {
            revokePersistedServerAudioBlob();
            revokePersistedSupabaseAudioBlob();
            setPersistedSupabaseAudio(url, up.path);
            setProject((p) => ({
              ...p,
              audioSupabasePath: up.path,
              audioAssetId: null,
              flowLocalAudioKey: null,
            }));
          } else {
            revokePersistedSupabaseAudioBlob();
            revokePersistedServerAudioBlob();
            setPersistedServerAudio(url, up.id);
            setProject((p) => ({
              ...p,
              audioAssetId: up.id,
              audioSupabasePath: null,
              flowLocalAudioKey: null,
            }));
          }

          clearPlaybackTrustedDurationSec();
          playbackEngine.setMediaSourceUrl(url);
          await decodePeaksFromBuffer(buf);
          return;
        } catch (err) {
          alert(err instanceof Error ? err.message : "サーバへのアップロードに失敗しました");
          /** クラウド保存を試みたのに失敗したら、下のローカル読み込みに進まない（成功したように見えるため） */
          return;
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
          setExtractProgress({ ratio: 0, stage: "decode", message: "抽出準備中…" });
          buf = await extractAudioBufferFromVideoFile(f, (p) => {
            setExtractProgress(p);
          });
        } else {
          buf = await f.arrayBuffer();
        }
      } catch (err) {
        setExtractProgress(null);
        alert(err instanceof Error ? err.message : "読み込みに失敗しました");
        return;
      } finally {
        if (isVideo) {
          /** 完了 or エラー直後は一瞬だけ 100% を見せてから消す */
          setTimeout(() => setExtractProgress(null), 400);
        }
      }
      const blob = new Blob([buf], {
        type: isVideo ? mimeForExtractedVideoAudio(buf) : f.type || "audio/mpeg",
      });
      const url = URL.createObjectURL(blob);
      if (blobUrlRef.current) {
        revokeBlobUrlUnlessCloudPersisted(blobUrlRef.current);
      }
      blobUrlRef.current = url;
      clearPlaybackTrustedDurationSec();
      playbackEngine.setMediaSourceUrl(url);
      await decodePeaksFromBuffer(buf);
      if (isVideo) {
        playCompletionWoof();
      }
    },
    [blobUrlRef, decodePeaksFromBuffer, loggedIn, serverProjectId, setProject]
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

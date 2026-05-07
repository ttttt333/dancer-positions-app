import { useState, useCallback } from "react";
import type { AudioAssetUpload, AudioAssetResponse } from "../types/audioAssets";
import { uploadAudioAsset } from "../lib/audioAssets";

export function useAudioAssetUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const uploadAudio = useCallback(async (
    file: File,
    wavePeaks?: number[]
  ): Promise<AudioAssetResponse | null> => {
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      // 音源の尺を取得（Audio APIを使用）
      const durationSec = await getAudioDuration(file);

      const uploadData: AudioAssetUpload = {
        file,
        filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        duration_sec: durationSec,
        wave_peaks: wavePeaks || null,
      };

      setProgress(50); // アップロード開始

      const result = await uploadAudioAsset(uploadData);
      
      setProgress(100);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000); // 進捗バーをリセット
    }
  }, []);

  return {
    uploadAudio,
    isUploading,
    error,
    progress,
  };
}

/**
 * 音源ファイルの尺を取得
 */
async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration);
    });
    audio.addEventListener("error", () => {
      reject(new Error("Failed to load audio metadata"));
    });
    audio.src = URL.createObjectURL(file);
  });
}

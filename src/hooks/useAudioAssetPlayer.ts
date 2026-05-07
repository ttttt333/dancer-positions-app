import { useState, useCallback, useRef, useEffect } from "react";
import type { AudioAssetResponse } from "../types/audioAssets";
import { downloadAudioAsset, getAudioAssetSignedUrl } from "../lib/audioAssets";

export function useAudioAssetPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // 音源をロード
  const loadAudio = useCallback(async (audioAsset: AudioAssetResponse) => {
    setIsLoading(true);
    setError(null);

    try {
      // 既存の音源をクリーンアップ
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      // 署名付きURLを取得
      const signedUrl = await getAudioAssetSignedUrl(audioAsset.storage_path);
      
      // Audio要素を作成
      const audio = new Audio(signedUrl);
      audioRef.current = audio;
      audioUrlRef.current = signedUrl;

      // イベントリスナーを設定
      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
        setIsLoading(false);
      });

      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);
      });

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      audio.addEventListener("error", () => {
        setError("Failed to load audio");
        setIsLoading(false);
      });

      // 音源をプリロード
      await audio.load();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load audio";
      setError(errorMessage);
      setIsLoading(false);
    }
  }, []);

  // 再生/一時停止
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || isLoading) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        setError("Failed to play audio");
        console.error("Audio play failed:", err);
      });
    }
  }, [isPlaying, isLoading]);

  // シーク
  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    const clampedTime = Math.max(0, Math.min(time, duration));
    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, [duration]);

  // 音量設定
  const setVolume = useCallback((volume: number) => {
    if (!audioRef.current) return;
    
    const clampedVolume = Math.max(0, Math.min(1, volume));
    audioRef.current.volume = clampedVolume;
  }, []);

  // 再生速度設定
  const setPlaybackRate = useCallback((rate: number) => {
    if (!audioRef.current) return;
    
    audioRef.current.playbackRate = rate;
  }, []);

  // クリーンアップ
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, []);

  // コンポーネントアンマウント時にクリーンアップ
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    loadAudio,
    togglePlayPause,
    seek,
    setVolume,
    setPlaybackRate,
    cleanup,
    isPlaying,
    isLoading,
    error,
    currentTime,
    duration,
  };
}

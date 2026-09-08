/**
 * 音源ピーク確定後にバックグラウンドで曲構造を自動解析し、
 * セクション色分け＋8カウントグリッド用ビートを埋める。
 */

import { useEffect, useRef } from "react";
import { useWavePeaksStore } from "../store/wavePeaksStore";
import { useMusicSectionOverlayStore } from "../store/musicSectionOverlayStore";
import { playbackEngine } from "../core/playbackEngine";
import {
  resetAutoAudioAnalysisGuard,
  runAutoAudioAnalysis,
} from "../lib/audioAnalysis/runAutoAudioAnalysis";
import { isPlaceholderLikeWavePeaks } from "../lib/placeholderWavePeaks";

type Args = {
  enabled?: boolean;
  audioSupabasePath?: string | null;
  trackTitle?: string | null;
  /** 共有ビューでは自動解析しない */
  publicShareView?: boolean;
};

export function useAutoAudioAnalysis({
  enabled = true,
  audioSupabasePath,
  trackTitle,
  publicShareView = false,
}: Args): void {
  const peaks = useWavePeaksStore((s) => s.peaks);
  const peaksDurationSec = useWavePeaksStore((s) => s.peaksDurationSec);
  const peaksCacheKey = useWavePeaksStore((s) => s.peaksCacheKey);
  const abortRef = useRef<AbortController | null>(null);
  const prevAudioKeyRef = useRef<string | null>(null);

  // 音源切替でオーバーレイとガードをリセット
  useEffect(() => {
    const audioKey =
      (typeof audioSupabasePath === "string" && audioSupabasePath.trim()) ||
      peaksCacheKey ||
      null;
    if (prevAudioKeyRef.current && audioKey && prevAudioKeyRef.current !== audioKey) {
      abortRef.current?.abort();
      resetAutoAudioAnalysisGuard();
      useMusicSectionOverlayStore.getState().clear();
    }
    prevAudioKeyRef.current = audioKey;
  }, [audioSupabasePath, peaksCacheKey]);

  useEffect(() => {
    if (!enabled || publicShareView) return;
    if (!peaks?.length || !peaksDurationSec || peaksDurationSec <= 0) return;
    if (isPlaceholderLikeWavePeaks(peaks)) return;

    const path =
      typeof audioSupabasePath === "string" && audioSupabasePath.trim()
        ? audioSupabasePath.trim()
        : null;
    const mediaUrl = playbackEngine.getMediaSourceUrl();
    const httpsUrl =
      typeof mediaUrl === "string" && /^https?:\/\//i.test(mediaUrl)
        ? mediaUrl
        : null;

    // ローカル blob のみでもブラウザ解析は回せる
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = window.setTimeout(() => {
      void runAutoAudioAnalysis({
        audioSupabasePath: path,
        audioUrl: httpsUrl,
        trackTitle,
        peaks,
        durationSec: peaksDurationSec,
        cacheKey: peaksCacheKey,
        signal: controller.signal,
      });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    enabled,
    publicShareView,
    peaks,
    peaksDurationSec,
    peaksCacheKey,
    audioSupabasePath,
    trackTitle,
  ]);
}

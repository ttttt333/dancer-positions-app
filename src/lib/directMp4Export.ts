import { drawStageExportFrame } from "./drawStageExportFrame";
import type { StageExportAppearance } from "./stageExportAppearance";
import type { VideoExportQualityPreset } from "./videoExportQualityPresets";
import { resolvePlaybackAudioUrlForExport } from "./resolvePlaybackAudioUrlForExport";

/**
 * Safari/iOS 向けの MP4 直接録画。
 * MediaRecorder が H.264+AAC の MP4 を出せる環境では、canvas 映像 + 音声を
 * 1 本の MediaStream にまとめてリアルタイム録画し、FFmpeg.wasm を完全に迂回する。
 * リアルタイム録画のため所要時間は曲尺とほぼ同じ（コア DL・wasm 変換は不要）。
 */

export type DirectMp4Formation = {
  startSec: number;
  dancers: Array<{
    name: string;
    markerBadge?: string;
    markerBadgeSource?: "centerDistance";
    color: string;
    x: number;
    y: number;
  }>;
};

type RealtimeAudioController = {
  track: MediaStreamTrack;
  start: () => Promise<void>;
  getCurrentTime: () => number;
  stop: () => void;
  cleanup: () => void;
};

type WebkitWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

function waitForAudioReady(el: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (el.readyState >= 3) {
      resolve();
      return;
    }
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("音源の読み込みに失敗しました"));
    };
    const cleanup = () => {
      el.removeEventListener("canplaythrough", onReady);
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("error", onError);
      window.clearTimeout(timer);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      // 読み込みが進んでいれば続行、そうでなければ失敗
      if (el.readyState >= 2) resolve();
      else reject(new Error("音源の読み込みがタイムアウトしました"));
    }, 15_000);
    el.addEventListener("canplaythrough", onReady);
    el.addEventListener("canplay", onReady);
    el.addEventListener("error", onError);
  });
}

/**
 * 再生用音源からリアルタイム録音用の音声トラックを作る。
 * 取得できない場合は null（呼び出し側で FFmpeg 経路にフォールバック）。
 */
async function createRealtimeAudioController(
  audioStartSec: number
): Promise<RealtimeAudioController | null> {
  const url = resolvePlaybackAudioUrlForExport();
  if (!url) return null;

  const AudioCtx =
    window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AudioCtx) return null;

  const audioEl = new Audio();
  audioEl.crossOrigin = "anonymous";
  audioEl.preload = "auto";
  audioEl.src = url;

  try {
    audioEl.load();
    await waitForAudioReady(audioEl);
  } catch (e) {
    audioEl.src = "";
    throw e;
  }

  const ctx = new AudioCtx();
  let sourceNode: MediaElementAudioSourceNode;
  try {
    sourceNode = ctx.createMediaElementSource(audioEl);
  } catch (e) {
    void ctx.close();
    audioEl.src = "";
    throw e;
  }
  const dest = ctx.createMediaStreamDestination();
  sourceNode.connect(dest);

  const track = dest.stream.getAudioTracks()[0];
  if (!track) {
    void ctx.close();
    audioEl.src = "";
    return null;
  }

  return {
    track,
    start: async () => {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
      audioEl.currentTime = Math.max(0, audioStartSec);
      await audioEl.play();
    },
    getCurrentTime: () => audioEl.currentTime,
    stop: () => {
      try {
        audioEl.pause();
      } catch {
        /* ignore */
      }
    },
    cleanup: () => {
      try {
        audioEl.pause();
      } catch {
        /* ignore */
      }
      try {
        sourceNode.disconnect();
      } catch {
        /* ignore */
      }
      void ctx.close().catch(() => {});
      audioEl.src = "";
    },
  };
}

function estimateVideoBitrate(quality: VideoExportQualityPreset): number {
  const pixels = quality.width * quality.height;
  const perPixelPerFrame = 0.08;
  return Math.round(pixels * quality.fps * perPixelPerFrame);
}

export type RecordDirectMp4Params = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mimeType: string;
  quality: VideoExportQualityPreset;
  durationSec: number;
  audioStartSec: number;
  formations: DirectMp4Formation[];
  stageAppearance: StageExportAppearance;
  onProgress: (ratio: number) => void;
  onAudioMissing?: () => void;
  isCancelled: () => boolean;
};

export type DirectMp4Result = {
  blob: Blob;
  hasAudio: boolean;
};

export async function recordDirectMp4(
  params: RecordDirectMp4Params
): Promise<DirectMp4Result> {
  const {
    canvas,
    ctx,
    mimeType,
    quality,
    durationSec,
    audioStartSec,
    formations,
    stageAppearance,
    onProgress,
    onAudioMissing,
    isCancelled,
  } = params;

  canvas.width = quality.width;
  canvas.height = quality.height;

  if (typeof canvas.captureStream !== "function") {
    throw new Error("このブラウザでは動画キャプチャに対応していません");
  }

  let audioCtl: RealtimeAudioController | null = null;
  try {
    audioCtl = await createRealtimeAudioController(audioStartSec);
  } catch (e) {
    console.warn("[recordDirectMp4] audio setup failed:", e);
    audioCtl = null;
  }
  if (!audioCtl) {
    onAudioMissing?.();
  }

  const stream = canvas.captureStream(0);
  const videoTrack = stream.getVideoTracks()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  if (!videoTrack) {
    audioCtl?.cleanup();
    throw new Error("映像トラックを取得できませんでした");
  }
  const requestFrame = videoTrack.requestFrame?.bind(videoTrack) ?? null;

  const combined = new MediaStream();
  combined.addTrack(videoTrack);
  if (audioCtl) combined.addTrack(audioCtl.track);

  const recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: estimateVideoBitrate(quality),
    audioBitsPerSecond: 128_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const recordDone = new Promise<void>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("MP4 の録画に失敗しました"));
    recorder.onstop = () => resolve();
  });

  const cleanupTracks = () => {
    stream.getTracks().forEach((t) => t.stop());
    audioCtl?.cleanup();
  };

  try {
    recorder.start(200);
    if (audioCtl) {
      await audioCtl.start();
    }

    const perfStart = performance.now();
    let formationCursor = 0;

    await new Promise<void>((resolve) => {
      let rafId = 0;
      const tick = () => {
        if (isCancelled()) {
          resolve();
          return;
        }
        const elapsed = audioCtl
          ? audioCtl.getCurrentTime() - audioStartSec
          : (performance.now() - perfStart) / 1000;
        const t = Math.min(Math.max(0, elapsed), durationSec);

        while (
          formationCursor + 1 < formations.length &&
          formations[formationCursor + 1].startSec <= t
        ) {
          formationCursor += 1;
        }
        while (formationCursor > 0 && formations[formationCursor].startSec > t) {
          formationCursor -= 1;
        }

        drawStageExportFrame(
          ctx,
          quality.width,
          quality.height,
          t,
          formations,
          stageAppearance,
          formationCursor
        );
        requestFrame?.();
        onProgress(Math.min(1, elapsed / durationSec));

        if (elapsed >= durationSec) {
          resolve();
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      void rafId;
    });

    audioCtl?.stop();
    recorder.stop();
    await recordDone;

    const blob = new Blob(chunks, {
      type: mimeType.split(";")[0] || "video/mp4",
    });
    if (blob.size < 256) {
      throw new Error("録画データが空です");
    }
    return { blob, hasAudio: Boolean(audioCtl) };
  } finally {
    cleanupTracks();
  }
}

import { useCallback, type RefObject } from "react";
import { fetchFile } from "@ffmpeg/util";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  downloadVideoBlob,
  safeVideoBaseName,
  shareVideoFile,
} from "../lib/shareVideoFile";
import { videoExportDisplayTitle } from "../lib/videoExportFileName";
import { fetchAudioForFfmpeg } from "../lib/fetchAudioForFfmpeg";
import {
  resolveExportAudioBytesForFfmpeg,
  type ExportAudioFallback,
} from "../lib/resolveExportAudioForFfmpeg";
import { ffmpegExecChecked, loadFFmpegWasm, resetFFmpegWasm } from "../lib/ffmpegWasm";
import {
  checkVideoExportCapabilities,
  getDirectMp4RecorderMimeType,
  getSupportedRecorderMimeType,
} from "../lib/videoExportCapabilities";
import { recordDirectMp4, ExportBackgroundedError } from "../lib/directMp4Export";
import {
  checkWebCodecsMp4Support,
  exportMp4WithWebCodecs,
} from "../lib/webCodecsMp4Export";
import { resolvePlaybackAudioUrlForExport } from "../lib/resolvePlaybackAudioUrlForExport";
import { drawStageExportFrame } from "../lib/drawStageExportFrame";
import type { StageExportAppearance } from "../lib/stageExportAppearance";
import {
  DEFAULT_VIDEO_EXPORT_QUALITY,
  formatVideoExportQualitySpec,
  type VideoExportQualityPreset,
} from "../lib/videoExportQualityPresets";
import {
  mapVideoExportPhaseProgress,
  VIDEO_EXPORT_PHASE_LABELS,
} from "../lib/videoExportProgress";
import {
  useVideoExportRunStore,
  videoExportCancelRef,
  videoExportProgressRef,
  type ExportEncodeSubphase,
  type ExportPhase,
} from "../store/videoExportRunStore";

export type VideoExportResult = {
  downloadName: string;
  shared: boolean;
  format: "mp4" | "webm";
  size: number;
  fallbackReason?: string;
  /** @deprecated format === "webm" を使用 */
  webmFallback?: boolean;
};

export type { VideoExportCapabilityCheck } from "../lib/videoExportCapabilities";
export { checkVideoExportCapabilities };
export type { ExportPhase, ExportEncodeSubphase };
export type { VideoExportQualityPreset };

export type ExportOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  audioUrl: string | null;
  audioFallback?: ExportAudioFallback;
  durationSec: number;
  fileName: string;
  formations: Array<{
    id: string;
    name: string;
    startSec: number;
    dancers: Array<{
      id: string;
      name: string;
      markerBadge?: string;
      markerBadgeSource?: "centerDistance";
      color: string;
      x: number;
      y: number;
    }>;
  }>;
  stageAppearance: StageExportAppearance;
  audioStartSec?: number;
  quality?: VideoExportQualityPreset;
  shareAfter?: boolean;
  onFfmpegFirstLoad?: () => void;
  onAudioSkipped?: () => void;
};

/** UI 更新間隔（大きいほど撮影ループは速い） */
const RECORD_YIELD_EVERY = 24;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveQuality(options: ExportOptions): VideoExportQualityPreset {
  return options.quality ?? DEFAULT_VIDEO_EXPORT_QUALITY;
}

/** エンコード中に UI が止まって見えない区間向けの緩やかな進捗 */
function startProgressCreep(
  getProgress: () => number,
  setProgressValue: (n: number) => void,
  cap: number,
  intervalMs = 900
): () => void {
  const id = window.setInterval(() => {
    const cur = getProgress();
    if (cur < cap) {
      setProgressValue(Math.min(cap, cur + 1));
    }
  }, intervalMs);
  return () => window.clearInterval(id);
}

async function tryWebmFallback(
  blob: Blob,
  options: ExportOptions,
  fallbackReason?: string
): Promise<VideoExportResult> {
  const downloadName = `${safeVideoBaseName(options.fileName)}.webm`;
  let shared = false;
  if (options.shareAfter) {
    shared = await shareVideoFile(
      blob,
      downloadName,
      videoExportDisplayTitle(options.fileName)
    );
    if (!shared) {
      downloadVideoBlob(blob, downloadName);
    }
  } else {
    downloadVideoBlob(blob, downloadName);
  }
  return {
    downloadName,
    shared,
    format: "webm",
    size: blob.size,
    fallbackReason,
    webmFallback: true,
  };
}

function blobFromFfmpegFile(data: Uint8Array | string): Blob {
  if (typeof data === "string") {
    return new Blob([data], { type: "video/mp4" });
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy], { type: "video/mp4" });
}

function createExportCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  quality: VideoExportQualityPreset
): {
  ctx2d: CanvasRenderingContext2D;
  videoStream: MediaStream;
  requestFrame: (() => void) | null;
} {
  const caps = checkVideoExportCapabilities();
  if (!caps.supported) {
    throw new Error(
      caps.blockReason ?? "このブラウザでは動画エクスポートに対応していません"
    );
  }

  const canvas = canvasRef.current ?? document.createElement("canvas");
  canvas.width = quality.width;
  canvas.height = quality.height;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) {
    throw new Error("Canvas 2D context を取得できません");
  }
  if (typeof canvas.captureStream !== "function") {
    throw new Error(
      "このブラウザでは動画キャプチャに対応していません（iOS 17+ が必要な場合があります）"
    );
  }

  const videoStream = canvas.captureStream(0);
  const track = videoStream.getVideoTracks()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  const requestFrame = track?.requestFrame?.bind(track) ?? null;

  return { ctx2d, videoStream, requestFrame };
}

async function muxRecordedWebmToMp4(
  ffmpeg: FFmpeg,
  params: {
    inputName: string;
    audioUrl: string | null;
    audioFallback?: ExportAudioFallback;
    audioStartSec: number;
    durationSec: number;
    videoFrameCount: number;
    quality: VideoExportQualityPreset;
    inputTimescale?: number;
  },
  hooks?: {
    onAudioProgress?: (ratio: number) => void;
    onMuxStart?: () => void;
    onAudioSkipped?: () => void;
  }
): Promise<void> {
  const {
    inputName,
    audioUrl,
    audioFallback,
    audioStartSec,
    durationSec,
    videoFrameCount,
    quality,
  } = params;
  const duration = String(durationSec);
  const fps = String(quality.fps);
  const videoFilter = `fps=${quality.fps},setpts=N/${quality.fps}/TB`;

  const inputTimescale =
    typeof params.inputTimescale === "number" &&
    Number.isFinite(params.inputTimescale) &&
    params.inputTimescale > 0.05 &&
    Math.abs(params.inputTimescale - 1) > 0.02
      ? params.inputTimescale
      : null;
  const inputHead = [
    "-y",
    "-fflags",
    "+genpts",
    ...(inputTimescale ? (["-itsscale", String(inputTimescale)] as const) : []),
    "-r",
    fps,
    "-i",
    inputName,
  ] as const;

  let audioData: Uint8Array | null = null;
  if (audioUrl || audioFallback) {
    if (audioFallback) {
      audioData = await resolveExportAudioBytesForFfmpeg(
        audioFallback,
        hooks?.onAudioProgress
      );
    } else if (audioUrl) {
      audioData = await fetchAudioForFfmpeg(audioUrl, hooks?.onAudioProgress);
    }
    if (!audioData) {
      hooks?.onAudioSkipped?.();
    } else {
      await ffmpeg.writeFile("audio_src", audioData);
    }
  }

  hooks?.onMuxStart?.();

  const videoEncode = [
    "-c:v",
    "libx264",
    "-preset",
    quality.ffmpegPreset,
    "-crf",
    String(quality.crf),
    "-pix_fmt",
    "yuv420p",
    "-r",
    fps,
    "-vsync",
    "cfr",
    "-frames:v",
    String(videoFrameCount),
  ];

  if (audioData) {
    await ffmpegExecChecked(ffmpeg, [
      ...inputHead,
      "-i",
      "audio_src",
      "-filter:v",
      videoFilter,
      "-filter:a",
      `atrim=start=${audioStartSec}:duration=${durationSec},asetpts=PTS-STARTPTS`,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      ...videoEncode,
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-t",
      duration,
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
    await ffmpeg.deleteFile("audio_src").catch(() => {});
  } else {
    await ffmpegExecChecked(ffmpeg, [
      ...inputHead,
      "-filter:v",
      videoFilter,
      ...videoEncode,
      "-an",
      "-t",
      duration,
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
  }
}

/**
 * 既に H.264 になっている MP4（WebCodecs 出力）へ音声だけを結合する。
 * 映像は `-c:v copy` で再エンコードしないため軽量・高速。
 * 音源が取得できない場合は元の映像のみ blob を返す（無音）。
 */
async function muxAudioIntoMp4(
  ffmpeg: FFmpeg,
  params: {
    videoBlob: Blob;
    audioUrl: string | null;
    audioFallback?: ExportAudioFallback;
    audioStartSec: number;
    durationSec: number;
  },
  hooks?: {
    onAudioProgress?: (ratio: number) => void;
    onMuxStart?: () => void;
    onAudioSkipped?: () => void;
  }
): Promise<Blob | null> {
  const { videoBlob, audioUrl, audioFallback, audioStartSec, durationSec } =
    params;

  let audioData: Uint8Array | null = null;
  if (audioFallback) {
    audioData = await resolveExportAudioBytesForFfmpeg(
      audioFallback,
      hooks?.onAudioProgress
    );
  } else if (audioUrl) {
    audioData = await fetchAudioForFfmpeg(audioUrl, hooks?.onAudioProgress);
  }
  if (!audioData) {
    hooks?.onAudioSkipped?.();
    return null;
  }

  await ffmpeg.writeFile("wc_video.mp4", await fetchFile(videoBlob));
  await ffmpeg.writeFile("wc_audio_src", audioData);
  hooks?.onMuxStart?.();

  await ffmpegExecChecked(ffmpeg, [
    "-y",
    "-i",
    "wc_video.mp4",
    "-i",
    "wc_audio_src",
    "-filter:a",
    `atrim=start=${audioStartSec}:duration=${durationSec},asetpts=PTS-STARTPTS`,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-t",
    String(durationSec),
    "-movflags",
    "+faststart",
    "wc_output.mp4",
  ]);

  const data = await ffmpeg.readFile("wc_output.mp4");
  await ffmpeg.deleteFile("wc_video.mp4").catch(() => {});
  await ffmpeg.deleteFile("wc_audio_src").catch(() => {});
  await ffmpeg.deleteFile("wc_output.mp4").catch(() => {});

  if (!data || (data instanceof Uint8Array && data.byteLength < 256)) {
    throw new Error("音声結合の結果が空です");
  }
  return blobFromFfmpegFile(data);
}

async function deliverExportedVideo(
  blob: Blob,
  downloadName: string,
  options: ExportOptions,
  setProgressValue: (n: number) => void,
  patch: (partial: {
    phase?: ExportPhase;
    encodeSubphase?: ExportEncodeSubphase | null;
    phaseLabel?: string;
    progressMessage?: string;
  }) => void
): Promise<boolean> {
  patch({
    phase: "saving",
    encodeSubphase: null,
    phaseLabel: VIDEO_EXPORT_PHASE_LABELS.save,
    progressMessage: "共有シートを開いています…",
  });
  setProgressValue(mapVideoExportPhaseProgress("save", 0.1));
  await sleep(0);

  if (options.shareAfter) {
    setProgressValue(mapVideoExportPhaseProgress("save", 0.35));
    const shared = await shareVideoFile(
      blob,
      downloadName,
      videoExportDisplayTitle(options.fileName)
    );
    if (shared) {
      setProgressValue(mapVideoExportPhaseProgress("save", 0.95));
      return true;
    }
    patch({ progressMessage: "ダウンロードで保存しています…" });
    setProgressValue(mapVideoExportPhaseProgress("save", 0.7));
    downloadVideoBlob(blob, downloadName);
    return false;
  }

  patch({ progressMessage: "ファイルを保存しています…" });
  setProgressValue(mapVideoExportPhaseProgress("save", 0.6));
  downloadVideoBlob(blob, downloadName);
  return false;
}

type ExportStoreActions = {
  setProgressValue: (n: number) => void;
  patch: (partial: {
    isExporting?: boolean;
    phase?: ExportPhase;
    encodeSubphase?: ExportEncodeSubphase | null;
    phaseLabel?: string;
    progressMessage?: string;
    qualityHint?: string;
  }) => void;
  resetRun: () => void;
};

/**
 * L: MediaRecorder が MP4 を直接出せる環境向けのリアルタイム録画経路。
 * 成功時は VideoExportResult、使えないときは null（FFmpeg 経路へフォールバック）。
 */
async function tryDirectMp4Export(
  options: ExportOptions,
  quality: VideoExportQualityPreset,
  mimeType: string,
  store: ExportStoreActions
): Promise<VideoExportResult | null> {
  const { setProgressValue, patch, resetRun } = store;
  const canvas = options.canvasRef.current ?? document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    videoExportCancelRef.current = false;
    patch({
      isExporting: true,
      phase: "recording",
      encodeSubphase: null,
      phaseLabel: VIDEO_EXPORT_PHASE_LABELS.capture,
      progressMessage: "音源に合わせて録画中…（曲の長さだけかかります）",
      qualityHint: `${formatVideoExportQualitySpec(quality)} · MP4 直接出力`,
    });
    setProgressValue(0);

    const { blob, hasAudio } = await recordDirectMp4({
      canvas,
      ctx,
      mimeType,
      quality,
      durationSec: options.durationSec,
      audioStartSec: options.audioStartSec ?? 0,
      formations: options.formations,
      stageAppearance: options.stageAppearance,
      onProgress: (ratio) => {
        // 録画（0〜90%）→ 保存（90〜100%）
        setProgressValue(Math.min(90, ratio * 90));
      },
      onAudioMissing: () => {
        patch({ progressMessage: "音源なしで録画中…" });
        options.onAudioSkipped?.();
      },
      isCancelled: () => videoExportCancelRef.current,
    });

    if (videoExportCancelRef.current) {
      resetRun();
      throw new DOMException("Export aborted", "AbortError");
    }

    const downloadName = `${safeVideoBaseName(options.fileName)}.mp4`;
    const shared = await deliverExportedVideo(
      blob,
      downloadName,
      options,
      setProgressValue,
      patch
    );

    patch({
      phase: "done",
      encodeSubphase: null,
      phaseLabel: "完了",
      progressMessage: shared
        ? "共有シートを開きました"
        : hasAudio
          ? "保存しました"
          : "音源なしで保存しました",
    });
    setProgressValue(100);
    setTimeout(() => resetRun(), 1200);

    return {
      downloadName,
      shared,
      format: "mp4",
      size: blob.size,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    // 録画中にバックグラウンド化した場合は、無言でやり直さず明確に中断
    if (error instanceof ExportBackgroundedError) {
      resetRun();
      throw error;
    }
    // その他の失敗時は FFmpeg 経路へフォールバック
    console.warn("[tryDirectMp4Export] falling back to FFmpeg path:", error);
    return null;
  }
}

/**
 * P: WebCodecs による MP4 書き出し（本命・最速経路）。
 * tight-loop でエンコードするため曲尺より大幅に速い。FFmpeg.wasm も不要。
 * 非対応・失敗時は null（直接録画 / FFmpeg 経路へフォールバック）。
 */
async function tryWebCodecsExport(
  options: ExportOptions,
  quality: VideoExportQualityPreset,
  store: ExportStoreActions
): Promise<VideoExportResult | null> {
  const { setProgressValue, patch, resetRun } = store;

  const needAudio =
    Boolean(options.audioUrl) || Boolean(options.audioFallback);
  let support;
  try {
    support = await checkWebCodecsMp4Support(quality, needAudio);
  } catch (e) {
    console.warn("[tryWebCodecsExport] support check failed:", e);
    return null;
  }
  if (!support.supported || !support.videoCodec) {
    return null;
  }

  const canvas = options.canvasRef.current ?? document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // mux-later では映像エンコード後に FFmpeg で音声結合するため進捗上限を下げる
  const needsMuxLater = support.audioMode === "mux-later";
  const encodeCeil = needsMuxLater ? 65 : 90;

  try {
    videoExportCancelRef.current = false;
    patch({
      isExporting: true,
      phase: "recording",
      encodeSubphase: null,
      phaseLabel: VIDEO_EXPORT_PHASE_LABELS.encode,
      progressMessage: "高速エンコード中…",
      qualityHint: `${formatVideoExportQualitySpec(quality)} · WebCodecs 高速出力`,
    });
    setProgressValue(0);

    let { blob, hasAudio } = await exportMp4WithWebCodecs({
      canvas,
      ctx,
      quality,
      videoCodec: support.videoCodec,
      audioMode: support.audioMode,
      durationSec: options.durationSec,
      audioStartSec: options.audioStartSec ?? 0,
      audioUrl: options.audioUrl,
      audioFallback: options.audioFallback,
      formations: options.formations,
      stageAppearance: options.stageAppearance,
      onProgress: (ratio) => {
        setProgressValue(Math.min(encodeCeil, ratio * encodeCeil));
      },
      onAudioMissing: () => {
        patch({ progressMessage: "音源なしでエンコード中…" });
        options.onAudioSkipped?.();
      },
      isCancelled: () => videoExportCancelRef.current,
    });

    if (videoExportCancelRef.current) {
      resetRun();
      throw new DOMException("Export aborted", "AbortError");
    }

    // ── mux-later: 映像は WebCodecs 済み。音声だけ FFmpeg で結合（映像はコピー） ──
    if (needsMuxLater) {
      patch({
        phase: "converting",
        encodeSubphase: "load",
        progressMessage: "音源を結合する準備中…",
      });
      const ffmpeg = await loadFFmpegWasm((p) => {
        setProgressValue(65 + p.ratio * 10);
        patch({ progressMessage: p.message });
        options.onFfmpegFirstLoad?.();
      });
      const stopCreep = startProgressCreep(
        () => videoExportProgressRef.current,
        setProgressValue,
        88
      );
      try {
        const muxed = await muxAudioIntoMp4(
          ffmpeg,
          {
            videoBlob: blob,
            audioUrl: options.audioUrl,
            audioFallback: options.audioFallback,
            audioStartSec: options.audioStartSec ?? 0,
            durationSec: options.durationSec,
          },
          {
            onAudioProgress: (r) => {
              setProgressValue(76 + r * 6);
              patch({ progressMessage: "音源を取得中…" });
            },
            onMuxStart: () => {
              patch({ progressMessage: "音源を結合中…" });
              setProgressValue(83);
            },
            onAudioSkipped: () => {
              patch({ progressMessage: "音源なしで保存します…" });
              options.onAudioSkipped?.();
            },
          }
        );
        if (muxed) {
          blob = muxed;
          hasAudio = true;
        }
      } finally {
        stopCreep();
      }
      setProgressValue(90);
    }

    const downloadName = `${safeVideoBaseName(options.fileName)}.mp4`;
    const shared = await deliverExportedVideo(
      blob,
      downloadName,
      options,
      setProgressValue,
      patch
    );

    patch({
      phase: "done",
      encodeSubphase: null,
      phaseLabel: "完了",
      progressMessage: shared
        ? "共有シートを開きました"
        : hasAudio
          ? "保存しました"
          : "音源なしで保存しました",
    });
    setProgressValue(100);
    setTimeout(() => resetRun(), 1200);

    return {
      downloadName,
      shared,
      format: "mp4",
      size: blob.size,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    // 失敗時は直接録画 / FFmpeg 経路へフォールバック
    console.warn("[tryWebCodecsExport] falling back:", error);
    return null;
  }
}

export function useVideoExport() {
  const isExporting = useVideoExportRunStore((s) => s.isExporting);
  const progress = useVideoExportRunStore((s) => s.progress);
  const progressMessage = useVideoExportRunStore((s) => s.progressMessage);
  const phase = useVideoExportRunStore((s) => s.phase);
  const encodeSubphase = useVideoExportRunStore((s) => s.encodeSubphase);
  const phaseLabel = useVideoExportRunStore((s) => s.phaseLabel);
  const setProgressValue = useVideoExportRunStore((s) => s.setProgressValue);
  const patch = useVideoExportRunStore((s) => s.patch);
  const resetRun = useVideoExportRunStore((s) => s.resetRun);

  const startExport = useCallback(async (
    options: ExportOptions
  ): Promise<VideoExportResult> => {
    const quality = resolveQuality(options);
    let videoStream: MediaStream | null = null;
    let recordedBlob: Blob | null = null;

    // ─── P: WebCodecs 高速書き出し（最速・本命経路） ───
    // tight-loop エンコードのため曲尺より大幅に速く、FFmpeg も不要。
    // 音声も強力なフォールバック連鎖で解決するため、直接録画より優先する。
    const webCodecsResult = await tryWebCodecsExport(options, quality, {
      setProgressValue,
      patch,
      resetRun,
    });
    if (webCodecsResult) return webCodecsResult;

    // ─── L: Safari/iOS の MP4 直接録画（FFmpeg.wasm を迂回） ───
    const directMime = getDirectMp4RecorderMimeType();
    const audioConfigured =
      Boolean(options.audioUrl) ||
      Boolean(
        options.audioFallback &&
          (options.audioFallback.audioAssetId != null ||
            options.audioFallback.audioSupabasePath ||
            options.audioFallback.flowLocalAudioKey)
      );
    // 音源が設定されているのに再生用 URL が未取得なら、音声解決に強い
    // FFmpeg 経路を使う（無音 MP4 を避ける）。
    const directAudioReady =
      !audioConfigured || resolvePlaybackAudioUrlForExport() != null;
    if (directMime && directAudioReady) {
      const directResult = await tryDirectMp4Export(options, quality, directMime, {
        setProgressValue,
        patch,
        resetRun,
      });
      if (directResult) return directResult;
      // 直接録画が使えなかった場合は下の FFmpeg 経路にフォールバック
    }

    try {
      videoExportCancelRef.current = false;
      patch({
        isExporting: true,
        phase: "recording",
        encodeSubphase: null,
        phaseLabel: VIDEO_EXPORT_PHASE_LABELS.capture,
        progressMessage: "ステージを描画中…",
        qualityHint: formatVideoExportQualitySpec(quality),
      });
      setProgressValue(mapVideoExportPhaseProgress("capture", 0));

      const { ctx2d, videoStream: stream, requestFrame } = createExportCanvas(
        options.canvasRef,
        quality
      );
      videoStream = stream;

      const mimeType = getSupportedRecorderMimeType();
      if (!mimeType) {
        throw new Error("このブラウザでは WebM 録画に対応していません");
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordDone = new Promise<void>((resolve, reject) => {
        recorder.onerror = () => reject(new Error("画面の録画に失敗しました"));
        recorder.onstop = () => resolve();
      });

      recorder.start(100);

      const captureFps = quality.captureFps;
      const totalFrames = Math.max(1, Math.ceil(options.durationSec * captureFps));
      const outputFrameCount = Math.max(
        1,
        Math.ceil(options.durationSec * quality.fps)
      );
      const recordStartedAt = performance.now();
      let inputTimescale = 1;
      let formationIndex = 0;

      for (let frame = 0; frame <= totalFrames; frame++) {
        if (videoExportCancelRef.current) {
          recorder.stop();
          await recordDone;
          resetRun();
          throw new DOMException("Export aborted", "AbortError");
        }

        const t = frame / captureFps;
        while (
          formationIndex + 1 < options.formations.length &&
          options.formations[formationIndex + 1].startSec <= t
        ) {
          formationIndex += 1;
        }

        drawStageExportFrame(
          ctx2d,
          quality.width,
          quality.height,
          t,
          options.formations,
          options.stageAppearance,
          formationIndex
        );

        if (requestFrame) {
          requestFrame();
        }

        if (frame % RECORD_YIELD_EVERY === 0 || frame === totalFrames) {
          setProgressValue(
            mapVideoExportPhaseProgress("capture", frame / totalFrames)
          );
          await sleep(0);
        }
      }

      const recordDurationSec = Math.max(
        1 / captureFps,
        (performance.now() - recordStartedAt) / 1000
      );
      inputTimescale = options.durationSec / recordDurationSec;

      recorder.stop();
      await recordDone;

      recordedBlob = new Blob(chunks, {
        type: mimeType.split(";")[0] || "video/webm",
      });
      if (recordedBlob.size < 256) {
        throw new Error(
          "録画データが空です。ページを再読み込みしてからもう一度お試しください。"
        );
      }

      patch({
        phase: "converting",
        encodeSubphase: "load",
        phaseLabel: VIDEO_EXPORT_PHASE_LABELS.encode,
        progressMessage: "FFmpeg を準備中…",
      });
      setProgressValue(mapVideoExportPhaseProgress("encode", 0));
      await sleep(0);

      let notifiedFfmpegLoad = false;
      const encodeLoadCap = mapVideoExportPhaseProgress("encode", 0.25);
      const stopLoadCreep = startProgressCreep(
        () => videoExportProgressRef.current,
        setProgressValue,
        encodeLoadCap
      );
      let ffmpeg: FFmpeg;
      try {
        ffmpeg = await loadFFmpegWasm((p) => {
          setProgressValue(
            mapVideoExportPhaseProgress("encode", p.ratio * 0.25)
          );
          patch({ progressMessage: p.message });
          if (p.ratio < 0.05 && !notifiedFfmpegLoad) {
            options.onFfmpegFirstLoad?.();
            notifiedFfmpegLoad = true;
          }
        });
      } finally {
        stopLoadCreep();
      }

      patch({
        encodeSubphase: "mux",
        progressMessage: "録画データを渡しています…",
      });
      setProgressValue(mapVideoExportPhaseProgress("encode", 0.28));
      await sleep(0);

      const inputName = mimeType.includes("mp4") ? "input.mp4" : "input.webm";
      await ffmpeg.writeFile(inputName, await fetchFile(recordedBlob));
      setProgressValue(mapVideoExportPhaseProgress("encode", 0.32));

      const encodeMuxStart = 0.32;
      const encodeMuxEnd = 0.98;
      const onMuxProgress = ({ progress: muxRatio }: { progress: number }) => {
        if (Number.isFinite(muxRatio) && muxRatio >= 0) {
          setProgressValue(
            mapVideoExportPhaseProgress(
              "encode",
              encodeMuxStart +
                Math.min(1, muxRatio) * (encodeMuxEnd - encodeMuxStart)
            )
          );
        }
      };
      ffmpeg.on("progress", onMuxProgress);
      const stopMuxCreep = startProgressCreep(
        () => videoExportProgressRef.current,
        setProgressValue,
        mapVideoExportPhaseProgress("encode", encodeMuxEnd - 0.02)
      );
      patch({
        progressMessage: options.audioUrl || options.audioFallback
          ? "音源を取得して MP4 に結合中…"
          : "MP4 に変換中…",
      });
      const videoFrameCount = outputFrameCount;
      try {
        await muxRecordedWebmToMp4(
          ffmpeg,
          {
            inputName,
            audioUrl: options.audioUrl,
            audioFallback: options.audioFallback,
            audioStartSec: options.audioStartSec ?? 0,
            durationSec: options.durationSec,
            videoFrameCount,
            quality,
            inputTimescale,
          },
          {
            onAudioProgress: (ratio) => {
              setProgressValue(
                mapVideoExportPhaseProgress(
                  "encode",
                  encodeMuxStart + ratio * 0.08
                )
              );
              patch({ progressMessage: "音源を取得中…" });
            },
            onMuxStart: () => {
              patch({
                progressMessage: "MP4 に結合中…（数十秒かかることがあります）",
              });
              setProgressValue(mapVideoExportPhaseProgress("encode", 0.45));
            },
            onAudioSkipped: () => {
              patch({ progressMessage: "音源なしで MP4 に変換中…" });
              options.onAudioSkipped?.();
            },
          }
        );
      } finally {
        ffmpeg.off("progress", onMuxProgress);
        stopMuxCreep();
      }

      setProgressValue(mapVideoExportPhaseProgress("encode", 1));
      patch({ progressMessage: "ファイルを仕上げています…" });
      const data = await ffmpeg.readFile("output.mp4");
      if (!data || (data instanceof Uint8Array && data.byteLength < 256)) {
        throw new Error("MP4 の生成結果が空です");
      }
      const mp4Blob = blobFromFfmpegFile(data);

      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile("output.mp4").catch(() => {});

      const downloadName = `${safeVideoBaseName(options.fileName)}.mp4`;
      const shared = await deliverExportedVideo(
        mp4Blob,
        downloadName,
        options,
        setProgressValue,
        patch
      );

      patch({
        phase: "done",
        encodeSubphase: null,
        phaseLabel: "完了",
        progressMessage: shared ? "共有シートを開きました" : "保存しました",
      });
      setProgressValue(100);
      setTimeout(() => {
        resetRun();
      }, 1200);

      return {
        downloadName,
        shared,
        format: "mp4",
        size: mp4Blob.size,
      };
    } catch (error) {
      if (
        recordedBlob &&
        recordedBlob.size >= 256 &&
        !(error instanceof DOMException && error.name === "AbortError") &&
        error instanceof Error &&
        /FFmpeg|MP4|タイムアウト|変換|crossOrigin|COEP|COOP/i.test(error.message)
      ) {
        try {
          resetFFmpegWasm();
          patch({
            phase: "saving",
            phaseLabel: VIDEO_EXPORT_PHASE_LABELS.save,
            progressMessage: "MP4 変換に失敗したため WebM で保存しています…",
          });
          setProgressValue(mapVideoExportPhaseProgress("save", 0.2));
          const fallback = await tryWebmFallback(
            recordedBlob,
            options,
            error instanceof Error ? error.message : String(error)
          );
          patch({
            phase: "done",
            encodeSubphase: null,
            phaseLabel: "完了",
            progressMessage: "WebM で保存しました",
          });
          setProgressValue(100);
          setTimeout(() => {
            resetRun();
          }, 1200);
          return fallback;
        } catch (fallbackError) {
          console.error("WebM fallback failed:", fallbackError);
        }
      }

      console.error("Video export failed:", error);
      resetRun();
      throw error;
    } finally {
      videoStream?.getTracks().forEach((t) => t.stop());
      videoExportCancelRef.current = false;
    }
  }, [patch, resetRun, setProgressValue]);

  const cancelExport = useCallback(() => {
    videoExportCancelRef.current = true;
    resetRun();
  }, [resetRun]);

  return {
    isExporting,
    progress,
    progressMessage,
    phase,
    encodeSubphase,
    phaseLabel,
    startExport,
    cancelExport,
  };
}

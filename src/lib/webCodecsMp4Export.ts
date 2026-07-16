import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { drawStageExportFrame, type ExportFormationFrame } from "./drawStageExportFrame";
import type { StageExportAppearance } from "./stageExportAppearance";
import type { VideoExportQualityPreset } from "./videoExportQualityPresets";
import {
  resolveExportAudioBytesForFfmpeg,
  type ExportAudioFallback,
} from "./resolveExportAudioForFfmpeg";
import { fetchAudioForFfmpeg } from "./fetchAudioForFfmpeg";

/**
 * P: WebCodecs による MP4 書き出し（Safari / Chromium 双方の本命経路）。
 *
 * VideoEncoder / AudioEncoder でハードウェア支援エンコードを行い、mp4-muxer で
 * MP4 に多重化する。tight-loop でフレームを流し込むためリアルタイム制約が無く、
 * 曲尺より大幅に速い。FFmpeg.wasm も不要。
 *
 * 非対応環境（VideoEncoder 無し、音声が必要なのに AudioEncoder 非対応 等）は
 * `checkWebCodecsMp4Support` が false を返し、呼び出し側が直接録画 / FFmpeg 経路へ
 * フォールバックする。
 */

type WebkitWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

/** 解像度・レベル順に試す H.264 コーデック文字列（対応する最初のものを採用） */
const AVC_CODEC_CANDIDATES = [
  "avc1.42E01F", // Baseline 3.1（〜1280x720@30）
  "avc1.4D401F", // Main 3.1
  "avc1.640028", // High 4.0
  "avc1.42E01E", // Baseline 3.0（〜720x480）
  "avc1.42001F",
] as const;

const AUDIO_CODEC = "mp4a.40.2"; // AAC-LC
const AUDIO_BITRATE = 128_000;

function hasVideoEncoder(): boolean {
  return (
    typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined"
  );
}

function estimateVideoBitrate(quality: VideoExportQualityPreset): number {
  const pixels = quality.width * quality.height;
  const perPixelPerFrame = 0.08;
  return Math.round(pixels * quality.fps * perPixelPerFrame);
}

function baseVideoConfig(
  quality: VideoExportQualityPreset
): Omit<VideoEncoderConfig, "codec"> {
  return {
    width: quality.width,
    height: quality.height,
    bitrate: estimateVideoBitrate(quality),
    framerate: quality.fps,
    // 実時間制約が無いので画質優先で構わない
    latencyMode: "quality",
  };
}

async function pickSupportedAvcCodec(
  quality: VideoExportQualityPreset
): Promise<string | null> {
  const base = baseVideoConfig(quality);
  for (const codec of AVC_CODEC_CANDIDATES) {
    try {
      const res = await VideoEncoder.isConfigSupported({ ...base, codec });
      if (res.supported) return codec;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function isAacEncodeSupported(
  sampleRate: number,
  channels: number
): Promise<boolean> {
  if (typeof AudioEncoder === "undefined") return false;
  try {
    const res = await AudioEncoder.isConfigSupported({
      codec: AUDIO_CODEC,
      sampleRate,
      numberOfChannels: channels,
      bitrate: AUDIO_BITRATE,
    });
    return Boolean(res.supported);
  } catch {
    return false;
  }
}

/**
 * 音声の取り扱い方針。
 * - `none`: 音声なし（映像のみ）
 * - `encode`: AudioEncoder で AAC まで WebCodecs 内で完結（Safari 26+ / Chromium）
 * - `mux-later`: 映像だけ WebCodecs で出し、音声は後段（FFmpeg）で結合
 *   （AudioEncoder 非対応の Safari 16.4〜18.7 向け。映像はコピーで再エンコード無し）
 */
export type WebCodecsAudioMode = "none" | "encode" | "mux-later";

export type WebCodecsSupport = {
  /** 映像を WebCodecs でエンコードできるか（この経路を使えるか） */
  supported: boolean;
  videoCodec: string | null;
  audioMode: WebCodecsAudioMode;
  reason?: string;
};

/**
 * WebCodecs 経路が使えるか判定する。
 * 映像エンコードさえ使えれば supported=true とし、音声は audioMode で扱いを分ける。
 * これにより AudioEncoder 非対応の Safari でも「映像だけ高速化」を享受できる。
 */
export async function checkWebCodecsMp4Support(
  quality: VideoExportQualityPreset,
  needAudio: boolean
): Promise<WebCodecsSupport> {
  if (typeof window === "undefined" || !hasVideoEncoder()) {
    return {
      supported: false,
      videoCodec: null,
      audioMode: "none",
      reason: "VideoEncoder 非対応",
    };
  }

  const videoCodec = await pickSupportedAvcCodec(quality);
  if (!videoCodec) {
    return {
      supported: false,
      videoCodec: null,
      audioMode: "none",
      reason: "H.264 エンコード非対応",
    };
  }

  // 音声は常に FFmpeg 結合（mux-later）に一本化する。
  // AudioEncoder + mp4-muxer 経路はブラウザ差（Safari の planar/interleaved 差など）で
  // 「音声トラックが空になる＝無音」不具合が起きやすく、端末での検証も難しいため、
  // 実績のある FFmpeg 結合（映像は -c:v copy で無劣化）に寄せて音を確実に入れる。
  const audioMode: WebCodecsAudioMode = needAudio ? "mux-later" : "none";

  return { supported: true, videoCodec, audioMode };
}

function getAudioContextCtor(): typeof AudioContext | null {
  return window.AudioContext ?? (window as WebkitWindow).webkitAudioContext ?? null;
}

/** 音源バイトを取得してデコードする。取得できなければ null。 */
async function decodeExportAudio(
  audioUrl: string | null,
  audioFallback: ExportAudioFallback | undefined,
  onProgress?: (ratio: number) => void
): Promise<AudioBuffer | null> {
  let bytes: Uint8Array | null = null;
  if (audioFallback) {
    bytes = await resolveExportAudioBytesForFfmpeg(audioFallback, onProgress);
  } else if (audioUrl) {
    bytes = await fetchAudioForFfmpeg(audioUrl, onProgress);
  }
  if (!bytes?.byteLength) return null;

  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  const ctx = new Ctor();
  try {
    // decodeAudioData は転送可能な ArrayBuffer を要求するためコピーを渡す
    const copy = bytes.slice().buffer;
    const buffer = await ctx.decodeAudioData(copy);
    return buffer;
  } catch (e) {
    console.warn("[webCodecsMp4Export] audio decode failed:", e);
    return null;
  } finally {
    void ctx.close().catch(() => {});
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function encodeAudioTrack(
  muxer: Muxer<ArrayBufferTarget>,
  audioBuffer: AudioBuffer,
  audioStartSec: number,
  durationSec: number,
  onProgress?: (ratio: number) => void
): Promise<void> {
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;

  let encoderError: Error | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => {
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({
    codec: AUDIO_CODEC,
    sampleRate,
    numberOfChannels: channels,
    bitrate: AUDIO_BITRATE,
  });

  const totalSamples = audioBuffer.length;
  const startSample = Math.max(
    0,
    Math.min(totalSamples, Math.floor(audioStartSec * sampleRate))
  );
  const endSample = Math.max(
    startSample,
    Math.min(totalSamples, startSample + Math.ceil(durationSec * sampleRate))
  );

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }

  const BLOCK = 4096;
  const span = Math.max(1, endSample - startSample);
  let pos = startSample;
  while (pos < endSample) {
    if (encoderError) throw encoderError;
    const frames = Math.min(BLOCK, endSample - pos);
    // f32-planar: [ch0 の frames サンプル…, ch1 の frames サンプル…]
    const planar = new Float32Array(frames * channels);
    for (let ch = 0; ch < channels; ch++) {
      planar.set(channelData[ch].subarray(pos, pos + frames), ch * frames);
    }
    const timestamp = Math.round(((pos - startSample) / sampleRate) * 1_000_000);
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels,
      timestamp,
      data: planar,
    });
    encoder.encode(audioData);
    audioData.close();
    pos += frames;
    onProgress?.((pos - startSample) / span);
    if (encoder.encodeQueueSize > 16) await sleep(0);
  }

  await encoder.flush();
  encoder.close();
  if (encoderError) throw encoderError;
}

export type WebCodecsExportParams = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  quality: VideoExportQualityPreset;
  videoCodec: string;
  /** 音声の取り扱い（none / encode / mux-later） */
  audioMode: WebCodecsAudioMode;
  durationSec: number;
  audioStartSec: number;
  audioUrl: string | null;
  audioFallback?: ExportAudioFallback;
  formations: ExportFormationFrame[];
  stageAppearance: StageExportAppearance;
  /** 全体進捗 0〜1（音声取得〜多重化まで） */
  onProgress: (ratio: number) => void;
  onAudioMissing?: () => void;
  isCancelled: () => boolean;
};

export type WebCodecsExportResult = {
  blob: Blob;
  /** この blob 単体に音声が含まれているか */
  hasAudio: boolean;
  /** true の場合、映像のみ。呼び出し側で音声結合が必要（mux-later） */
  needsAudioMux: boolean;
};

const MAX_VIDEO_QUEUE = 8;

/**
 * WebCodecs で MP4 を書き出す。tight-loop のため曲尺より大幅に速い。
 * 音声が必要なのにデコードできない場合は onAudioMissing を呼び無音で続行する。
 */
export async function exportMp4WithWebCodecs(
  params: WebCodecsExportParams
): Promise<WebCodecsExportResult> {
  const {
    canvas,
    ctx,
    quality,
    videoCodec,
    audioMode,
    durationSec,
    audioStartSec,
    audioUrl,
    audioFallback,
    formations,
    stageAppearance,
    onProgress,
    onAudioMissing,
    isCancelled,
  } = params;

  canvas.width = quality.width;
  canvas.height = quality.height;

  // ── 1. 音源をデコード（audioMode==="encode" のときだけ WebCodecs 内で扱う） ──
  // mux-later の場合は後段の FFmpeg が音声を担うため、ここでは触らない。
  let audioBuffer: AudioBuffer | null = null;
  if (audioMode === "encode") {
    audioBuffer = await decodeExportAudio(audioUrl, audioFallback, (r) =>
      onProgress(Math.min(0.08, r * 0.08))
    );
    // デコードできても実サンプルレートで AAC が使えなければ無音扱い
    if (audioBuffer) {
      const ok = await isAacEncodeSupported(
        audioBuffer.sampleRate,
        audioBuffer.numberOfChannels
      );
      if (!ok) audioBuffer = null;
    }
    if (!audioBuffer) onAudioMissing?.();
  }
  onProgress(0.08);

  if (isCancelled()) throw new DOMException("Export aborted", "AbortError");

  // ── 2. Muxer と VideoEncoder を用意 ──
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width: quality.width,
      height: quality.height,
      frameRate: quality.fps,
    },
    ...(audioBuffer
      ? {
          audio: {
            codec: "aac" as const,
            numberOfChannels: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate,
          },
        }
      : {}),
    fastStart: "in-memory" as const,
  });

  let videoEncoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      videoEncoderError = e instanceof Error ? e : new Error(String(e));
    },
  });
  videoEncoder.configure({
    ...baseVideoConfig(quality),
    codec: videoCodec,
  });

  const fps = quality.fps;
  const totalFrames = Math.max(1, Math.ceil(durationSec * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);
  const keyFrameInterval = Math.max(1, fps * 2);

  const videoStart = 0.08;
  const videoEnd = audioBuffer ? 0.9 : 0.97;

  try {
    let formationIndex = 0;
    for (let frame = 0; frame < totalFrames; frame++) {
      if (isCancelled()) {
        throw new DOMException("Export aborted", "AbortError");
      }
      if (videoEncoderError) throw videoEncoderError;

      const t = frame / fps;
      while (
        formationIndex + 1 < formations.length &&
        formations[formationIndex + 1].startSec <= t
      ) {
        formationIndex += 1;
      }

      drawStageExportFrame(
        ctx,
        quality.width,
        quality.height,
        t,
        formations,
        stageAppearance,
        formationIndex
      );

      const videoFrame = new VideoFrame(canvas, {
        timestamp: Math.round(frame * frameDurationUs),
        duration: frameDurationUs,
      });
      videoEncoder.encode(videoFrame, {
        keyFrame: frame % keyFrameInterval === 0,
      });
      videoFrame.close();

      if (frame % 8 === 0 || frame === totalFrames - 1) {
        onProgress(
          videoStart + ((frame + 1) / totalFrames) * (videoEnd - videoStart)
        );
      }

      // バックプレッシャ: エンコードキューが溜まりすぎたら少し待つ
      while (
        videoEncoder.encodeQueueSize > MAX_VIDEO_QUEUE &&
        !videoEncoderError
      ) {
        if (isCancelled()) {
          throw new DOMException("Export aborted", "AbortError");
        }
        await sleep(2);
      }
    }

    await videoEncoder.flush();
    if (videoEncoderError) throw videoEncoderError;
    onProgress(videoEnd);

    // ── 3. 音声エンコード ──
    if (audioBuffer) {
      await encodeAudioTrack(
        muxer,
        audioBuffer,
        audioStartSec,
        durationSec,
        (r) => onProgress(0.9 + Math.min(1, r) * 0.08)
      );
      onProgress(0.98);
    }

    // ── 4. 多重化を確定 ──
    muxer.finalize();
    onProgress(0.99);

    const buffer = muxer.target.buffer;
    const blob = new Blob([buffer], { type: "video/mp4" });
    if (blob.size < 256) {
      throw new Error("MP4 の生成結果が空です");
    }
    return {
      blob,
      hasAudio: Boolean(audioBuffer),
      needsAudioMux: audioMode === "mux-later",
    };
  } finally {
    try {
      if (videoEncoder.state !== "closed") videoEncoder.close();
    } catch {
      /* ignore */
    }
  }
}

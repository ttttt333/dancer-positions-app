import { useRef, useState, useCallback, type RefObject } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  downloadVideoBlob,
  safeVideoBaseName,
  shareVideoFile,
} from "../lib/shareVideoFile";
import {
  checkVideoExportCapabilities,
  getSupportedRecorderMimeType,
  type VideoExportCaptureMode,
} from "../lib/videoExportCapabilities";
import { captureStageRootToExportCanvas } from "../lib/captureStageVideoFrame";

export type { VideoExportCapabilityCheck } from "../lib/videoExportCapabilities";
export { checkVideoExportCapabilities };

export type ExportPhase = "recording" | "converting" | "done" | null;

export type ExportOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  audioUrl: string | null;
  durationSec: number;
  fileName: string;
  formations: Array<{
    id: string;
    name: string;
    startSec: number;
    dancers: Array<{
      id: string;
      name: string;
      color: string;
      x: number;
      y: number;
    }>;
  }>;
  /** トリム開始秒（音源の再生オフセット） */
  audioStartSec?: number;
  /** true のとき保存の代わりに共有シートを開く */
  shareAfter?: boolean;
  /** FFmpeg.wasm 初回ロード開始時（1 セッション 1 回） */
  onFfmpegFirstLoad?: () => void;
  /** 書き出し前（全画面ステージ CSS 等） */
  prepareDomCapture?: () => void | Promise<void>;
  /** 書き出し後の後片付け */
  cleanupDomCapture?: () => void;
  /** 各フレームの絶対秒でステージ表示を更新してから DOM キャプチャ */
  renderFrameAtTime?: (tAbsSec: number) => void | Promise<void>;
};

function clampExportProgress(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

const EXPORT_WIDTH = 1280;
const EXPORT_HEIGHT = 720;
const EXPORT_FPS = 30;

let ffmpegWasmReady = false;

/** 実機テスト・デバッグ用 */
export function isFfmpegWasmReady(): boolean {
  return ffmpegWasmReady;
}

type RecordingSurface = {
  ctx2d: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  captureStream: (frameRate: number) => MediaStream;
  mode: VideoExportCaptureMode;
};

function createRecordingSurface(
  canvasRef: RefObject<HTMLCanvasElement | null>
): RecordingSurface {
  const caps = checkVideoExportCapabilities();
  if (!caps.supported || !caps.captureMode) {
    throw new Error(
      caps.blockReason ?? "このブラウザでは動画エクスポートに対応していません"
    );
  }

  if (caps.captureMode === "offscreen") {
    const offscreen = new OffscreenCanvas(EXPORT_WIDTH, EXPORT_HEIGHT);
    const ctx2d = offscreen.getContext("2d");
    if (!ctx2d) {
      throw new Error("Canvas 2D context を取得できません");
    }
    const captureStream = (
      offscreen as OffscreenCanvas & {
        captureStream: (frameRate?: number) => MediaStream;
      }
    ).captureStream.bind(offscreen);
    return { ctx2d, captureStream, mode: "offscreen" };
  }

  const canvas = canvasRef.current ?? document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) {
    throw new Error("Canvas 2D context を取得できません");
  }
  if (typeof canvas.captureStream !== "function") {
    throw new Error(
      "HTMLCanvasElement.captureStream が利用できません（iOS 17+ が必要な場合があります）"
    );
  }
  return {
    ctx2d,
    captureStream: (frameRate) => canvas.captureStream(frameRate),
    mode: "html-canvas",
  };
}

function drawExportFrame(
  ctx2d: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  t: number,
  formations: ExportOptions["formations"]
) {
  ctx2d.fillStyle = "#0f0f1a";
  ctx2d.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  const formation =
    [...formations].reverse().find((f) => f.startSec <= t) ??
    formations[0];

  if (formation) {
    formation.dancers.forEach((dancer) => {
      const x = dancer.x * EXPORT_WIDTH;
      const y = dancer.y * EXPORT_HEIGHT;

      ctx2d.beginPath();
      ctx2d.arc(x, y, 24, 0, Math.PI * 2);
      ctx2d.fillStyle = dancer.color;
      ctx2d.fill();

      ctx2d.fillStyle = "#ffffff";
      ctx2d.font = "bold 14px sans-serif";
      ctx2d.textAlign = "center";
      ctx2d.textBaseline = "middle";
      ctx2d.fillText(dancer.name.slice(0, 2), x, y);

      ctx2d.fillStyle = "rgba(255,255,255,0.7)";
      ctx2d.font = "12px sans-serif";
      ctx2d.fillText(dancer.name, x, y + 34);
    });

    ctx2d.fillStyle = "rgba(255,255,255,0.5)";
    ctx2d.font = "18px sans-serif";
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "bottom";
    ctx2d.fillText(formation.name, EXPORT_WIDTH / 2, EXPORT_HEIGHT - 20);
  }

  ctx2d.globalAlpha = 0.3;
  ctx2d.fillStyle = "#ffffff";
  ctx2d.font = "14px sans-serif";
  ctx2d.textAlign = "right";
  ctx2d.textBaseline = "bottom";
  ctx2d.fillText("CHOREOCORE", EXPORT_WIDTH - 10, EXPORT_HEIGHT - 10);
  ctx2d.globalAlpha = 1.0;
}

function blobFromFfmpegFile(data: Uint8Array | string): Blob {
  if (typeof data === "string") {
    return new Blob([data], { type: "video/mp4" });
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy], { type: "video/mp4" });
}

export function useVideoExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<ExportPhase>(null);
  const cancelRef = useRef(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const startExport = useCallback(async (
    options: ExportOptions
  ): Promise<{ downloadName: string; shared: boolean }> => {
    let audioCtx: AudioContext | null = null;
    let audioSource: AudioBufferSourceNode | null = null;

    try {
      cancelRef.current = false;
      setIsExporting(true);
      setPhase("recording");
      setProgress(0);

      const { ctx2d, captureStream } = createRecordingSurface(
        options.canvasRef
      );

      const useDomCapture = Boolean(options.renderFrameAtTime);
      let domCaptureActive = useDomCapture;
      if (options.prepareDomCapture) {
        await options.prepareDomCapture();
      }

      let dest: MediaStreamAudioDestinationNode | null = null;

      if (options.audioUrl) {
        audioCtx = new AudioContext();
        const res = await fetch(options.audioUrl);
        if (!res.ok) {
          throw new Error("音源の取得に失敗しました");
        }
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        dest = audioCtx.createMediaStreamDestination();
        audioSource = audioCtx.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(dest);
      }

      const mimeType = getSupportedRecorderMimeType();
      if (!mimeType) {
        throw new Error("このブラウザでは WebM 録画に対応していません");
      }

      const canvasStream = captureStream(EXPORT_FPS);
      const tracks =
        options.audioUrl && dest
          ? [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]
          : canvasStream.getTracks();
      const mediaStream = new MediaStream(tracks);
      const recorder = new MediaRecorder(mediaStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordDone = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start(100);
      if (audioSource) {
        const offset = options.audioStartSec ?? 0;
        audioSource.start(0, offset, options.durationSec);
      }

      const fps = EXPORT_FPS;
      const totalFrames = Math.max(1, Math.ceil(options.durationSec * fps));
      let frame = 0;
      const recordStartedAt = performance.now();

      await new Promise<void>((resolve) => {
        const drawFrame = async () => {
          if (cancelRef.current) {
            try {
              audioSource?.stop();
            } catch {
              /* already stopped */
            }
            recorder.stop();
            resolve();
            return;
          }

          const tRel = frame / fps;
          const tAbs = (options.audioStartSec ?? 0) + tRel;

          if (domCaptureActive && options.renderFrameAtTime) {
            try {
              await options.renderFrameAtTime(tAbs);
              const ok = await captureStageRootToExportCanvas(
                ctx2d,
                EXPORT_WIDTH,
                EXPORT_HEIGHT
              );
              if (!ok) domCaptureActive = false;
            } catch (err) {
              console.warn("Stage DOM capture failed, falling back:", err);
              domCaptureActive = false;
            }
          }
          if (!domCaptureActive) {
            drawExportFrame(ctx2d, tRel, options.formations);
          }

          const recordProgress = clampExportProgress(
            (frame / totalFrames) * 70
          );
          setProgress(recordProgress);

          frame++;
          if (frame <= totalFrames) {
            const targetWallSec = frame / fps;
            const elapsedSec = (performance.now() - recordStartedAt) / 1000;
            const delayMs = Math.max(0, (targetWallSec - elapsedSec) * 1000);
            window.setTimeout(() => {
              void drawFrame();
            }, delayMs);
          } else {
            recorder.stop();
            resolve();
          }
        };
        void drawFrame();
      });

      await recordDone;

      if (cancelRef.current) {
        throw new DOMException("Export aborted", "AbortError");
      }

      if (chunks.length === 0) {
        throw new Error("録画データがありません");
      }

      setPhase("converting");
      setProgress(71);

      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }
      const ffmpeg = ffmpegRef.current;
      ffmpeg.on("progress", ({ progress: p }) => {
        const t = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
        setProgress(clampExportProgress(72 + t * 27));
      });

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      try {
        if (!ffmpegWasmReady) {
          options.onFfmpegFirstLoad?.();
        }
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript"
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm"
          ),
        });
      } catch {
        throw new Error(
          "FFmpeg の読み込みに失敗しました。ページを再読み込みするか、別のブラウザでお試しください"
        );
      }
      ffmpegWasmReady = true;
      setProgress(72);

      const inputExt = mimeType.includes("mp4") ? "mp4" : "webm";
      const inputName = `input.${inputExt}`;
      const recordedBlob = new Blob(chunks, {
        type: mimeType.split(";")[0] || "video/webm",
      });
      await ffmpeg.writeFile(inputName, await fetchFile(recordedBlob));
      await ffmpeg.exec([
        "-i",
        inputName,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        "output.mp4",
      ]);
      const data = await ffmpeg.readFile("output.mp4");
      const mp4Blob = blobFromFfmpegFile(data);

      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile("output.mp4").catch(() => {});

      const downloadName = `${safeVideoBaseName(options.fileName)}.mp4`;
      let shared = false;
      if (options.shareAfter) {
        shared = await shareVideoFile(mp4Blob, downloadName, options.fileName);
        if (!shared) {
          downloadVideoBlob(mp4Blob, downloadName);
        }
      } else {
        downloadVideoBlob(mp4Blob, downloadName);
      }

      setPhase("done");
      setProgress(100);
      setTimeout(() => {
        setIsExporting(false);
        setPhase(null);
        setProgress(0);
      }, 2000);

      return { downloadName, shared };
    } catch (error) {
      console.error(error);
      setIsExporting(false);
      setPhase(null);
      setProgress(0);
      throw error;
    } finally {
      try {
        audioSource?.stop();
      } catch {
        /* noop */
      }
      if (audioCtx && audioCtx.state !== "closed") {
        await audioCtx.close().catch(() => {});
      }
      options.cleanupDomCapture?.();
    }
  }, []);

  const cancelExport = useCallback(() => {
    cancelRef.current = true;
    setIsExporting(false);
    setProgress(0);
    setPhase(null);
  }, []);

  return { isExporting, progress, phase, startExport, cancelExport };
}

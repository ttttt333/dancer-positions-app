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
} from "../lib/videoExportCapabilities";
import { drawStageExportFrame } from "../lib/drawStageExportFrame";
import type { StageExportAppearance } from "../lib/stageExportAppearance";

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
  stageAppearance: StageExportAppearance;
  /** トリム開始秒（音源の再生オフセット） */
  audioStartSec?: number;
  /** true のとき保存の代わりに共有シートを開く */
  shareAfter?: boolean;
  onFfmpegFirstLoad?: () => void;
};

function clampExportProgress(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** 速さ優先: 12fps・960×540 */
const EXPORT_WIDTH = 960;
const EXPORT_HEIGHT = 540;
const EXPORT_FPS = 12;

let ffmpegWasmReady = false;

export function isFfmpegWasmReady(): boolean {
  return ffmpegWasmReady;
}

type RecordingSurface = {
  ctx2d: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  videoStream: MediaStream;
  requestFrame: (() => void) | null;
};

function requestFrameFromStream(stream: MediaStream): (() => void) | null {
  const track = stream.getVideoTracks()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  return track?.requestFrame?.bind(track) ?? null;
}

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
    const videoStream = (
      offscreen as OffscreenCanvas & {
        captureStream: (frameRate?: number) => MediaStream;
      }
    ).captureStream(0);
    return {
      ctx2d,
      videoStream,
      requestFrame: requestFrameFromStream(videoStream),
    };
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
  const videoStream = canvas.captureStream(0);
  return {
    ctx2d,
    videoStream,
    requestFrame: requestFrameFromStream(videoStream),
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

function startEncodeProgressTicker(
  onTick: (pct: number) => void
): () => void {
  let pct = 72;
  onTick(pct);
  const id = window.setInterval(() => {
    pct = Math.min(98, pct + 1);
    onTick(pct);
  }, 400);
  return () => window.clearInterval(id);
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
    try {
      cancelRef.current = false;
      setIsExporting(true);
      setPhase("recording");
      setProgress(0);

      const { ctx2d, videoStream, requestFrame } = createRecordingSurface(
        options.canvasRef
      );

      const mimeType = getSupportedRecorderMimeType();
      if (!mimeType) {
        throw new Error("このブラウザでは WebM 録画に対応していません");
      }

      const recorder = new MediaRecorder(videoStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordDone = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start(100);

      const fps = EXPORT_FPS;
      const totalFrames = Math.max(1, Math.ceil(options.durationSec * fps));

      for (let frame = 0; frame <= totalFrames; frame++) {
        if (cancelRef.current) {
          recorder.stop();
          await recordDone;
          throw new DOMException("Export aborted", "AbortError");
        }

        const tRel = frame / fps;
        drawStageExportFrame(
          ctx2d,
          EXPORT_WIDTH,
          EXPORT_HEIGHT,
          tRel,
          options.formations,
          options.stageAppearance
        );
        requestFrame?.();

        setProgress(clampExportProgress((frame / totalFrames) * 70));
      }

      recorder.stop();
      await recordDone;

      if (chunks.length === 0) {
        throw new Error("録画データがありません");
      }

      setPhase("converting");
      setProgress(71);

      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }
      const ffmpeg = ffmpegRef.current;

      const stopProgressTicker = startEncodeProgressTicker((pct) => {
        setProgress(pct);
      });

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

      const inputExt = mimeType.includes("mp4") ? "mp4" : "webm";
      const inputName = `input.${inputExt}`;
      const recordedBlob = new Blob(chunks, {
        type: mimeType.split(";")[0] || "video/webm",
      });
      await ffmpeg.writeFile(inputName, await fetchFile(recordedBlob));

      const audioStart = options.audioStartSec ?? 0;
      const duration = String(options.durationSec);

      if (options.audioUrl) {
        await ffmpeg.writeFile("audio_src", await fetchFile(options.audioUrl));
        await ffmpeg.exec([
          "-r",
          String(EXPORT_FPS),
          "-i",
          inputName,
          "-ss",
          String(audioStart),
          "-i",
          "audio_src",
          "-t",
          duration,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "28",
          "-c:a",
          "aac",
          "-b:a",
          "96k",
          "-movflags",
          "+faststart",
          "output.mp4",
        ]);
        await ffmpeg.deleteFile("audio_src").catch(() => {});
      } else {
        await ffmpeg.exec([
          "-r",
          String(EXPORT_FPS),
          "-i",
          inputName,
          "-t",
          duration,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "28",
          "-an",
          "-movflags",
          "+faststart",
          "output.mp4",
        ]);
      }

      stopProgressTicker();
      setProgress(99);

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
      }, 1500);

      return { downloadName, shared };
    } catch (error) {
      console.error(error);
      setIsExporting(false);
      setPhase(null);
      setProgress(0);
      throw error;
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

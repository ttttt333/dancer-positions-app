import { useRef, useState, useCallback, type RefObject } from "react";
import { fetchFile } from "@ffmpeg/util";
import {
  downloadVideoBlob,
  safeVideoBaseName,
  shareVideoFile,
} from "../lib/shareVideoFile";
import { loadFFmpegWasm } from "../lib/ffmpegWasm";
import {
  checkVideoExportCapabilities,
  getSupportedRecorderMimeType,
} from "../lib/videoExportCapabilities";
import { drawStageExportFrame } from "../lib/drawStageExportFrame";
import type { StageExportAppearance } from "../lib/stageExportAppearance";

export type { VideoExportCapabilityCheck } from "../lib/videoExportCapabilities";
export { checkVideoExportCapabilities };

export type ExportPhase = "recording" | "converting" | "done" | null;
export type ExportEncodeSubphase = "load" | "mux" | null;

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
  audioStartSec?: number;
  shareAfter?: boolean;
  onFfmpegFirstLoad?: () => void;
};

function clampExportProgress(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

const EXPORT_WIDTH = 960;
const EXPORT_HEIGHT = 540;
const EXPORT_FPS = 12;
const FRAME_MS = Math.ceil(1000 / EXPORT_FPS);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function blobFromFfmpegFile(data: Uint8Array | string): Blob {
  if (typeof data === "string") {
    return new Blob([data], { type: "video/mp4" });
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy], { type: "video/mp4" });
}

/** 書き出しは HTML canvas 固定（requestFrame / 録画の互換性） */
function createExportCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>
): {
  canvas: HTMLCanvasElement;
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
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) {
    throw new Error("Canvas 2D context を取得できません");
  }
  if (typeof canvas.captureStream !== "function") {
    throw new Error(
      "このブラウザでは動画キャプチャに対応していません（iOS 17+ が必要な場合があります）"
    );
  }

  const probe = canvas.captureStream(0);
  const track = probe.getVideoTracks()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  const requestFrame = track?.requestFrame?.bind(track) ?? null;
  probe.getTracks().forEach((t) => t.stop());

  const videoStream = requestFrame
    ? canvas.captureStream(0)
    : canvas.captureStream(EXPORT_FPS);

  return { canvas, ctx2d, videoStream, requestFrame };
}

export function useVideoExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<ExportPhase>(null);
  const [encodeSubphase, setEncodeSubphase] = useState<ExportEncodeSubphase>(null);
  const cancelRef = useRef(false);

  const startExport = useCallback(async (
    options: ExportOptions
  ): Promise<{ downloadName: string; shared: boolean }> => {
    try {
      cancelRef.current = false;
      setIsExporting(true);
      setPhase("recording");
      setEncodeSubphase(null);
      setProgress(0);

      const { ctx2d, videoStream, requestFrame } = createExportCanvas(
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
      const usePacedFrames = requestFrame == null;

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

        if (requestFrame) {
          requestFrame();
        } else if (usePacedFrames) {
          await sleep(FRAME_MS);
        }

        if (frame % 2 === 0 || frame === totalFrames) {
          setProgress(clampExportProgress((frame / totalFrames) * 68));
          await sleep(0);
        }
      }

      recorder.stop();
      await recordDone;

      if (chunks.length === 0) {
        throw new Error("録画データがありません");
      }

      setPhase("converting");
      setEncodeSubphase("load");
      setProgress(70);
      await sleep(0);

      let notifiedFfmpegLoad = false;
      const ffmpeg = await loadFFmpegWasm((p) => {
        setProgress(clampExportProgress(70 + p.ratio * 10));
        if (p.ratio < 0.05 && !notifiedFfmpegLoad) {
          options.onFfmpegFirstLoad?.();
          notifiedFfmpegLoad = true;
        }
      });

      setEncodeSubphase("mux");
      setProgress(82);
      await sleep(0);

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
      }

      setProgress(88);
      await sleep(0);

      const muxWithAudio = options.audioUrl
        ? [
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
          ]
        : [
            "-r",
            String(EXPORT_FPS),
            "-i",
            inputName,
            "-t",
            duration,
            "-map",
            "0:v:0",
          ];

      const tailAudio = options.audioUrl
        ? ["-c:a", "aac", "-b:a", "96k"]
        : ["-an"];

      try {
        await ffmpeg.exec([
          ...muxWithAudio,
          "-c:v",
          "copy",
          ...tailAudio,
          "-movflags",
          "+faststart",
          "output.mp4",
        ]);
      } catch {
        await ffmpeg.deleteFile("output.mp4").catch(() => {});
        await ffmpeg.exec([
          ...muxWithAudio,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "28",
          ...tailAudio,
          "-movflags",
          "+faststart",
          "output.mp4",
        ]);
      }

      if (options.audioUrl) {
        await ffmpeg.deleteFile("audio_src").catch(() => {});
      }

      setProgress(98);
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
      setEncodeSubphase(null);
      setProgress(100);
      setTimeout(() => {
        setIsExporting(false);
        setPhase(null);
        setProgress(0);
      }, 1200);

      return { downloadName, shared };
    } catch (error) {
      console.error(error);
      setIsExporting(false);
      setPhase(null);
      setEncodeSubphase(null);
      setProgress(0);
      throw error;
    }
  }, []);

  const cancelExport = useCallback(() => {
    cancelRef.current = true;
    setIsExporting(false);
    setProgress(0);
    setPhase(null);
    setEncodeSubphase(null);
  }, []);

  return {
    isExporting,
    progress,
    phase,
    encodeSubphase,
    startExport,
    cancelExport,
  };
}

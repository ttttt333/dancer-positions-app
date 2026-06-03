import { useRef, useState, useCallback, type RefObject } from "react";
import { fetchFile } from "@ffmpeg/util";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  downloadVideoBlob,
  safeVideoBaseName,
  shareVideoFile,
} from "../lib/shareVideoFile";
import { fetchAudioForFfmpeg } from "../lib/fetchAudioForFfmpeg";
import { ffmpegExecChecked, loadFFmpegWasm, resetFFmpegWasm } from "../lib/ffmpegWasm";
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

/** UI スレッドがブロックされても % が動いて見えるよう、上限までゆっくり進める */
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

function downloadRecordedWebm(blob: Blob, baseName: string): string {
  const downloadName = `${safeVideoBaseName(baseName)}.webm`;
  downloadVideoBlob(blob, downloadName);
  return downloadName;
}

async function tryWebmFallback(
  blob: Blob,
  options: ExportOptions
): Promise<{ downloadName: string; shared: boolean; webmFallback: true }> {
  const downloadName = downloadRecordedWebm(blob, options.fileName);
  let shared = false;
  if (options.shareAfter) {
    shared = await shareVideoFile(blob, downloadName, options.fileName);
  }
  return { downloadName, shared, webmFallback: true };
}

function blobFromFfmpegFile(data: Uint8Array | string): Blob {
  if (typeof data === "string") {
    return new Blob([data], { type: "video/mp4" });
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy], { type: "video/mp4" });
}

function createExportCanvas(canvasRef: RefObject<HTMLCanvasElement | null>): {
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
    audioStartSec: number;
    durationSec: number;
  },
  hooks?: {
    onAudioProgress?: (ratio: number) => void;
    onMuxStart?: () => void;
  }
): Promise<void> {
  const { inputName, audioUrl, audioStartSec, durationSec } = params;
  const duration = String(durationSec);

  if (audioUrl) {
    const audioData = await fetchAudioForFfmpeg(audioUrl, hooks?.onAudioProgress);
    await ffmpeg.writeFile("audio_src", audioData);
    hooks?.onMuxStart?.();
    await ffmpegExecChecked(ffmpeg, [
      "-y",
      "-i",
      inputName,
      "-ss",
      String(audioStartSec),
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
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(EXPORT_FPS),
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-shortest",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
    await ffmpeg.deleteFile("audio_src").catch(() => {});
  } else {
    hooks?.onMuxStart?.();
    await ffmpegExecChecked(ffmpeg, [
      "-y",
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
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(EXPORT_FPS),
      "-an",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
  }
}

export function useVideoExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [phase, setPhase] = useState<ExportPhase>(null);
  const [encodeSubphase, setEncodeSubphase] = useState<ExportEncodeSubphase>(null);
  const cancelRef = useRef(false);
  const progressRef = useRef(0);

  const setProgressValue = useCallback((n: number) => {
    const v = clampExportProgress(n);
    progressRef.current = v;
    setProgress(v);
  }, []);

  const startExport = useCallback(async (
    options: ExportOptions
  ): Promise<{ downloadName: string; shared: boolean; webmFallback?: boolean }> => {
    let videoStream: MediaStream | null = null;
    let recordedBlob: Blob | null = null;

    try {
      cancelRef.current = false;
      setIsExporting(true);
      setPhase("recording");
      setEncodeSubphase(null);
      setProgressMessage("ステージを描画中…");
      setProgressValue(0);

      const { ctx2d, videoStream: stream, requestFrame } = createExportCanvas(
        options.canvasRef
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

      const fps = EXPORT_FPS;
      const totalFrames = Math.max(1, Math.ceil(options.durationSec * fps));

      for (let frame = 0; frame <= totalFrames; frame++) {
        if (cancelRef.current) {
          recorder.stop();
          await recordDone;
          throw new DOMException("Export aborted", "AbortError");
        }

        drawStageExportFrame(
          ctx2d,
          EXPORT_WIDTH,
          EXPORT_HEIGHT,
          frame / fps,
          options.formations,
          options.stageAppearance
        );

        if (requestFrame) {
          requestFrame();
        } else {
          await sleep(FRAME_MS);
        }

        if (frame % 2 === 0 || frame === totalFrames) {
          setProgressValue((frame / totalFrames) * 68);
          await sleep(0);
        }
      }

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

      setPhase("converting");
      setEncodeSubphase("load");
      setProgressMessage("FFmpeg を準備中…");
      setProgressValue(69);
      await sleep(0);

      let notifiedFfmpegLoad = false;
      const stopLoadCreep = startProgressCreep(
        () => progressRef.current,
        setProgressValue,
        88
      );
      let ffmpeg: FFmpeg;
      try {
        ffmpeg = await loadFFmpegWasm((p) => {
          setProgressValue(69 + p.ratio * 16);
          setProgressMessage(p.message);
          if (p.ratio < 0.05 && !notifiedFfmpegLoad) {
            options.onFfmpegFirstLoad?.();
            notifiedFfmpegLoad = true;
          }
        });
      } finally {
        stopLoadCreep();
      }

      setEncodeSubphase("mux");
      setProgressMessage("録画データを渡しています…");
      setProgressValue(86);
      await sleep(0);

      const inputName = mimeType.includes("mp4") ? "input.mp4" : "input.webm";
      await ffmpeg.writeFile(inputName, await fetchFile(recordedBlob));
      setProgressValue(85);

      const onMuxProgress = ({ progress: muxRatio }: { progress: number }) => {
        if (Number.isFinite(muxRatio) && muxRatio >= 0) {
          setProgressValue(85 + Math.min(1, muxRatio) * 13);
        }
      };
      ffmpeg.on("progress", onMuxProgress);
      const stopMuxCreep = startProgressCreep(
        () => progressRef.current,
        setProgressValue,
        97
      );
      setProgressMessage(
        options.audioUrl ? "音源を取得して MP4 に結合中…" : "MP4 に変換中…"
      );
      try {
        await muxRecordedWebmToMp4(
          ffmpeg,
          {
            inputName,
            audioUrl: options.audioUrl,
            audioStartSec: options.audioStartSec ?? 0,
            durationSec: options.durationSec,
          },
          {
            onAudioProgress: (ratio) => {
              setProgressValue(85 + ratio * 4);
              setProgressMessage("音源を取得中…");
            },
            onMuxStart: () => {
              setProgressMessage("MP4 に結合中…（数十秒かかることがあります）");
              setProgressValue(89);
            },
          }
        );
      } finally {
        ffmpeg.off("progress", onMuxProgress);
        stopMuxCreep();
      }

      setProgressMessage("ファイルを仕上げています…");
      setProgressValue(99);
      const data = await ffmpeg.readFile("output.mp4");
      if (!data || (data instanceof Uint8Array && data.byteLength < 256)) {
        throw new Error("MP4 の生成結果が空です");
      }
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
      setProgressMessage("完了");
      setProgressValue(100);
      setTimeout(() => {
        setIsExporting(false);
        setPhase(null);
        setProgressValue(0);
        setProgressMessage("");
      }, 1200);

      return { downloadName, shared };
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
          setProgressMessage("MP4 変換に失敗したため WebM で保存しています…");
          setProgressValue(95);
          const fallback = await tryWebmFallback(recordedBlob, options);
          setPhase("done");
          setEncodeSubphase(null);
          setProgressMessage("WebM で保存しました");
          setProgressValue(100);
          setTimeout(() => {
            setIsExporting(false);
            setPhase(null);
            setProgressValue(0);
            setProgressMessage("");
          }, 1200);
          return fallback;
        } catch (fallbackError) {
          console.error("WebM fallback failed:", fallbackError);
        }
      }

      console.error("Video export failed:", error);
      setIsExporting(false);
      setPhase(null);
      setEncodeSubphase(null);
      setProgressValue(0);
      setProgressMessage("");
      throw error;
    } finally {
      videoStream?.getTracks().forEach((t) => t.stop());
    }
  }, [setProgressValue]);

  const cancelExport = useCallback(() => {
    cancelRef.current = true;
    setIsExporting(false);
    setProgressValue(0);
    setProgressMessage("");
    setPhase(null);
    setEncodeSubphase(null);
  }, [setProgressValue]);

  return {
    isExporting,
    progress,
    progressMessage,
    phase,
    encodeSubphase,
    startExport,
    cancelExport,
  };
}

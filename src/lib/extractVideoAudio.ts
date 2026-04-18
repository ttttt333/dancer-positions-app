/**
 * 動画ファイルから音声を ArrayBuffer で返す（§58）。
 *
 * 1) 可能なら decodeAudioData で一発デコード（WebM・一部 MP4 等で数秒以内）
 * 2) 失敗時は FFmpeg.wasm で demux → WAV（MP4 / AVI / MOV / MKV / WMV / FLV 等、
 *    ブラウザが直接扱えないコンテナも再生時間の 1/3〜1/10 程度で抽出）
 * 3) さらに失敗した場合のみ、従来の captureStream + MediaRecorder（実時間）。
 *
 * FFmpeg.wasm 本体は初回利用時に dynamic import し、コア JS / wasm は CDN から
 * 取得後にブラウザ HTTP キャッシュが効く。2 回目以降は即時起動。
 */

const MAX_VIDEO_DURATION_SEC = 7200;
const MAX_FAST_DECODE_BYTES = 220 * 1024 * 1024;
/** 極端に巨大なファイルは wasm メモリを食いつぶすので従来パスへ */
const MAX_WASM_BYTES = 800 * 1024 * 1024;

/** 抽出進捗コールバック。0〜1 の進捗と任意ステージラベル（"decode" / "wasm" / "record"）。 */
export type ExtractProgress = (p: {
  ratio: number;
  stage: "decode" | "wasm" | "record" | "loading";
  message?: string;
}) => void;

function writeAscii(dv: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) {
    dv.setUint8(offset + i, s.charCodeAt(i));
  }
}

/** decodeAudioData 成功後に <audio> / 波形用へ。16bit PCM mono WAV */
function encodeMonoWavFromAudioBuffer(audioBuf: AudioBuffer): ArrayBuffer {
  const sampleRate = audioBuf.sampleRate;
  const n = audioBuf.length;
  const numCh = audioBuf.numberOfChannels;
  const mono = new Float32Array(n);
  for (let c = 0; c < numCh; c++) {
    const d = audioBuf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / numCh;
  }
  const int16 = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, mono[i]!));
    int16[i] = x < 0 ? (x * 0x8000) | 0 : (x * 0x7fff) | 0;
  }
  const dataSize = int16.byteLength;
  const headerSize = 44;
  const out = new ArrayBuffer(headerSize + dataSize);
  const dv = new DataView(out);
  writeAscii(dv, 0, "RIFF");
  dv.setUint32(4, 36 + dataSize, true);
  writeAscii(dv, 8, "WAVE");
  writeAscii(dv, 12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeAscii(dv, 36, "data");
  dv.setUint32(40, dataSize, true);
  new Uint8Array(out, headerSize).set(
    new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength)
  );
  return out;
}

function isRiffWav(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false;
  const u = new Uint8Array(buf, 0, 4);
  return u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46;
}

/**
 * ブラウザがコンテナ全体を音声として decode できる場合のみ成功（WebM 等で高速）。
 * 一般的な MP4 は多くの環境で失敗し、その場合は null。
 */
export async function tryDecodeVideoFileAsAudioBuffer(
  file: File
): Promise<ArrayBuffer | null> {
  if (file.size > MAX_FAST_DECODE_BYTES) return null;
  const ctx = new AudioContext();
  try {
    const raw = await file.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(raw.slice(0));
    return encodeMonoWavFromAudioBuffer(audioBuf);
  } catch {
    return null;
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** 拡張子からおおまかに入力コンテナを推定して ffmpeg に渡す */
function extForFFmpeg(file: File): string {
  const lower = file.name.toLowerCase();
  const m = lower.match(/\.([a-z0-9]+)$/);
  const ext = m?.[1] ?? "";
  /** ffmpeg は拡張子から入力フォーマットを推定するので、安全な代表形に寄せる */
  if (["mp4", "m4v", "mov", "mkv", "webm", "avi", "flv", "wmv", "ogv", "ts", "mts", "3gp"].includes(ext)) {
    return ext;
  }
  return "mp4";
}

type FFmpegInstance = {
  loaded: boolean;
  load(opts: { coreURL: string; wasmURL: string }): Promise<void>;
  on(event: "progress", cb: (p: { progress: number; time: number }) => void): void;
  off(event: "progress", cb: (p: { progress: number; time: number }) => void): void;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  readFile(path: string): Promise<Uint8Array | string>;
  deleteFile(path: string): Promise<void>;
  exec(args: string[]): Promise<number>;
  terminate(): void;
};

let ffmpegSingleton: FFmpegInstance | null = null;
let ffmpegLoadPromise: Promise<FFmpegInstance> | null = null;

/** FFmpeg.wasm コアの CDN 基点（single-thread 版。COEP/COOP 不要） */
const FFMPEG_CORE_CDN =
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

async function loadFFmpeg(onProgress?: ExtractProgress): Promise<FFmpegInstance> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;
  ffmpegLoadPromise = (async () => {
    onProgress?.({ ratio: 0, stage: "loading", message: "FFmpeg を準備中…" });
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);
    const ff = new FFmpeg() as unknown as FFmpegInstance;
    /** Blob URL にしておくことで cross-origin 制約を回避しつつブラウザキャッシュが効く */
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${FFMPEG_CORE_CDN}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${FFMPEG_CORE_CDN}/ffmpeg-core.wasm`, "application/wasm"),
    ]);
    await ff.load({ coreURL, wasmURL });
    ffmpegSingleton = ff;
    onProgress?.({ ratio: 0, stage: "wasm", message: "抽出準備完了" });
    return ff;
  })();
  try {
    return await ffmpegLoadPromise;
  } catch (e) {
    ffmpegLoadPromise = null;
    ffmpegSingleton = null;
    throw e;
  }
}

/** FFmpeg.wasm で動画 → WAV（mono/44.1kHz）を高速抽出 */
async function extractWithFFmpegWasm(
  file: File,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer> {
  if (file.size > MAX_WASM_BYTES) {
    throw new Error(
      "動画が大きすぎます（wasm の制約）。ファイルを分割するか、別形式で再エクスポートしてください。"
    );
  }
  const ff = await loadFFmpeg(onProgress);

  const inExt = extForFFmpeg(file);
  const inName = `input.${inExt}`;
  const outName = "output.wav";

  const onProgressInternal = (p: { progress: number }) => {
    const r = Math.max(0, Math.min(1, p.progress));
    onProgress?.({ ratio: r, stage: "wasm", message: "音声を抽出中…" });
  };
  ff.on("progress", onProgressInternal);

  try {
    onProgress?.({ ratio: 0, stage: "wasm", message: "動画を読み込み中…" });
    const { fetchFile } = await import("@ffmpeg/util");
    const fileData = await fetchFile(file);
    await ff.writeFile(inName, fileData);

    onProgress?.({ ratio: 0.02, stage: "wasm", message: "音声を抽出中…" });
    /**
     * -vn: 映像を無視
     * -ac 1: モノラル化（波形用。デコードも速い）
     * -ar 44100: 44.1kHz（解析・プレビューで十分）
     * -f wav: 入出力ともコンテナを明示
     * -map 0:a:0?: 最初の音声トラックのみ。無い場合は失敗
     */
    const code = await ff.exec([
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inName,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-f",
      "wav",
      "-map",
      "0:a:0?",
      outName,
    ]);
    if (code !== 0) {
      throw new Error(
        "音声の抽出に失敗しました（音声トラックが無い可能性があります）"
      );
    }
    const out = await ff.readFile(outName);
    const data = typeof out === "string" ? new TextEncoder().encode(out) : out;
    /** ArrayBuffer のみを返す（Uint8Array は SAB 由来の場合があるためコピー） */
    const buf = new ArrayBuffer(data.byteLength);
    new Uint8Array(buf).set(data);
    onProgress?.({ ratio: 1, stage: "wasm", message: "抽出完了" });
    return buf;
  } finally {
    ff.off("progress", onProgressInternal);
    /** 大きな入力はメモリを食い続けるので削除 */
    try {
      await ff.deleteFile(inName);
    } catch {
      /* noop */
    }
    try {
      await ff.deleteFile(outName);
    } catch {
      /* noop */
    }
  }
}

/**
 * 最終手段: 従来の captureStream + MediaRecorder（実時間）。
 * wasm 初期化に失敗した環境向けのセーフティネット。
 */
async function extractWithMediaRecorder(
  file: File,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.muted = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("動画の読み込みに失敗しました"));
  });
  const dur = video.duration;
  if (!Number.isFinite(dur) || dur <= 0 || dur > MAX_VIDEO_DURATION_SEC) {
    URL.revokeObjectURL(url);
    throw new Error(
      dur > MAX_VIDEO_DURATION_SEC
        ? "2時間を超える動画は未対応です（ブラウザ負荷のため）"
        : "動画の長さを取得できませんでした"
    );
  }

  const capture =
    (video as HTMLVideoElement & { captureStream?: () => MediaStream })
      .captureStream ??
    (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream })
      .mozCaptureStream;
  if (typeof capture !== "function") {
    URL.revokeObjectURL(url);
    throw new Error("このブラウザでは captureStream に対応していません");
  }

  try {
    await video.play();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("動画の再生を開始できません（ブラウザの自動再生制限など）");
  }
  const stream = capture.call(video);
  const aTracks = stream.getAudioTracks();
  if (!aTracks.length) {
    video.pause();
    URL.revokeObjectURL(url);
    throw new Error(
      "音声トラックがありません（またはブラウザが取得できません）。別ファイルを試してください。"
    );
  }

  const audioOnly = new MediaStream(aTracks);
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
  if (!mime) {
    video.pause();
    URL.revokeObjectURL(url);
    throw new Error("WebM 音声録音に対応していません");
  }

  const rec = new MediaRecorder(audioOnly, { mimeType: mime });
  const chunks: Blob[] = [];
  rec.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };
  const stopped = new Promise<ArrayBuffer>((resolve, reject) => {
    rec.onerror = () => reject(new Error("録音に失敗しました"));
    rec.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: mime.split(";")[0] });
        const buf = await blob.arrayBuffer();
        resolve(buf);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("録音データの取得に失敗しました"));
      }
    };
  });

  const sliceMs = Math.min(1000, Math.max(100, Math.floor((dur * 1000) / 40)));
  rec.start(sliceMs);

  await new Promise<void>((resolve, reject) => {
    const t0 = performance.now();
    const timeoutMs = (dur + 10) * 1000;
    let settled = false;
    const cleanup = () => {
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("error", onErr);
      window.clearInterval(iv);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onEnded = () => finish();
    const onTime = () => {
      if (video.ended || video.currentTime >= dur - 0.04) finish();
      const r = Math.max(0, Math.min(1, video.currentTime / dur));
      onProgress?.({ ratio: r, stage: "record", message: "録音中…" });
    };
    const onErr = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("動画の再生が中断されました"));
    };
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("error", onErr);
    const iv = window.setInterval(() => {
      if (performance.now() - t0 > timeoutMs) finish();
    }, 200);
  });

  try {
    rec.stop();
  } catch {
    /* ignore */
  }
  video.pause();
  URL.revokeObjectURL(url);
  return await stopped;
}

/**
 * 動画から音声を抽出。
 * - 対応ブラウザ（fast decode 可） → 数秒以内
 * - それ以外（MP4/AVI/MKV…）      → FFmpeg.wasm（概ね再生時間の 1/3〜1/10）
 * - wasm もダメな環境                → MediaRecorder（実時間）
 */
export async function extractAudioBufferFromVideoFile(
  file: File,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer> {
  onProgress?.({ ratio: 0, stage: "decode", message: "高速デコードを試行中…" });
  const fast = await tryDecodeVideoFileAsAudioBuffer(file);
  if (fast) {
    onProgress?.({ ratio: 1, stage: "decode", message: "デコード完了" });
    return fast;
  }

  try {
    return await extractWithFFmpegWasm(file, onProgress);
  } catch (wasmErr) {
    /** wasm が動かない環境（社内 PC・古いブラウザ等）向けの最終手段 */
    console.warn("[extractAudio] wasm extraction failed, falling back to recording:", wasmErr);
    onProgress?.({
      ratio: 0,
      stage: "record",
      message: "高速抽出に失敗。録音モードに切り替え…",
    });
    return await extractWithMediaRecorder(file, onProgress);
  }
}

/** Blob の MIME（高速/ wasm 経路は WAV、録音は WebM） */
export function mimeForExtractedVideoAudio(buf: ArrayBuffer): string {
  return isRiffWav(buf) ? "audio/wav" : "audio/webm";
}

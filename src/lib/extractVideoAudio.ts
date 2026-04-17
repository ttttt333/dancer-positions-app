/**
 * 動画ファイルから音声を ArrayBuffer で返す（§58）。
 *
 * 1) 可能なら decodeAudioData で一発デコード（多くの WebM 等で数秒以内）
 * 2) 失敗時は captureStream + MediaRecorder（従来どおり実時間に近い）
 */

const MAX_VIDEO_DURATION_SEC = 7200;

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
  new Uint8Array(out, headerSize).set(new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength));
  return out;
}

/**
 * ブラウザがコンテナ全体を音声として decode できる場合のみ成功（WebM 等で高速）。
 * 一般的な MP4 は多くの環境で失敗し、その場合は null。
 */
const MAX_FAST_DECODE_BYTES = 220 * 1024 * 1024;

export async function tryDecodeVideoFileAsAudioBuffer(file: File): Promise<ArrayBuffer | null> {
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

function isRiffWav(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false;
  const u = new Uint8Array(buf, 0, 4);
  return u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46;
}

/**
 * 動画から音声を抽出。高速パス（decode）に成功した場合は WAV、録音パスでは WebM。
 */
export async function extractAudioBufferFromVideoFile(file: File): Promise<ArrayBuffer> {
  const fast = await tryDecodeVideoFileAsAudioBuffer(file);
  if (fast) return fast;

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
    (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream ??
    (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
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

  /** 長いほど間隔を広げ、オーバーヘッドを抑える */
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

/** Blob の MIME（高速パスは WAV、録音は WebM） */
export function mimeForExtractedVideoAudio(buf: ArrayBuffer): string {
  return isRiffWav(buf) ? "audio/wav" : "audio/webm";
}

/**
 * 動画ファイルから音声を ArrayBuffer で返す（§58）。
 *
 * 判断順（速い順に試す）：
 * 0) 入力ファイルがそもそも音声コンテナ（mp3/m4a/wav/ogg/opus/flac/aac）なら
 *    何もせずそのままバイト列を返す。ほぼ一瞬。
 * 1) 小さな動画 or audio-in-container（短い WebM など）は `decodeAudioData` で
 *    ブラウザネイティブに即デコード。
 * 2) iOS Safari: mp4box.js で MP4/MOV コンテナを解析 → AAC フレーム抽出 → ADTS 変換
 *    → `decodeAudioData`。captureStream / FFmpeg.wasm 不要。
 * 3) 一般的な動画（MP4 / MOV / MKV / AVI / FLV / WMV…）は最初から
 *    FFmpeg.wasm で音声トラックのみ **stream copy**（demux のみ）。
 * 4) copy 不能なコーデックのときだけ WAV へ再エンコード。
 * 5) さらに失敗したら captureStream + MediaRecorder（実時間）。
 *
 * FFmpeg.wasm 本体は `preloadFFmpeg()` でエディタ起動時にバックグラウンド取得済。
 * 2 回目以降はインスタンス使い回しで即起動（ブラウザ HTTP キャッシュも効く）。
 */

const MAX_VIDEO_DURATION_SEC = 7200;
/** decodeAudioData を試してよい最大サイズ。大きすぎるとメモリ＆読み込みで遅い */
const MAX_FAST_DECODE_BYTES = 60 * 1024 * 1024;
/** 極端に巨大なファイルは wasm メモリを食いつぶすので従来パスへ */
const MAX_WASM_BYTES = 800 * 1024 * 1024;

// ─── ADTS ヘルパー ────────────────────────────────────────────
/** 標準 AAC サンプルレートテーブル（インデックス 0〜12） */
const AAC_SAMPLE_RATE_TABLE = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
] as const;

/**
 * 生 AAC フレーム 1 つ分の 7 バイト ADTS ヘッダーを返す。
 * @param audioObjectType 2 = AAC-LC（iPhone 動画はほぼすべて AAC-LC）
 * @param sampleRateIdx   AAC_SAMPLE_RATE_TABLE のインデックス
 * @param channelConfig   チャネル数（1=mono, 2=stereo…）
 * @param rawFrameLen     生 AAC データのバイト数（ADTS ヘッダーを含まない）
 */
function buildAdtsHeader(
  audioObjectType: number,
  sampleRateIdx: number,
  channelConfig: number,
  rawFrameLen: number
): Uint8Array {
  const profile = audioObjectType - 1; // profile_ObjectType = audioObjectType − 1
  const adtsLen = rawFrameLen + 7;     // ADTS フレーム長はヘッダー込み
  return new Uint8Array([
    0xff,
    0xf1, // MPEG-4 (ID=0), layer=00, no CRC
    ((profile & 0x3) << 6) | ((sampleRateIdx & 0xf) << 2) | ((channelConfig >> 2) & 0x1),
    ((channelConfig & 0x3) << 6) | ((adtsLen >> 11) & 0x3),
    (adtsLen >> 3) & 0xff,
    ((adtsLen & 0x7) << 5) | 0x1f,
    0xfc,
  ]);
}

/**
 * mp4box.js で MP4/MOV コンテナを解析し、AAC 音声フレームを ADTS ストリームに変換して
 * `AudioContext.decodeAudioData` でデコードする。
 *
 * captureStream / FFmpeg.wasm / video.play() を一切使わないため iOS Safari でも動作する。
 * iPhone 動画（HEVC+AAC、H.264+AAC どちらも）対応。
 *
 * @returns WAV 形式の ArrayBuffer、またはコンテナが音声トラックを持たない場合 null
 */
async function extractAudioWithMp4Demux(
  file: File,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer | null> {
  const { createFile } = await import("mp4box");

  return new Promise<ArrayBuffer | null>((resolve) => {
    const mp4 = createFile();

    let audioTrackId: number | null = null;
    let expectedSamples = 0;
    let receivedSamples = 0;
    let audioObjectType = 2; // デフォルト: AAC-LC
    let sampleRateIdx = 4;  // デフォルト: 44100 Hz
    let channelConfig = 2;  // デフォルト: ステレオ

    const frames: { data: Uint8Array; byteLen: number }[] = [];
    let totalAdtsBytes = 0;
    let finished = false;

    const buildAndResolve = async () => {
      if (finished) return;
      finished = true;

      if (!frames.length) {
        resolve(null);
        return;
      }

      // ADTS ストリームを組み立てる
      const adtsBuf = new Uint8Array(totalAdtsBytes);
      let offset = 0;
      for (const { data, byteLen } of frames) {
        const hdr = buildAdtsHeader(audioObjectType, sampleRateIdx, channelConfig, byteLen);
        adtsBuf.set(hdr, offset);
        offset += 7;
        adtsBuf.set(data, offset);
        offset += byteLen;
      }

      try {
        onProgress?.({ ratio: 0.85, stage: "decode", message: "音声をデコード中…" });
        const ctx = new AudioContext();
        const audioBuf = await ctx.decodeAudioData(adtsBuf.buffer);
        await ctx.close().catch(() => {});
        onProgress?.({ ratio: 1, stage: "decode", message: "デコード完了" });
        resolve(encodeMonoWavFromAudioBuffer(audioBuf));
      } catch (e) {
        console.warn("[mp4demux] decodeAudioData failed:", e);
        resolve(null);
      }
    };

    mp4.onReady = (info) => {
      if (!info.audioTracks.length) {
        resolve(null);
        return;
      }
      const track = info.audioTracks[0];
      audioTrackId = track.id;
      expectedSamples = track.nb_samples;

      // コーデック文字列から audioObjectType を取得 (例: "mp4a.40.2" → 2)
      const parts = track.codec.split(".");
      if (parts.length >= 3) {
        const aot = parseInt(parts[2], 10);
        if (!isNaN(aot)) audioObjectType = aot;
      }

      // サンプルレートインデックス
      const sr = track.audio?.sample_rate ?? 44100;
      const idx = (AAC_SAMPLE_RATE_TABLE as readonly number[]).indexOf(sr);
      sampleRateIdx = idx >= 0 ? idx : 4;

      // チャネル設定
      channelConfig = track.audio?.channel_count ?? 2;

      mp4.setExtractionOptions(track.id, null, { nbSamples: expectedSamples });
      mp4.start();
    };

    mp4.onSamples = (_id, _user, samples) => {
      for (const s of samples) {
        const view = new Uint8Array(s.data.buffer, s.data.byteOffset, s.data.byteLength);
        frames.push({ data: view, byteLen: s.data.byteLength });
        totalAdtsBytes += s.data.byteLength + 7;
        receivedSamples++;
      }
      if (audioTrackId !== null && receivedSamples >= expectedSamples) {
        buildAndResolve();
      }
    };

    // ファイルを 4 MB ずつ送り込む
    const CHUNK = 4 * 1024 * 1024;
    let byteOffset = 0;

    const readNext = async (): Promise<void> => {
      if (byteOffset >= file.size) {
        mp4.flush(); // 残りサンプルを onSamples へ送出
        // flush 後も onSamples が呼ばれない場合（フラグメントなど）に備える
        setTimeout(() => buildAndResolve(), 2000);
        return;
      }
      const slice = file.slice(byteOffset, byteOffset + CHUNK);
      const ab = await slice.arrayBuffer();
      // mp4box は ArrayBuffer に fileStart プロパティが必要
      (ab as ArrayBuffer & { fileStart: number }).fileStart = byteOffset;
      byteOffset += ab.byteLength;

      const nextOffset = mp4.appendBuffer(ab as ArrayBuffer & { fileStart: number });
      if (nextOffset !== undefined) byteOffset = Math.max(byteOffset, nextOffset);

      onProgress?.({
        ratio: Math.min(0.8, byteOffset / file.size),
        stage: "decode",
        message: "MP4/MOV を解析中…",
      });
      await readNext();
    };

    readNext().catch(() => resolve(null));
  });
}

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
  const u = new Uint8Array(buf, 0, 12);
  return (
    u[0] === 0x52 &&
    u[1] === 0x49 &&
    u[2] === 0x46 &&
    u[3] === 0x46 &&
    u[8] === 0x57 &&
    u[9] === 0x41 &&
    u[10] === 0x56 &&
    u[11] === 0x45
  );
}

function isMp4LikeAudio(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false;
  const u = new Uint8Array(buf, 0, 12);
  /** ISO BMFF: バイト 4-7 に "ftyp" */
  return (
    u[4] === 0x66 && u[5] === 0x74 && u[6] === 0x79 && u[7] === 0x70
  );
}

function isWebm(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const u = new Uint8Array(buf, 0, 4);
  /** EBML ヘッダ: 1A 45 DF A3 */
  return u[0] === 0x1a && u[1] === 0x45 && u[2] === 0xdf && u[3] === 0xa3;
}

function isOgg(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const u = new Uint8Array(buf, 0, 4);
  return u[0] === 0x4f && u[1] === 0x67 && u[2] === 0x67 && u[3] === 0x53;
}

function isMp3(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 3) return false;
  const u = new Uint8Array(buf, 0, 3);
  /** ID3 タグ or MPEG フレーム同期 (0xFFFB/0xFFFA/0xFFF3/0xFFF2) */
  if (u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) return true;
  if (u[0] === 0xff && (u[1] & 0xe0) === 0xe0) return true;
  return false;
}

/**
 * ファイルが「音声だけが入ったコンテナ」っぽいかを拡張子で判定（最速パス用）。
 */
function isPureAudioByName(file: File): boolean {
  return /\.(mp3|m4a|wav|ogg|oga|opus|flac|aac)$/i.test(file.name);
}

/**
 * ファイルが「動画コンテナ（MP4/MOV/MKV/AVI 等）」っぽいかを拡張子で判定。
 * 典型的にブラウザの `decodeAudioData` は失敗するので、最初から FFmpeg 経由に
 * した方が速い（無駄な全読み込みを避けられる）。
 */
function isLikelyVideoContainer(file: File): boolean {
  return /\.(mp4|m4v|mov|mkv|avi|flv|wmv|ogv|ts|mts|3gp|f4v|webm)$/i.test(
    file.name
  );
}

/**
 * ブラウザがコンテナ全体を音声として decode できる場合のみ成功（WebM/小型 MP4 等）。
 * 大きな動画や汎用 MP4 は成功率が低いため、呼び出し側で早期スキップすること。
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

/**
 * アプリ起動直後などにバックグラウンドで FFmpeg.wasm を温めておく。
 * ユーザが動画を選ぶ前にコア（~30MB）と wasm ランタイムを読み込ませ、
 * 実際の抽出は準備完了済みの状態からスタートできる。
 */
export function preloadFFmpeg(): Promise<void> {
  /** 既に読み込まれていれば何もしない */
  if (ffmpegSingleton?.loaded || ffmpegLoadPromise) return Promise.resolve();
  return loadFFmpeg()
    .then(() => undefined)
    .catch(() => {
      /** 失敗はユーザ操作時に再試行されるので握り潰す */
    });
}

type CopyPlan = {
  outName: string;
  format: string;
  mime: string;
};

/** 入力拡張子から「stream copy で通せそう」な出力コンテナの候補を返す */
function copyPlansForExt(ext: string): CopyPlan[] {
  const plans: CopyPlan[] = [];
  /** AAC / ALAC 系 → ipod muxer（.m4a / audio/mp4） */
  if (["mp4", "m4v", "mov", "m4a", "3gp", "ts", "mts"].includes(ext)) {
    plans.push({ outName: "output.m4a", format: "ipod", mime: "audio/mp4" });
  } else if (ext === "mkv") {
    /** MKV は AAC / Opus / Vorbis / MP3 いずれも入りうる。順に試す */
    plans.push({ outName: "output.m4a", format: "ipod", mime: "audio/mp4" });
    plans.push({ outName: "output.webm", format: "webm", mime: "audio/webm" });
    plans.push({ outName: "output.mp3", format: "mp3", mime: "audio/mpeg" });
  } else if (ext === "webm") {
    plans.push({ outName: "output.webm", format: "webm", mime: "audio/webm" });
  } else if (["ogv", "ogg"].includes(ext)) {
    plans.push({ outName: "output.ogg", format: "ogg", mime: "audio/ogg" });
  } else if (["flv"].includes(ext)) {
    /** FLV は AAC / MP3 どちらも */
    plans.push({ outName: "output.m4a", format: "ipod", mime: "audio/mp4" });
    plans.push({ outName: "output.mp3", format: "mp3", mime: "audio/mpeg" });
  } else if (ext === "avi") {
    /** AVI は PCM / MP3 が多い */
    plans.push({ outName: "output.mp3", format: "mp3", mime: "audio/mpeg" });
  }
  /** wmv 等は copy 不能な独自コーデックが多いので WAV 直行 */
  return plans;
}

/**
 * 音声トラックだけを **再エンコードせず** demux する高速パス。
 * 成功すれば ArrayBuffer、失敗（コーデック非互換など）なら null。
 */
async function tryFFmpegCopyAudio(
  ff: FFmpegInstance,
  inName: string,
  inExt: string,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer | null> {
  const plans = copyPlansForExt(inExt);
  if (plans.length === 0) return null;

  const onProgressInternal = (p: { progress: number }) => {
    const r = Math.max(0, Math.min(1, p.progress));
    onProgress?.({ ratio: r, stage: "wasm", message: "音声トラックを抽出中…" });
  };
  ff.on("progress", onProgressInternal);

  try {
    for (const plan of plans) {
      try {
        onProgress?.({
          ratio: 0.02,
          stage: "wasm",
          message: "音声トラックを抽出中…",
        });
        const code = await ff.exec([
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          inName,
          "-vn",
          "-map",
          "0:a:0?",
          "-c:a",
          "copy",
          "-f",
          plan.format,
          plan.outName,
        ]);
        if (code !== 0) {
          await ff.deleteFile(plan.outName).catch(() => {});
          continue;
        }
        const out = await ff.readFile(plan.outName);
        await ff.deleteFile(plan.outName).catch(() => {});
        const data = typeof out === "string" ? new TextEncoder().encode(out) : out;
        if (data.byteLength === 0) continue;
        const buf = new ArrayBuffer(data.byteLength);
        new Uint8Array(buf).set(data);
        onProgress?.({ ratio: 1, stage: "wasm", message: "抽出完了" });
        return buf;
      } catch {
        await ff.deleteFile(plan.outName).catch(() => {});
        /** 次の候補へ */
      }
    }
    return null;
  } finally {
    ff.off("progress", onProgressInternal);
  }
}

/** FFmpeg.wasm で動画 → WAV（mono/44.1kHz）を再エンコードで抽出（stream copy 失敗時のみ） */
async function extractWithFFmpegWav(
  ff: FFmpegInstance,
  inName: string,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer> {
  const outName = "output.wav";

  const onProgressInternal = (p: { progress: number }) => {
    const r = Math.max(0, Math.min(1, p.progress));
    onProgress?.({ ratio: r, stage: "wasm", message: "音声を再エンコード中…" });
  };
  ff.on("progress", onProgressInternal);

  try {
    onProgress?.({ ratio: 0.02, stage: "wasm", message: "音声を再エンコード中…" });
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
    const buf = new ArrayBuffer(data.byteLength);
    new Uint8Array(buf).set(data);
    onProgress?.({ ratio: 1, stage: "wasm", message: "抽出完了" });
    return buf;
  } finally {
    ff.off("progress", onProgressInternal);
    try {
      await ff.deleteFile(outName);
    } catch {
      /* noop */
    }
  }
}

/** FFmpeg.wasm を使った抽出のエントリポイント（copy → WAV の順で試す） */
async function extractWithFFmpegWasm(
  file: File,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer> {
  if (file.size > MAX_WASM_BYTES) {
    throw new Error(
      "動画が大きすぎます（wasm の制約）。ファイルを分割するか、別形式で再エクスポートしてください。"
    );
  }

  const inExt = extForFFmpeg(file);
  const inName = `input.${inExt}`;

  onProgress?.({ ratio: 0, stage: "wasm", message: "動画を読み込み中…" });

  /**
   * FFmpeg のロードとファイルバイト列の取得は独立タスクなので並列化。
   * preload 済みなら loadFFmpeg は即時解決するので、実質 arrayBuffer の時間のみ。
   */
  const [ff, fileBuffer] = await Promise.all([
    loadFFmpeg(onProgress),
    file.arrayBuffer(),
  ]);
  const fileData = new Uint8Array(fileBuffer);

  try {
    await ff.writeFile(inName, fileData);

    /** 1) 無変換 stream copy（最速） */
    const copied = await tryFFmpegCopyAudio(ff, inName, inExt, onProgress);
    if (copied) return copied;

    /** 2) それでもダメならモノラル 44.1kHz WAV へ再エンコード */
    return await extractWithFFmpegWav(ff, inName, onProgress);
  } finally {
    /** 大きな入力はメモリを食い続けるので削除 */
    try {
      await ff.deleteFile(inName);
    } catch {
      /* noop */
    }
  }
}

/**
 * FFmpeg.wasm 失敗後の iOS / モバイル向けフォールバック。
 * ブラウザネイティブ AudioContext.decodeAudioData を試みる。
 * iOS Safari は MOV/M4V/MP4(AAC) を natively サポートするので有効。
 * ファイルを一括読み込みするためサイズ上限を設ける。
 */
async function tryNativeDecodeAudioFallback(
  file: File,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer | null> {
  const MAX_NATIVE_BYTES = 300 * 1024 * 1024; // 300 MB
  if (file.size > MAX_NATIVE_BYTES) return null;
  const ctx = new AudioContext();
  try {
    onProgress?.({ ratio: 0, stage: "decode", message: "ネイティブデコードを試行中…" });
    const raw = await file.arrayBuffer();
    onProgress?.({ ratio: 0.5, stage: "decode", message: "音声をデコード中…" });
    const audioBuf = await ctx.decodeAudioData(raw.slice(0));
    onProgress?.({ ratio: 1, stage: "decode", message: "デコード完了" });
    return encodeMonoWavFromAudioBuffer(audioBuf);
  } catch {
    return null;
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * iOS Safari / captureStream 非対応環境向け:
 * createMediaElementSource（Web Audio API）経由で音声をキャプチャする。
 * captureStream() を一切使わないため iOS Safari でも動作する。
 */
async function extractWithMediaElementSource(
  file: File,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("動画の読み込みに失敗しました"));
      setTimeout(() => reject(new Error("読み込みタイムアウト")), 30_000);
    });

    const dur = video.duration;
    if (!Number.isFinite(dur) || dur <= 0 || dur > MAX_VIDEO_DURATION_SEC) {
      throw new Error(
        dur > MAX_VIDEO_DURATION_SEC
          ? "2時間を超える動画は未対応です"
          : "動画の長さを取得できませんでした"
      );
    }

    // Web Audio API 経由でキャプチャ（captureStream 不要）
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    source.connect(dest);

    const mime = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",      // iOS Safari 14+
      "video/mp4",      // iOS フォールバック
    ].find((m) => MediaRecorder.isTypeSupported(m));

    if (!mime) {
      await ctx.close();
      throw new Error("NO_SUPPORTED_MIME");
    }

    const rec = new MediaRecorder(dest.stream, { mimeType: mime });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<ArrayBuffer>((resolve, reject) => {
      rec.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: mime.split(";")[0] });
          resolve(await blob.arrayBuffer());
        } catch (e) {
          reject(e instanceof Error ? e : new Error("録音データの取得に失敗しました"));
        }
      };
      rec.onerror = () => reject(new Error("録音に失敗しました"));
    });

    const sliceMs = Math.min(1000, Math.max(100, Math.floor((dur * 1000) / 40)));
    rec.start(sliceMs);

    // iOS では play() がユーザジェスチャ後でないと失敗することがある
    try {
      await video.play();
    } catch {
      rec.stop();
      await ctx.close();
      throw new Error("PLAY_BLOCKED");
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      video.addEventListener("ended", finish);
      video.addEventListener("timeupdate", () => {
        if (video.ended || video.currentTime >= dur - 0.04) finish();
        onProgress?.({
          ratio: Math.min(1, video.currentTime / dur),
          stage: "record",
          message: "録音中…",
        });
      });
      video.addEventListener("error", finish);
      setTimeout(finish, (dur + 15) * 1000);
    });

    rec.stop();
    await ctx.close();
    return stopped;
  } finally {
    URL.revokeObjectURL(url);
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
    throw new Error("CAPTURE_STREAM_UNSUPPORTED");
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
      : MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"  // iOS 14+ Safari
        : "";
  if (!mime) {
    video.pause();
    URL.revokeObjectURL(url);
    throw new Error("音声録音に対応していません（ブラウザが WebM / MP4 録音をサポートしていません）");
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

/** iOS Safari / iOS WKWebView かどうか判定 */
function isIOSBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * 動画から音声を抽出。
 * - ファイル自体が音声ファイル            → そのまま返す（一瞬）
 * - 小型 or 音声主体コンテナ（webm 等）  → `decodeAudioData` で即デコード
 * - iOS Safari                            → ネイティブデコード → MediaElementSource の順で試みる
 * - 一般的な動画（MP4/MOV/MKV/AVI…）    → FFmpeg.wasm で stream copy（数秒）
 * - copy 不可のコーデック                → FFmpeg.wasm で WAV 再エンコード
 * - wasm もダメな環境                     → MediaElementSource → captureStream + MediaRecorder
 *
 * `preloadFFmpeg()` で事前にコア/wasm を取得済みの場合、多くの動画は数秒以内で完了する。
 */
export async function extractAudioBufferFromVideoFile(
  file: File,
  onProgress?: ExtractProgress
): Promise<ArrayBuffer> {
  /** 0) 既に音声ファイルならそのまま返す（最速） */
  if (isPureAudioByName(file)) {
    onProgress?.({ ratio: 0, stage: "decode", message: "音声ファイルを読み込み中…" });
    const raw = await file.arrayBuffer();
    onProgress?.({ ratio: 1, stage: "decode", message: "読み込み完了" });
    return raw;
  }

  /**
   * 1) 小型 or 音声主体コンテナのみ decodeAudioData を試す。
   * 大型 MP4/MOV/MKV 等は高確率で失敗するので、最初から FFmpeg 経由にした方が
   * 無駄な全読み込みを避けられて速い。preload 済み FFmpeg なら体感差はほぼ無い。
   */
  const shouldTryFastDecode =
    file.size <= MAX_FAST_DECODE_BYTES &&
    (!isLikelyVideoContainer(file) || file.size <= 12 * 1024 * 1024);
  if (shouldTryFastDecode) {
    onProgress?.({ ratio: 0, stage: "decode", message: "高速デコードを試行中…" });
    const fast = await tryDecodeVideoFileAsAudioBuffer(file);
    if (fast) {
      onProgress?.({ ratio: 1, stage: "decode", message: "デコード完了" });
      return fast;
    }
  }

  /**
   * 2) iOS は FFmpeg.wasm のロードが遅く失敗しやすいため、
   *    mp4box demux → ネイティブデコード → MediaElementSource の順に先に試みる。
   *    MP4/MOV コンテナを JavaScript で解析して AAC だけ抽出するので
   *    captureStream も play() も FFmpeg.wasm も不要。
   */
  if (isIOSBrowser() && isLikelyVideoContainer(file)) {
    console.log("[extractAudio] iOS + video detected – trying mp4box demux");
    onProgress?.({ ratio: 0, stage: "decode", message: "MP4/MOV を解析中…" });
    const mp4Result = await extractAudioWithMp4Demux(file, onProgress).catch((e) => {
      console.warn("[extractAudio] mp4box demux error:", e);
      return null;
    });
    if (mp4Result) return mp4Result;

    // mp4box で取れなかった場合（非 AAC コーデック等）はネイティブデコードを試みる
    console.warn("[extractAudio] mp4box demux returned null, trying native decode");
    const native = await tryNativeDecodeAudioFallback(file, onProgress).catch(() => null);
    if (native) return native;

    console.warn("[extractAudio] iOS native decode failed, trying MediaElementSource");
    onProgress?.({ ratio: 0, stage: "record", message: "録音モードで抽出中…" });
    try {
      return await extractWithMediaElementSource(file, onProgress);
    } catch (meErr) {
      const msg = meErr instanceof Error ? meErr.message : "";
      if (msg === "PLAY_BLOCKED" || msg === "NO_SUPPORTED_MIME") {
        throw new Error(
          "お使いのブラウザ・端末では動画からの自動音声抽出ができませんでした。\n" +
          "以下の方法をお試しください：\n" +
          "① 動画を MP3 / M4A / WAV に変換してから読み込む\n" +
          "② iPhone の場合「ファイル」アプリで動画を選び「共有 → GarageBand」等で音声書き出し後、音声ファイルとして読み込む"
        );
      }
      console.warn("[extractAudio] iOS MediaElementSource failed, falling back to wasm:", meErr);
    }
  }

  try {
    return await extractWithFFmpegWasm(file, onProgress);
  } catch (wasmErr) {
    /** wasm が動かない環境（iOS Safari・古いブラウザ等）向けのフォールバック */
    console.warn("[extractAudio] wasm extraction failed, trying native decode:", wasmErr);

    // フォールバック 1: ブラウザネイティブ音声デコード（iOS Safari は MOV/M4A/MP4 対応）
    const nativeFallback = await tryNativeDecodeAudioFallback(file, onProgress).catch(() => null);
    if (nativeFallback) return nativeFallback;

    // フォールバック 2: createMediaElementSource 経由（captureStream 不要、iOS 向け）
    console.warn("[extractAudio] trying MediaElementSource route (no captureStream)");
    onProgress?.({ ratio: 0, stage: "record", message: "録音モードで抽出中…" });
    try {
      return await extractWithMediaElementSource(file, onProgress);
    } catch (meErr) {
      const msg = meErr instanceof Error ? meErr.message : "";
      // play() がブロックされた / MIME 非対応 の場合はユーザ向けメッセージを返す
      if (msg === "PLAY_BLOCKED" || msg === "NO_SUPPORTED_MIME") {
        throw new Error(
          "お使いのブラウザ・端末では動画からの自動音声抽出ができませんでした。\n" +
          "以下の方法をお試しください：\n" +
          "① 動画を MP3 / M4A / WAV に変換してから読み込む\n" +
          "② iPhone の場合「ファイル」アプリで動画を選び「共有 → GarageBand」等で音声書き出し後、音声ファイルとして読み込む"
        );
      }
      console.warn("[extractAudio] MediaElementSource failed:", meErr);
    }

    // フォールバック 3: captureStream + MediaRecorder（デスクトップ向け最終手段）
    console.warn("[extractAudio] falling back to captureStream MediaRecorder");
    try {
      return await extractWithMediaRecorder(file, onProgress);
    } catch (recErr) {
      const msg = recErr instanceof Error ? recErr.message : "";
      if (msg === "CAPTURE_STREAM_UNSUPPORTED") {
        throw new Error(
          "お使いのブラウザ・端末では動画からの音声抽出ができませんでした。\n" +
          "以下の方法をお試しください：\n" +
          "① 動画を MP3 / M4A / WAV に変換してから読み込む\n" +
          "② iPhone の場合「ファイル」アプリで動画を選び「共有 → GarageBand」等で音声書き出し後、音声ファイルとして読み込む"
        );
      }
      throw recErr;
    }
  }
}

/** Blob の MIME をマジックバイトで判定（WAV / MP4(m4a) / WebM / Ogg / MP3 / それ以外は webm フォールバック） */
export function mimeForExtractedVideoAudio(buf: ArrayBuffer): string {
  if (isRiffWav(buf)) return "audio/wav";
  if (isMp4LikeAudio(buf)) return "audio/mp4";
  if (isWebm(buf)) return "audio/webm";
  if (isOgg(buf)) return "audio/ogg";
  if (isMp3(buf)) return "audio/mpeg";
  return "audio/webm";
}

import { loadFFmpegWasm } from "./ffmpegWasm";

const MAX_ENCODE_BYTES = 100 * 1024 * 1024;
const MP3_BITRATE = "192k";

function inputExt(file: File): string {
  const m = /\.([a-zA-Z0-9]{1,8})$/.exec(file.name.trim());
  if (m) return m[1]!.toLowerCase();
  if (file.type.includes("wav")) return "wav";
  if (file.type.includes("mp4") || file.type.includes("m4a")) return "m4a";
  if (file.type.includes("ogg")) return "ogg";
  if (file.type.includes("flac")) return "flac";
  if (file.type.includes("mpeg") || file.type.includes("mp3")) return "mp3";
  return "bin";
}

function baseNameWithoutExt(name: string): string {
  const t = name.trim() || "audio";
  return t.replace(/\.[^.]+$/, "") || "audio";
}

/** 共有・クラウド保存向け: 音源を MP3（192kbps）に統一 */
export async function compressAudioFileToMp3ForUpload(
  file: File,
  onProgress?: (ratio: number, message: string) => void
): Promise<File> {
  if (file.size > MAX_ENCODE_BYTES) {
    throw new Error("音源が大きすぎます。短い区間に分割するか、先に MP3 に変換してください。");
  }

  const alreadyMp3 =
    (file.type === "audio/mpeg" || /\.mp3$/i.test(file.name)) &&
    file.size <= 12 * 1024 * 1024;
  if (alreadyMp3) {
    onProgress?.(1, "MP3 のままアップロードします");
    const name = /\.mp3$/i.test(file.name)
      ? file.name
      : `${baseNameWithoutExt(file.name)}.mp3`;
    return new File([file], name, { type: "audio/mpeg" });
  }

  onProgress?.(0.05, "MP3 に変換中…");
  const ff = await loadFFmpegWasm((p) => {
    onProgress?.(0.05 + p.ratio * 0.35, p.message || "MP3 に変換中…");
  });

  const inExt = inputExt(file);
  const inName = `upload-in.${inExt}`;
  const outName = "upload-out.mp3";

  await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));

  onProgress?.(0.45, "MP3 にエンコード中…");
  const code = await ff.exec([
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inName,
    "-vn",
    "-ac",
    "2",
    "-ar",
    "44100",
    "-c:a",
    "libmp3lame",
    "-b:a",
    MP3_BITRATE,
    "-f",
    "mp3",
    outName,
  ]);

  await ff.deleteFile(inName).catch(() => {});

  if (code !== 0) {
    await ff.deleteFile(outName).catch(() => {});
    throw new Error("MP3 への変換に失敗しました");
  }

  const out = await ff.readFile(outName);
  await ff.deleteFile(outName).catch(() => {});
  const data = typeof out === "string" ? new TextEncoder().encode(out) : out;
  if (!data.byteLength) {
    throw new Error("MP3 への変換結果が空です");
  }

  onProgress?.(1, "MP3 変換完了");
  const outNameFile = `${baseNameWithoutExt(file.name)}.mp3`;
  const mp3Bytes =
    data instanceof Uint8Array
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : data;
  return new File([mp3Bytes], outNameFile, { type: "audio/mpeg" });
}

import { strToU8, zipSync } from "fflate";
import {
  buildPortableArchiveAsync,
  EDITOR_DRAFT_PREFIX_EXPORT,
  type PortableArchiveV1,
} from "./portableChoreoBackup";

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeZipSegment(s: string): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (t || "item").slice(0, 100);
}

function extFromMime(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("webm")) return "webm";
  if (m.includes("json")) return "json";
  return "bin";
}

function backupStamp(iso: string): string {
  return iso.replace(/[:.]/g, "-").slice(0, 19);
}

function buildReadme(root: string, payload: PortableArchiveV1): string {
  const lsKeys = Object.keys(payload.localStorage).length;
  const flowAudio = Object.keys(payload.flowLibraryIndexedAudio ?? {}).length;
  const videos = payload.videoModule?.meta?.length ?? 0;
  const peaks = Object.keys(payload.wavePeaksCache ?? {}).length;
  const cloud = payload.cloudProjects?.length ?? 0;
  return `ChoreoCore / 立ち位置アプリ — データバックアップ
書き出し日時: ${payload.exportedAt}

この ZIP を展開すると、次のフォルダ構成になります。

${root}/
  backup.json          … 復元用の完全データ（取り込みはこのファイルを使用）
  README.txt           … この説明
  localStorage/        … ブラウザ内の設定・ライブラリ JSON
  flow-library-audio/  … フローライブラリ同梱音源
  video-module/        … 動画モジュール
  wave-peaks-cache/    … 波形キャッシュ
  cloud-projects/      … クラウド作品 JSON（書き出し時に含めた場合）

含まれるデータ:
  - localStorage: ${lsKeys} キー
  - フロー同梱音源: ${flowAudio} 件
  - 動画: ${videos} 件
  - 波形キャッシュ: ${peaks} 件
  - クラウド作品: ${cloud} 件

復元方法:
  1. アプリのトップ画面 →「データのバックアップ」→「バックアップから取り込む」
  2. 展開したフォルダ内の backup.json を選択

※ ログイン用トークンは含まれません。
※ クラウド上の音源ファイル本体は JSON にパス参照のみ含まれる場合があります。
`;
}

function addZipFilesFromArchive(
  files: Record<string, Uint8Array>,
  root: string,
  payload: PortableArchiveV1
): void {
  files[`${root}README.txt`] = strToU8(buildReadme(root, payload));
  files[`${root}backup.json`] = strToU8(JSON.stringify(payload, null, 2));

  for (const [key, raw] of Object.entries(payload.localStorage)) {
    const isDraft = key.startsWith(EDITOR_DRAFT_PREFIX_EXPORT);
    const sub = isDraft ? "localStorage/editor-drafts/" : "localStorage/";
    const fname = isDraft
      ? `${safeZipSegment(key.slice(EDITOR_DRAFT_PREFIX_EXPORT.length))}.json`
      : `${safeZipSegment(key)}.json`;
    files[`${root}${sub}${fname}`] = strToU8(raw);
  }

  for (const [key, audio] of Object.entries(payload.flowLibraryIndexedAudio ?? {})) {
    if (!audio?.base64) continue;
    const ext = extFromMime(audio.mime);
    files[`${root}flow-library-audio/${safeZipSegment(key)}.${ext}`] = base64ToUint8(
      audio.base64
    );
  }

  if (payload.videoModule?.meta?.length) {
    files[`${root}video-module/meta.json`] = strToU8(
      JSON.stringify(payload.videoModule.meta, null, 2)
    );
    for (const m of payload.videoModule.meta) {
      const b64 = payload.videoModule.blobs?.[m.id];
      if (!b64) continue;
      files[`${root}video-module/${safeZipSegment(m.id)}.mp4`] = base64ToUint8(b64);
    }
  }

  for (const [key, entry] of Object.entries(payload.wavePeaksCache ?? {})) {
    files[`${root}wave-peaks-cache/${safeZipSegment(key)}.json`] = strToU8(
      JSON.stringify(entry, null, 2)
    );
  }

  for (const p of payload.cloudProjects ?? []) {
    const fname = `${String(p.id).padStart(4, "0")}-${safeZipSegment(p.name)}.json`;
    files[`${root}cloud-projects/${fname}`] = strToU8(
      JSON.stringify(
        {
          id: p.id,
          name: p.name,
          updated_at: p.updated_at,
          share_token: p.share_token ?? null,
          json: p.json,
        },
        null,
        2
      )
    );
  }
}

/** 全データをフォルダ構成の ZIP にまとめて返す */
export async function exportPortableArchiveZipAsync(opts?: {
  includeCloudProjects?: boolean;
}): Promise<{ blob: Blob; filename: string }> {
  const payload = await buildPortableArchiveAsync(opts);
  const stamp = backupStamp(payload.exportedAt);
  const root = `choreocore-backup-${stamp}`;
  const files: Record<string, Uint8Array> = {};
  addZipFilesFromArchive(files, `${root}/`, payload);
  const zipped = zipSync(files, { level: 6 });
  return {
    blob: new Blob([zipped], { type: "application/zip" }),
    filename: `${root}.zip`,
  };
}

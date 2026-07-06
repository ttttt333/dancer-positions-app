import { getSupabase } from "./supabaseClient";

/** `supabase/schema.sql` と Storage のバケット作成で同名にすること */
export const CHOREOCORE_AUDIO_BUCKET = "choreocore-audio";

/** Storage の download 失敗を共有閲覧向けに読みやすくする */
export function formatChoreocoreAudioDownloadError(
  path: string,
  rawMessage: string
): string {
  const msg = rawMessage.trim() || "音源のダウンロードに失敗しました";
  if (/object not found/i.test(msg)) {
    const p = path.trim() || "（パス未設定）";
    return (
      `Storage に音源がありません（${p}）。` +
      "エディタで音源を再取り込みしクラウド保存してください。" +
      "Supabase で `share-view-audio-policy.sql` を実行済みか、`choreocore_projects.json` の `audioSupabasePath` が Storage のオブジェクト名と完全一致しているか確認してください。"
    );
  }
  return msg;
}

function extFromFilename(name: string): string {
  const m = /\.([a-zA-Z0-9]{1,12})$/.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "bin";
}

/**
 * オブジェクトキーは `{auth.uid()}/{projectId}/{uuid}.{ext}`。
 * RLS は `split_part(name, '/', 1) = auth.uid()::text` で整合させる。
 */
export async function supabaseUploadProjectAudio(opts: {
  projectId: number;
  file: File | Blob;
  filename: string;
  contentType: string;
}): Promise<{ path: string; mime: string }> {
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error("ログインが必要です");
  }
  const uid = userData.user.id;
  const ext = extFromFilename(opts.filename);
  const objectId = crypto.randomUUID();
  const path = `${uid}/${Math.floor(opts.projectId)}/${objectId}.${ext}`;
  const { error } = await sb.storage.from(CHOREOCORE_AUDIO_BUCKET).upload(path, opts.file, {
    contentType: opts.contentType || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    throw new Error(
      error.message ||
        "ストレージへのアップロードに失敗しました（バケット choreocore-audio と RLS を確認してください）"
    );
  }
  return { path, mime: opts.contentType || "application/octet-stream" };
}

export async function supabaseDownloadProjectAudioBuffer(path: string): Promise<ArrayBuffer> {
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(CHOREOCORE_AUDIO_BUCKET).download(path);
  if (error) {
    throw new Error(
      formatChoreocoreAudioDownloadError(path, error.message || "")
    );
  }
  return data.arrayBuffer();
}

/** 署名付き URL で HTML5 Audio がストリーミング再生できる */
export async function supabaseGetProjectAudioSignedUrl(
  path: string,
  expiresInSec = 3600
): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.storage
    .from(CHOREOCORE_AUDIO_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "音源 URL の取得に失敗しました");
  }
  return data.signedUrl;
}

export async function supabaseDownloadProjectAudioWithCache(
  path: string,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal
): Promise<{ buffer: ArrayBuffer; mime: string }> {
  if (signal?.aborted) {
    throw new DOMException("Download aborted", "AbortError");
  }
  const {
    getCachedAudioBlob,
    putCachedAudioBlob,
    waveMediaCacheKeyForSupabase,
  } = await import("./waveMediaCache");
  const cacheKey = waveMediaCacheKeyForSupabase(path);
  const cached = await getCachedAudioBlob(cacheKey);
  if (cached) {
    if (signal?.aborted) {
      throw new DOMException("Download aborted", "AbortError");
    }
    onProgress?.(1);
    return { buffer: await cached.blob.arrayBuffer(), mime: cached.mime };
  }
  onProgress?.(0.05);
  const sb = getSupabase();
  const { data, error } = await sb.storage
    .from(CHOREOCORE_AUDIO_BUCKET)
    .download(path);
  if (signal?.aborted) {
    throw new DOMException("Download aborted", "AbortError");
  }
  if (error) {
    throw new Error(
      formatChoreocoreAudioDownloadError(path, error.message || "")
    );
  }
  onProgress?.(0.95);
  const buffer = await data.arrayBuffer();
  const mime = data.type || "application/octet-stream";
  void putCachedAudioBlob(cacheKey, new Blob([buffer], { type: mime }), mime);
  onProgress?.(1);
  return { buffer, mime };
}

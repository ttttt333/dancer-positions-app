import { getSupabase } from "./supabaseClient";

/** `supabase/schema.sql` と Storage のバケット作成で同名にすること */
export const CHOREOCORE_AUDIO_BUCKET = "choreocore-audio";

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
    throw new Error(error.message || "音源のダウンロードに失敗しました");
  }
  return data.arrayBuffer();
}

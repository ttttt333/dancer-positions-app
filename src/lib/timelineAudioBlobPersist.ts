/**
 * サーバ `audioAssetId` 用の署名付き Blob URL。TimelinePanel が名簿モード等でアンマウントされても
 * 同じ id なら再利用し、再フェッチ失敗や revoke 競合で音が消えるのを防ぐ。
 */
export let persistedServerAudioBlobUrl: string | null = null;
export let persistedServerAudioAssetId: number | null = null;

export let persistedSupabaseAudioBlobUrl: string | null = null;
export let persistedSupabaseAudioPath: string | null = null;

export function revokePersistedServerAudioBlob() {
  if (persistedServerAudioBlobUrl) {
    URL.revokeObjectURL(persistedServerAudioBlobUrl);
    persistedServerAudioBlobUrl = null;
    persistedServerAudioAssetId = null;
  }
}

export function revokePersistedSupabaseAudioBlob() {
  if (persistedSupabaseAudioBlobUrl) {
    URL.revokeObjectURL(persistedSupabaseAudioBlobUrl);
    persistedSupabaseAudioBlobUrl = null;
    persistedSupabaseAudioPath = null;
  }
}

/** `blob:` URL の revoke。クラウド用に保持している URL は専用 revoke に回す */
export function revokeBlobUrlUnlessCloudPersisted(cur: string | null) {
  if (!cur) return;
  if (cur === persistedServerAudioBlobUrl) revokePersistedServerAudioBlob();
  else if (cur === persistedSupabaseAudioBlobUrl) revokePersistedSupabaseAudioBlob();
  else URL.revokeObjectURL(cur);
}

export function setPersistedServerAudio(blobUrl: string, assetId: number) {
  persistedServerAudioBlobUrl = blobUrl;
  persistedServerAudioAssetId = assetId;
}

export function setPersistedSupabaseAudio(blobUrl: string, path: string) {
  persistedSupabaseAudioBlobUrl = blobUrl;
  persistedSupabaseAudioPath = path;
}

/** 既に `blob:` で持っている音源から波形用バッファを取る（Storage／API の二重取得を避ける） */
export async function arrayBufferFromBlobUrl(blobUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(blobUrl);
  if (!res.ok) throw new Error("blob URL の読み込みに失敗しました");
  return res.arrayBuffer();
}

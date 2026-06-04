import { usePlaybackAudioStore } from "../store/playbackAudioStore";

/**
 * サーバ `audioAssetId` 用の署名付き Blob URL。TimelinePanel が名簿モード等でアンマウントされても
 * 同じ id なら再利用し、再フェッチ失敗や revoke 競合で音が消えるのを防ぐ。
 */
export let persistedServerAudioBlobUrl: string | null = null;
export let persistedServerAudioAssetId: number | null = null;

/** 短命 blob URL（OS が破棄しうる）。正は persistedSupabaseAudioPath */
export let persistedSupabaseAudioBlobUrl: string | null = null;
export let persistedSupabaseAudioPath: string | null = null;

/** フローライブラリ埋め込み音源（IndexedDB キーと blob URL の対） */
export let persistedFlowLocalAudioKey: string | null = null;
export let persistedFlowAudioBlobUrl: string | null = null;

export function revokePersistedServerAudioBlob() {
  if (persistedServerAudioBlobUrl) {
    URL.revokeObjectURL(persistedServerAudioBlobUrl);
    persistedServerAudioBlobUrl = null;
    persistedServerAudioAssetId = null;
  }
}

/** 短命 blob URL のみ破棄（Supabase パスは保持 → Cache API から再生成可能） */
export function revokeEphemeralSupabaseBlobUrl() {
  if (persistedSupabaseAudioBlobUrl) {
    URL.revokeObjectURL(persistedSupabaseAudioBlobUrl);
    persistedSupabaseAudioBlobUrl = null;
  }
  usePlaybackAudioStore.getState().setEphemeralBlobUrl(null);
}

/** Supabase 音源の参照を完全に外す（作品切替時） */
export function clearSupabaseAudioSource() {
  revokeEphemeralSupabaseBlobUrl();
  persistedSupabaseAudioPath = null;
  const s = usePlaybackAudioStore.getState().source;
  if (s?.kind === "supabase") {
    usePlaybackAudioStore.getState().clearSource();
  }
}

/** @deprecated パスも消す。作品切替時のみ使う */
export function revokePersistedSupabaseAudioBlob() {
  clearSupabaseAudioSource();
}

export function revokePersistedFlowAudioBlob() {
  if (persistedFlowAudioBlobUrl) {
    URL.revokeObjectURL(persistedFlowAudioBlobUrl);
    persistedFlowAudioBlobUrl = null;
    persistedFlowLocalAudioKey = null;
  }
}

export function setPersistedFlowAudio(blobUrl: string, flowKey: string) {
  persistedFlowAudioBlobUrl = blobUrl;
  persistedFlowLocalAudioKey = flowKey;
  usePlaybackAudioStore.getState().setFlowSource(flowKey);
  usePlaybackAudioStore.getState().setEphemeralBlobUrl(blobUrl);
}

/** `blob:` URL の revoke。クラウド用に保持している URL は専用 revoke に回す */
export function revokeBlobUrlUnlessCloudPersisted(cur: string | null) {
  if (!cur) return;
  if (cur === persistedServerAudioBlobUrl) revokePersistedServerAudioBlob();
  else if (cur === persistedSupabaseAudioBlobUrl) revokeEphemeralSupabaseBlobUrl();
  else if (cur === persistedFlowAudioBlobUrl) revokePersistedFlowAudioBlob();
  else URL.revokeObjectURL(cur);
}

export function setPersistedServerAudio(blobUrl: string, assetId: number) {
  persistedServerAudioBlobUrl = blobUrl;
  persistedServerAudioAssetId = assetId;
  usePlaybackAudioStore.getState().setServerSource(assetId);
  usePlaybackAudioStore.getState().setEphemeralBlobUrl(blobUrl);
}

export function setPersistedSupabaseAudio(blobUrl: string, path: string) {
  persistedSupabaseAudioBlobUrl = blobUrl;
  persistedSupabaseAudioPath = path;
  usePlaybackAudioStore.getState().setSupabaseSource(path);
  usePlaybackAudioStore.getState().setEphemeralBlobUrl(blobUrl);
}

/** 既に `blob:` で持っている音源から波形用バッファを取る（Storage／API の二重取得を避ける） */
export async function arrayBufferFromBlobUrl(blobUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(blobUrl);
  if (!res.ok) throw new Error("blob URL の読み込みに失敗しました");
  return res.arrayBuffer();
}

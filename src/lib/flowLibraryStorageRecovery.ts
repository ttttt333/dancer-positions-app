/**
 * 名前付きフローを消さずに、origin の空きを作る。
 * 消してよいのは再取得できる音源キャッシュ、再計算できる波形キャッシュ、
 * 注釈の undo、どのフローからも参照されない音源ブロブだけ。
 */
import { clearBlindHistoryStorage } from "../pages/annotation/sessionHistory";
import {
  deleteUnreferencedFlowLibraryAudio,
  getFlowLibraryAudio,
} from "./flowLibraryLocalAudio";
import { clearDisposableWaveMediaCaches } from "./waveMediaCache";
import { clearAllWavePeaksCache } from "./wavePeaksCache";

const HEADROOM_BYTES = 48 * 1024 * 1024;

type AudioKeyed = {
  memento?: { flowEmbeddedAudioKey?: string };
};

export function collectFlowAudioKeys(items: readonly AudioKeyed[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    const key = item.memento?.flowEmbeddedAudioKey;
    if (typeof key === "string" && key.length > 0) keys.add(key);
  }
  return keys;
}

export function collectFlowAudioKeysFromUnknown(raw: unknown): Set<string> {
  const keys = new Set<string>();
  const visit = (item: unknown) => {
    if (item == null || typeof item !== "object") return;
    const memento = (item as AudioKeyed).memento;
    const key = memento?.flowEmbeddedAudioKey;
    if (typeof key === "string" && key.length > 0) keys.add(key);
  };
  if (Array.isArray(raw)) {
    for (const item of raw) visit(item);
    return keys;
  }
  visit(raw);
  return keys;
}

export async function originStorageIsTight(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return false;
    const { quota, usage } = await navigator.storage.estimate();
    if (quota == null || usage == null) return false;
    return quota - usage < HEADROOM_BYTES;
  } catch {
    return false;
  }
}

/** 参照中の音源キーは残す。失敗しても保存処理は続行する。 */
export async function freeDisposableOriginStorage(keepAudioKeys: ReadonlySet<string>): Promise<void> {
  try {
    clearBlindHistoryStorage();
  } catch {
    /** ignore */
  }
  await clearDisposableWaveMediaCaches();
  await clearAllWavePeaksCache();
  await deleteUnreferencedFlowLibraryAudio(keepAudioKeys);
}

export async function sweepUnreferencedFlowAudio(keepAudioKeys: ReadonlySet<string>): Promise<void> {
  await deleteUnreferencedFlowLibraryAudio(keepAudioKeys);
}

async function fingerprintBlob(blob: Blob): Promise<string | null> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const buf = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const hex = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${buf.byteLength}:${hex}`;
  } catch {
    return null;
  }
}

/**
 * 同じバイト列の音源が別キーで重複しているとき、残すキーへ付け替える。
 * 古いキーの削除はカタログ書き込み成功後に行う（失敗しても音が消えないように）。
 */
export async function dedupeFlowAudioOnItems<T extends AudioKeyed>(
  items: T[]
): Promise<{ items: T[]; retireKeys: string[] }> {
  const keys = [...collectFlowAudioKeys(items)];
  if (keys.length < 2) return { items, retireKeys: [] };
  const canonicalByHash = new Map<string, string>();
  const remap = new Map<string, string>();
  for (const key of keys) {
    const blob = await getFlowLibraryAudio(key);
    if (!blob || blob.size === 0) continue;
    const hash = await fingerprintBlob(blob);
    if (!hash) continue;
    const canonical = canonicalByHash.get(hash);
    if (canonical && canonical !== key) {
      remap.set(key, canonical);
    } else if (!canonical) {
      canonicalByHash.set(hash, key);
    }
  }
  if (remap.size === 0) return { items, retireKeys: [] };
  const next = items.map((item) => {
    const key = item.memento?.flowEmbeddedAudioKey;
    const canonical = key ? remap.get(key) : undefined;
    if (!key || !canonical) return item;
    return {
      ...item,
      memento: { ...item.memento, flowEmbeddedAudioKey: canonical },
    };
  });
  return { items: next, retireKeys: [...remap.keys()] };
}

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "choreocore_wave_peaks_v1";
const DB_VERSION = 1;
const STORE = "peaks" as const;

export type WavePeaksCacheEntry = {
  key: string;
  peaks: number[];
  durationSec: number;
  updatedAt: number;
};

interface WavePeaksDb extends DBSchema {
  [STORE]: {
    key: string;
    value: WavePeaksCacheEntry;
  };
}

const memoryCache = new Map<string, WavePeaksCacheEntry>();

let dbPromise: Promise<IDBPDatabase<WavePeaksDb>> | null = null;

function getDb(): Promise<IDBPDatabase<WavePeaksDb>> {
  if (!dbPromise) {
    dbPromise = openDB<WavePeaksDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export function wavePeaksCacheKeyForServerAsset(assetId: number): string {
  return `server:${assetId}`;
}

export function wavePeaksCacheKeyForSupabase(path: string): string {
  return `supabase:${path.trim()}`;
}

export function wavePeaksCacheKeyForFlow(key: string): string {
  return `flow:${key}`;
}

export async function getWavePeaksCache(
  key: string
): Promise<WavePeaksCacheEntry | null> {
  const mem = memoryCache.get(key);
  if (mem?.peaks.length) return mem;
  try {
    const db = await getDb();
    const row = await db.get(STORE, key);
    if (!row?.peaks?.length) return null;
    memoryCache.set(key, row);
    return row;
  } catch {
    return null;
  }
}

/** バックアップ用: IndexedDB の波形ピークをすべて書き出す */
export async function exportAllWavePeaksCache(): Promise<
  Record<string, { peaks: number[]; durationSec: number }>
> {
  const out: Record<string, { peaks: number[]; durationSec: number }> = {};
  try {
    const db = await getDb();
    const rows = await db.getAll(STORE);
    for (const row of rows) {
      if (!row?.key || !row.peaks?.length) continue;
      out[row.key] = { peaks: row.peaks, durationSec: row.durationSec };
    }
  } catch {
    /** ignore */
  }
  return out;
}

/** バックアップから波形ピークキャッシュを復元 */
export async function importAllWavePeaksCache(
  entries: Record<string, { peaks: number[]; durationSec: number }>
): Promise<number> {
  let n = 0;
  for (const [key, v] of Object.entries(entries)) {
    if (!key || !Array.isArray(v?.peaks) || !v.peaks.length) continue;
    await setWavePeaksCache(key, v.peaks, v.durationSec);
    n++;
  }
  return n;
}

export async function setWavePeaksCache(
  key: string,
  peaks: number[],
  durationSec: number
): Promise<void> {
  if (!peaks.length) return;
  const entry: WavePeaksCacheEntry = {
    key,
    peaks,
    durationSec,
    updatedAt: Date.now(),
  };
  memoryCache.set(key, entry);
  try {
    const db = await getDb();
    await db.put(STORE, entry);
  } catch {
    /* IndexedDB 不可でもメモリキャッシュは有効 */
  }
}

/**
 * フローライブラリ用: ローカル取り込み音源を localStorage ではなく IndexedDB に保持する。
 * localStorage の JSON には入らない大きなバイナリを、フロー 1 件あたり 1 キーで保存する。
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "choreocore_flow_library_audio_v1";
const DB_VERSION = 1;
const STORE = "blobs" as const;

type FlowAudioRow = {
  key: string;
  blob: Blob;
  createdAt: number;
};

interface FlowAudioDb extends DBSchema {
  [STORE]: {
    key: string;
    value: FlowAudioRow;
  };
}

let dbPromise: Promise<IDBPDatabase<FlowAudioDb>> | null = null;

function getDb(): Promise<IDBPDatabase<FlowAudioDb>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<FlowAudioDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    },
  });
  return dbPromise;
}

export async function putFlowLibraryAudio(key: string, blob: Blob): Promise<void> {
  const db = await getDb();
  const row: FlowAudioRow = { key, blob, createdAt: Date.now() };
  await db.put(STORE, row);
}

export async function getFlowLibraryAudio(key: string): Promise<Blob | null> {
  if (!key) return null;
  try {
    const db = await getDb();
    const row = await db.get(STORE, key);
    if (!row || !(row.blob instanceof Blob)) return null;
    return row.blob;
  } catch {
    return null;
  }
}

export async function deleteFlowLibraryAudio(key: string): Promise<void> {
  if (!key) return;
  try {
    const db = await getDb();
    await db.delete(STORE, key);
  } catch {
    /** 無視 */
  }
}

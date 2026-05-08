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
  if (!dbPromise) {
    dbPromise = openDB<FlowAudioDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

/** バックアップ用: IndexedDB に入っている音源キー一覧 */
export async function listFlowLibraryAudioKeys(): Promise<string[]> {
  try {
    const db = await getDb();
    const keys = await db.getAllKeys(STORE);
    return keys.map((k) => String(k));
  } catch {
    return [];
  }
}

/** バックアップ用: キー → Base64（`portableChoreoBackup` から利用） */
export async function exportFlowLibraryAudioBackupMap(): Promise<
  Record<string, { mime: string; base64: string }>
> {
  const keys = await listFlowLibraryAudioKeys();
  const out: Record<string, { mime: string; base64: string }> = {};
  for (const key of keys) {
    const blob = await getFlowLibraryAudio(key);
    if (!blob || blob.size === 0) continue;
    const ab = await blob.arrayBuffer();
    out[key] = {
      mime: blob.type || "application/octet-stream",
      base64: uint8ToBase64(new Uint8Array(ab)),
    };
  }
  return out;
}

/** バックアップから IndexedDB 音源を復元 */
export async function importFlowLibraryAudioBackupMap(
  entries: Record<string, { mime: string; base64: string }>
): Promise<void> {
  for (const [k, v] of Object.entries(entries)) {
    if (!k || !v?.base64) continue;
    const bytes = base64ToUint8(v.base64);
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await putFlowLibraryAudio(
      k,
      new Blob([ab], { type: v.mime || "application/octet-stream" })
    );
  }
}

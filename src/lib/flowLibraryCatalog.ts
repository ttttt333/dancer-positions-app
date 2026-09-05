/**
 * フローライブラリ本体の保存先。
 * localStorage（約 5MB）ではなく IndexedDB に置き、曲数・波形ピークで溢れないようにする。
 * ブラウザのディスク上限自体は残る（通常は数百 MB〜）。
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "choreocore_flow_library_catalog_v1";
const DB_VERSION = 1;
const STORE = "catalog" as const;
const ALL_KEY = "all";

type CatalogRow = {
  key: string;
  items: unknown[];
  updatedAt: number;
};

interface CatalogDb extends DBSchema {
  [STORE]: {
    key: string;
    value: CatalogRow;
  };
}

let dbPromise: Promise<IDBPDatabase<CatalogDb>> | null = null;

function getDb(): Promise<IDBPDatabase<CatalogDb>> {
  if (!dbPromise) {
    dbPromise = openDB<CatalogDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function readFlowLibraryCatalogRaw(): Promise<unknown[] | null> {
  try {
    const db = await getDb();
    const row = await db.get(STORE, ALL_KEY);
    if (!row || !Array.isArray(row.items)) return null;
    return row.items;
  } catch {
    return null;
  }
}

export async function writeFlowLibraryCatalogRaw(items: unknown[]): Promise<void> {
  const db = await getDb();
  const row: CatalogRow = {
    key: ALL_KEY,
    items,
    updatedAt: Date.now(),
  };
  await db.put(STORE, row);
}

/** テスト用。本番の削除フローでは使わない。 */
export async function clearFlowLibraryCatalogRaw(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, ALL_KEY);
  } catch {
    /** 無視 */
  }
}

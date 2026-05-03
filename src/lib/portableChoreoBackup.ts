import { openDB } from "idb";
import { FORMATION_BOX_CHANGE_EVENT } from "./formationBox";
import { FLOW_LIBRARY_CHANGE_EVENT } from "./flowLibrary";
import {
  exportFlowLibraryAudioBackupMap,
  importFlowLibraryAudioBackupMap,
} from "./flowLibraryLocalAudio";
import { projectApi, getToken, isDemoSessionToken } from "../api/client";

/** `VideoPage` と同じ DB 名・バージョン（変更時は両方を揃えること） */
const VIDEO_DB_NAME = "dancer-video-module";
const VIDEO_DB_VERSION = 1;

export const PORTABLE_ARCHIVE_FORMAT = "choreocore-portable-archive-v1" as const;

const LOCALSTORAGE_EXACT_KEYS = [
  "choreogrid_flow_library_v1",
  "choreogrid_formation_box_v1",
  "choreogrid_stage_presets_v1",
  "choreogrid_locale",
  "dancer-positions.editorLayout.v2",
  "dancer-positions.editorLayout.v1",
  "dance_stage_positions_v1",
] as const;

const VIEWER_KEY_PREFIX = "choreoViewerMemberV1:";

export type PortableArchiveV1 = {
  format: typeof PORTABLE_ARCHIVE_FORMAT;
  exportedAt: string;
  appLabel: string;
  /** 認証トークンは含めない（セキュリティ） */
  localStorage: Record<string, string>;
  flowLibraryIndexedAudio?: Record<string, { mime: string; base64: string }>;
  videoModule?: {
    meta: Array<{
      id: string;
      name: string;
      mirror: boolean;
      playbackRate: number;
      bookmarks: number[];
      updatedAt: string;
    }>;
    blobs: Record<string, string>;
  };
  /** オプション: ログイン中に書き出したクラウド作品（取り込み時は新規作品として作成可能） */
  cloudProjects?: Array<{
    id: number;
    name: string;
    updated_at: string;
    json: unknown;
    share_token?: string | null;
  }>;
};

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

import { safeGetItem } from "../utils/storage";

function collectLocalStorageSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of LOCALSTORAGE_EXACT_KEYS) {
    const v = safeGetItem(k, null as any);
    if (v != null && v.length > 0) out[k] = v;
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(VIEWER_KEY_PREFIX)) continue;
      const v = safeGetItem(k, null as any);
      if (v != null) out[k] = v;
    }
  } catch {
    /** ignore */
  }
  return out;
}

type VideoMetaRow = {
  id: string;
  name: string;
  mirror: boolean;
  playbackRate: number;
  bookmarks: number[];
  updatedAt: string;
};

async function exportVideoModuleSnapshot(): Promise<PortableArchiveV1["videoModule"]> {
  try {
    const db = await openDB(VIDEO_DB_NAME, VIDEO_DB_VERSION);
    if (!db.objectStoreNames.contains("meta") || !db.objectStoreNames.contains("blobs")) {
      return undefined;
    }
    const meta = (await db.getAll("meta")) as VideoMetaRow[];
    if (!Array.isArray(meta) || meta.length === 0) return undefined;
    const blobs: Record<string, string> = {};
    for (const m of meta) {
      const id = m.id;
      if (!id) continue;
      const buf = (await db.get("blobs", id)) as ArrayBuffer | undefined;
      if (buf && buf.byteLength > 0) {
        blobs[id] = uint8ToBase64(new Uint8Array(buf));
      }
    }
    return { meta, blobs };
  } catch {
    return undefined;
  }
}

async function importVideoModuleSnapshot(
  snap: NonNullable<PortableArchiveV1["videoModule"]>
): Promise<void> {
  const db = await openDB(VIDEO_DB_NAME, VIDEO_DB_VERSION, {
    upgrade(db0) {
      if (!db0.objectStoreNames.contains("meta")) {
        db0.createObjectStore("meta", { keyPath: "id" });
      }
      if (!db0.objectStoreNames.contains("blobs")) {
        db0.createObjectStore("blobs");
      }
    },
  });
  for (const m of snap.meta) {
    await db.put("meta", m);
  }
  for (const [id, b64] of Object.entries(snap.blobs ?? {})) {
    if (!id || !b64) continue;
    const u8 = base64ToUint8(b64);
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    await db.put("blobs", ab, id);
  }
}

function isPortableArchiveV1(x: unknown): x is PortableArchiveV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.format === PORTABLE_ARCHIVE_FORMAT &&
    typeof o.exportedAt === "string" &&
    o.localStorage != null &&
    typeof o.localStorage === "object" &&
    !Array.isArray(o.localStorage)
  );
}

export async function exportPortableArchiveJsonAsync(opts?: {
  /** ログイン中のみ。作品ごとに API で取得するため時間がかかることがあります */
  includeCloudProjects?: boolean;
}): Promise<string> {
  const localStorageSnap = collectLocalStorageSnapshot();
  const flowLibraryIndexedAudio = await exportFlowLibraryAudioBackupMap();
  const videoModule = await exportVideoModuleSnapshot();

  let cloudProjects: PortableArchiveV1["cloudProjects"];
  if (opts?.includeCloudProjects && getToken() && !isDemoSessionToken()) {
    const list = await projectApi.list();
    cloudProjects = [];
    for (const row of list) {
      try {
        const full = await projectApi.get(row.id);
        cloudProjects.push({
          id: full.id,
          name: full.name,
          updated_at: full.updated_at,
          json: full.json,
          share_token: full.share_token ?? null,
        });
      } catch {
        /** 1 件失敗しても続行 */
      }
    }
  }

  const payload: PortableArchiveV1 = {
    format: PORTABLE_ARCHIVE_FORMAT,
    exportedAt: new Date().toISOString(),
    appLabel: "ChoreoCore / dancer-positions-app",
    localStorage: localStorageSnap,
    ...(Object.keys(flowLibraryIndexedAudio).length > 0
      ? { flowLibraryIndexedAudio }
      : {}),
    ...(videoModule && (videoModule.meta?.length || Object.keys(videoModule.blobs ?? {}).length)
      ? { videoModule }
      : {}),
    ...(cloudProjects && cloudProjects.length > 0 ? { cloudProjects } : {}),
  };

  return JSON.stringify(payload, null, 2);
}

export type PortableImportResult = {
  ok: boolean;
  message: string;
  restoredLocalStorageKeys: number;
  restoredFlowAudioKeys: number;
  restoredVideoMeta: number;
  cloudProjectsCreated: number;
};

export async function importPortableArchiveJsonAsync(
  text: string,
  opts?: { importCloudProjectsAsNew?: boolean }
): Promise<PortableImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "JSON の解析に失敗しました。",
      restoredLocalStorageKeys: 0,
      restoredFlowAudioKeys: 0,
      restoredVideoMeta: 0,
      cloudProjectsCreated: 0,
    };
  }

  if (!isPortableArchiveV1(parsed)) {
    return {
      ok: false,
      message: `形式が違います（${PORTABLE_ARCHIVE_FORMAT} のバックアップ JSON を選んでください）。`,
      restoredLocalStorageKeys: 0,
      restoredFlowAudioKeys: 0,
      restoredVideoMeta: 0,
      cloudProjectsCreated: 0,
    };
  }

  const data = parsed;

  try {
    if (data.flowLibraryIndexedAudio && Object.keys(data.flowLibraryIndexedAudio).length > 0) {
      await importFlowLibraryAudioBackupMap(data.flowLibraryIndexedAudio);
    }

    let lsCount = 0;
    for (const [k, v] of Object.entries(data.localStorage)) {
      if (typeof v !== "string") continue;
      try {
        localStorage.setItem(k, v);
        lsCount++;
      } catch (e) {
        return {
          ok: false,
          message:
            e instanceof Error
              ? `localStorage への書き込みに失敗しました: ${e.message}（容量不足の可能性があります）`
              : "localStorage への書き込みに失敗しました。",
          restoredLocalStorageKeys: lsCount,
          restoredFlowAudioKeys: Object.keys(data.flowLibraryIndexedAudio ?? {}).length,
          restoredVideoMeta: 0,
          cloudProjectsCreated: 0,
        };
      }
    }

    let videoMeta = 0;
    if (data.videoModule?.meta?.length) {
      await importVideoModuleSnapshot(data.videoModule);
      videoMeta = data.videoModule.meta.length;
    }

    let cloudProjectsCreated = 0;
    if (
      opts?.importCloudProjectsAsNew &&
      Array.isArray(data.cloudProjects) &&
      data.cloudProjects.length > 0 &&
      getToken() &&
      !isDemoSessionToken()
    ) {
      for (const row of data.cloudProjects) {
        if (!row || typeof row.name !== "string" || row.json === undefined) continue;
        try {
          const name = `${row.name}`.trim() || "Imported";
          await projectApi.create(name, row.json);
          cloudProjectsCreated++;
        } catch {
          /** 続行 */
        }
      }
    }

    try {
      window.dispatchEvent(new Event(FLOW_LIBRARY_CHANGE_EVENT));
    } catch {
      /** ignore */
    }
    try {
      window.dispatchEvent(new Event(FORMATION_BOX_CHANGE_EVENT));
    } catch {
      /** ignore */
    }

    const parts = [
      `localStorage ${lsCount} キー`,
      data.flowLibraryIndexedAudio
        ? `フロー用音源 ${Object.keys(data.flowLibraryIndexedAudio).length} 件`
        : null,
      videoMeta > 0 ? `動画モジュール ${videoMeta} 件` : null,
      cloudProjectsCreated > 0 ? `クラウド新規作品 ${cloudProjectsCreated} 件` : null,
    ].filter(Boolean);

    return {
      ok: true,
      message: `取り込みが完了しました（${parts.join("・")}）。`,
      restoredLocalStorageKeys: lsCount,
      restoredFlowAudioKeys: Object.keys(data.flowLibraryIndexedAudio ?? {}).length,
      restoredVideoMeta: videoMeta,
      cloudProjectsCreated,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "取り込み中にエラーが発生しました。",
      restoredLocalStorageKeys: 0,
      restoredFlowAudioKeys: 0,
      restoredVideoMeta: 0,
      cloudProjectsCreated: 0,
    };
  }
}

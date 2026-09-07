/**
 * ログインユーザの端末横断ライブラリ同期。
 *
 * 対象（localStorage）:
 * - 形の箱（保存した立ち位置）
 * - ステージプリセット（舞台設定）
 * - 雛形お気に入り
 *
 * 作品 JSON（舞台寸法・props・savedSpotLayouts）は既存の project autosave が担当。
 * デモセッションでは動かない。Supabase 未設定時も no-op。
 */

import { isDemoSessionToken } from "../api/client";
import {
  FORMATION_BOX_CHANGE_EVENT,
  listFormationBoxItems,
  mergeFormationBoxItems,
  type FormationBoxItem,
} from "./formationBox";
import {
  FORMATION_PRESET_FAVORITES_CHANGE_EVENT,
  loadFormationPresetFavoritesState,
  mergeFormationPresetFavorites,
} from "./formationPresetFavorites";
import {
  getSupabase,
  isSupabaseBackend,
  requireSupabaseAuthSession,
} from "./supabaseClient";
import {
  listStagePresets,
  mergeStagePresetItems,
  STAGE_PRESETS_CHANGE_EVENT,
  type StagePresetItem,
} from "./stagePresets";

export const USER_LIBRARY_TABLE = "choreocore_user_library";
export const USER_LIBRARY_SYNC_STATUS_EVENT = "userLibrary:syncStatus";

const PUSH_DEBOUNCE_MS = 1600;

export type UserLibraryPayloadV1 = {
  v: 1;
  formationBox: FormationBoxItem[];
  stagePresets: StagePresetItem[];
  presetFavorites: { ids: string[]; updatedAt: number };
  clientUpdatedAt: number;
};

export type UserLibrarySyncState =
  | "idle"
  | "syncing"
  | "synced"
  | "error"
  | "skipped";

export type UserLibrarySyncStatus = {
  state: UserLibrarySyncState;
  message?: string;
  lastSyncedAt?: number;
  /** 直近 pull でローカルが増えた／更新されたか */
  mergedFromRemote?: boolean;
};

export type UserLibraryPullResult = {
  ok: boolean;
  mergedFromRemote: boolean;
  pushed: boolean;
  error?: string;
  /** テーブル未作成など運用側の問題 */
  tableMissing?: boolean;
};

let syncingFromRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let status: UserLibrarySyncStatus = { state: "idle" };
let lastPushedFingerprint = "";

function setStatus(next: UserLibrarySyncStatus): void {
  status = next;
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(USER_LIBRARY_SYNC_STATUS_EVENT, { detail: next })
    );
  } catch {
    /* ignore */
  }
}

export function getUserLibrarySyncStatus(): UserLibrarySyncStatus {
  return status;
}

export function isUserLibrarySyncEnabled(): boolean {
  return isSupabaseBackend() && !isDemoSessionToken();
}

function errMsg(
  e: { message?: string; code?: string } | null,
  fallback: string
): string {
  if (
    e?.code === "PGRST205" ||
    e?.message?.includes(USER_LIBRARY_TABLE) ||
    e?.message?.includes("schema cache")
  ) {
    return `Supabase に ${USER_LIBRARY_TABLE} テーブルがありません。migrations/022_user_library.up.sql を実行してください。`;
  }
  if (e && typeof e.message === "string" && e.message) return e.message;
  return fallback;
}

function isTableMissingError(e: { message?: string; code?: string } | null): boolean {
  return (
    e?.code === "PGRST205" ||
    Boolean(e?.message?.includes(USER_LIBRARY_TABLE)) ||
    Boolean(e?.message?.includes("Could not find the table"))
  );
}

function fingerprintPayload(p: UserLibraryPayloadV1): string {
  return JSON.stringify({
    formationBox: p.formationBox,
    stagePresets: p.stagePresets,
    presetFavorites: p.presetFavorites,
  });
}

export function buildLocalUserLibraryPayload(
  now: number = Date.now()
): UserLibraryPayloadV1 {
  const fav = loadFormationPresetFavoritesState();
  return {
    v: 1,
    formationBox: listFormationBoxItems(),
    stagePresets: listStagePresets(),
    presetFavorites: {
      ids: fav.ids,
      updatedAt: fav.updatedAt ?? 0,
    },
    clientUpdatedAt: now,
  };
}

function isPayloadV1(x: unknown): x is UserLibraryPayloadV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === 1 &&
    Array.isArray(o.formationBox) &&
    Array.isArray(o.stagePresets) &&
    typeof o.presetFavorites === "object" &&
    o.presetFavorites !== null
  );
}

/**
 * リモート payload をローカルへマージする（pure-ish: localStorage を更新）。
 * 呼び出し側で push するか決める。
 */
export function applyRemoteUserLibraryPayload(remote: UserLibraryPayloadV1): {
  mergedFromRemote: boolean;
} {
  syncingFromRemote = true;
  try {
    const box = mergeFormationBoxItems(remote.formationBox);
    const presets = mergeStagePresetItems(remote.stagePresets);
    const fav = mergeFormationPresetFavorites(remote.presetFavorites);
    const mergedFromRemote =
      box.changed || presets.changed || fav.changed;
    return { mergedFromRemote };
  } finally {
    syncingFromRemote = false;
  }
}

async function fetchRemotePayload(): Promise<{
  payload: UserLibraryPayloadV1 | null;
  tableMissing?: boolean;
  error?: string;
}> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from(USER_LIBRARY_TABLE)
    .select("payload")
    .maybeSingle();
  if (error) {
    return {
      payload: null,
      tableMissing: isTableMissingError(error),
      error: errMsg(error, "ライブラリの取得に失敗しました"),
    };
  }
  if (!data?.payload) return { payload: null };
  if (!isPayloadV1(data.payload)) return { payload: null };
  return { payload: data.payload };
}

export async function pushUserLibraryNow(): Promise<{
  ok: boolean;
  error?: string;
  tableMissing?: boolean;
  skipped?: boolean;
}> {
  if (!isUserLibrarySyncEnabled()) {
    return { ok: true, skipped: true };
  }
  const okSession = await requireSupabaseAuthSession();
  if (!okSession) {
    return { ok: false, error: "ログインが必要です" };
  }

  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: "ログインが必要です" };
  }

  const payload = buildLocalUserLibraryPayload();
  const fp = fingerprintPayload(payload);
  if (fp === lastPushedFingerprint) {
    return { ok: true, skipped: true };
  }

  const nowIso = new Date().toISOString();
  const { error } = await sb.from(USER_LIBRARY_TABLE).upsert(
    {
      user_id: userData.user.id,
      payload,
      updated_at: nowIso,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    return {
      ok: false,
      tableMissing: isTableMissingError(error),
      error: errMsg(error, "ライブラリの同期に失敗しました"),
    };
  }
  lastPushedFingerprint = fp;
  setStatus({
    state: "synced",
    lastSyncedAt: Date.now(),
    message: undefined,
  });
  return { ok: true };
}

export function scheduleUserLibraryPush(): void {
  if (!isUserLibrarySyncEnabled() || syncingFromRemote) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void (async () => {
      setStatus({ ...status, state: "syncing" });
      const result = await pushUserLibraryNow();
      if (!result.ok) {
        setStatus({
          state: "error",
          message: result.error,
          lastSyncedAt: status.lastSyncedAt,
        });
      }
    })();
  }, PUSH_DEBOUNCE_MS);
}

export function cancelScheduledUserLibraryPush(): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

/**
 * ログイン直後: pull → merge → push（ローカル側の新規分もクラウドへ）。
 */
export async function pullMergePushUserLibrary(): Promise<UserLibraryPullResult> {
  if (!isUserLibrarySyncEnabled()) {
    setStatus({ state: "skipped" });
    return { ok: true, mergedFromRemote: false, pushed: false };
  }

  setStatus({ state: "syncing" });
  const okSession = await requireSupabaseAuthSession();
  if (!okSession) {
    setStatus({ state: "error", message: "ログインが必要です" });
    return {
      ok: false,
      mergedFromRemote: false,
      pushed: false,
      error: "ログインが必要です",
    };
  }

  const remote = await fetchRemotePayload();
  if (remote.error) {
    setStatus({
      state: "error",
      message: remote.error,
    });
    return {
      ok: false,
      mergedFromRemote: false,
      pushed: false,
      error: remote.error,
      tableMissing: remote.tableMissing,
    };
  }

  let mergedFromRemote = false;
  if (remote.payload) {
    mergedFromRemote = applyRemoteUserLibraryPayload(remote.payload).mergedFromRemote;
  }

  // リモート適用後のローカルを指紋として登録し、無変更 push を抑制できるようにする
  if (remote.payload && !mergedFromRemote) {
    lastPushedFingerprint = fingerprintPayload(remote.payload);
  } else {
    lastPushedFingerprint = "";
  }

  const push = await pushUserLibraryNow();
  if (!push.ok) {
    setStatus({
      state: "error",
      message: push.error,
      mergedFromRemote,
    });
    return {
      ok: false,
      mergedFromRemote,
      pushed: false,
      error: push.error,
      tableMissing: push.tableMissing,
    };
  }

  setStatus({
    state: "synced",
    lastSyncedAt: Date.now(),
    mergedFromRemote,
  });
  return { ok: true, mergedFromRemote, pushed: !push.skipped };
}

/** ローカルライブラリ変更を監視して debounce push */
export function bindUserLibraryLocalChangeListeners(): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = () => scheduleUserLibraryPush();
  window.addEventListener(FORMATION_BOX_CHANGE_EVENT, onChange);
  window.addEventListener(STAGE_PRESETS_CHANGE_EVENT, onChange);
  window.addEventListener(FORMATION_PRESET_FAVORITES_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener(FORMATION_BOX_CHANGE_EVENT, onChange);
    window.removeEventListener(STAGE_PRESETS_CHANGE_EVENT, onChange);
    window.removeEventListener(FORMATION_PRESET_FAVORITES_CHANGE_EVENT, onChange);
    cancelScheduledUserLibraryPush();
  };
}

/** テスト用: 指紋・状態を初期化 */
export function resetUserLibrarySyncForTests(): void {
  cancelScheduledUserLibraryPush();
  lastPushedFingerprint = "";
  syncingFromRemote = false;
  status = { state: "idle" };
}

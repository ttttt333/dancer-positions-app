import { useEffect, useState } from "react";
import { isDemoSessionToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  bindUserLibraryLocalChangeListeners,
  cancelScheduledUserLibraryPush,
  getUserLibrarySyncStatus,
  pullMergePushUserLibrary,
  USER_LIBRARY_SYNC_STATUS_EVENT,
  type UserLibrarySyncStatus,
} from "../lib/userLibrarySync";
import { isSupabaseBackend } from "../lib/supabaseClient";

/**
 * ログイン中に形の箱・舞台プリセット・雛形お気に入りをクラウドと同期する。
 * App 直下で一度だけマウントする。
 */
export function useUserLibraryCloudSync(): void {
  const { ready, me } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!me || isDemoSessionToken() || !isSupabaseBackend()) {
      cancelScheduledUserLibraryPush();
      return;
    }

    let cancelled = false;
    const unbind = bindUserLibraryLocalChangeListeners();

    void (async () => {
      if (cancelled) return;
      await pullMergePushUserLibrary();
    })();

    return () => {
      cancelled = true;
      unbind();
      cancelScheduledUserLibraryPush();
    };
  }, [ready, me?.user.id]);
}

/** 設定画面など向けの同期ステータス購読 */
export function useUserLibrarySyncStatus(): UserLibrarySyncStatus {
  const [status, setStatus] = useState<UserLibrarySyncStatus>(() =>
    getUserLibrarySyncStatus()
  );

  useEffect(() => {
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<UserLibrarySyncStatus>).detail;
      if (detail) setStatus(detail);
      else setStatus(getUserLibrarySyncStatus());
    };
    window.addEventListener(USER_LIBRARY_SYNC_STATUS_EVENT, onStatus);
    setStatus(getUserLibrarySyncStatus());
    return () =>
      window.removeEventListener(USER_LIBRARY_SYNC_STATUS_EVENT, onStatus);
  }, []);

  return status;
}

import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { isDemoSessionToken } from "../api/client";
import {
  clearEditorDraft,
  saveEditorDraft,
} from "../lib/editorDraftStorage";
import { registerEditorAutoSaveFlush } from "../lib/editorAutoSaveBridge";
import type { ChoreographyProjectJson } from "../types/choreography";

const CLOUD_DEBOUNCE_MS = 2000;
const LOCAL_DEBOUNCE_MS = 400;

type Params = {
  enabled: boolean;
  projectRef: MutableRefObject<ChoreographyProjectJson | null>;
  projectName: string;
  serverId: number | null;
  syncProjectToCloud: () => Promise<{ id: number; share_token?: string | null }>;
  setSaving: (saving: boolean) => void;
  /** プロジェクト内容の変化検知用（JSON シグネチャ等） */
  projectChangeSig: string;
};

/**
 * 編集内容をローカル草稿に随時退避し、ログイン中はクラウドへ debounce 上書き保存する。
 */
export function useEditorAutoSave({
  enabled,
  projectRef,
  projectName,
  serverId,
  syncProjectToCloud,
  setSaving,
  projectChangeSig,
}: Params) {
  const lastCloudJsonRef = useRef<string | null>(null);
  const cloudTimerRef = useRef<number | null>(null);
  const localTimerRef = useRef<number | null>(null);
  const cloudInFlightRef = useRef(false);
  const cloudPendingRef = useRef(false);

  const persistLocalDraft = useCallback(() => {
    if (!enabled) return;
    const live = projectRef.current;
    if (!live) return;
    saveEditorDraft({
      savedAt: new Date().toISOString(),
      serverId,
      projectName,
      project: live,
    });
  }, [enabled, projectName, projectRef, serverId]);

  const flushCloudSave = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled || isDemoSessionToken()) return;
      const live = projectRef.current;
      if (!live) return;
      let json = "";
      try {
        json = JSON.stringify(live);
      } catch {
        return;
      }
      if (json === lastCloudJsonRef.current) {
        persistLocalDraft();
        return;
      }
      if (cloudInFlightRef.current) {
        cloudPendingRef.current = true;
        return;
      }
      cloudInFlightRef.current = true;
      if (!opts?.silent) setSaving(true);
      try {
        await syncProjectToCloud();
        lastCloudJsonRef.current = json;
        clearEditorDraft(serverId);
      } catch {
        persistLocalDraft();
      } finally {
        cloudInFlightRef.current = false;
        if (!opts?.silent) setSaving(false);
        if (cloudPendingRef.current) {
          cloudPendingRef.current = false;
          await flushCloudSave(opts);
        }
      }
    },
    [
      enabled,
      persistLocalDraft,
      projectRef,
      serverId,
      setSaving,
      syncProjectToCloud,
    ]
  );

  const scheduleCloudSave = useCallback(() => {
    if (cloudTimerRef.current != null) {
      window.clearTimeout(cloudTimerRef.current);
    }
    cloudTimerRef.current = window.setTimeout(() => {
      cloudTimerRef.current = null;
      void flushCloudSave({ silent: true });
    }, CLOUD_DEBOUNCE_MS);
  }, [flushCloudSave]);

  const scheduleLocalDraft = useCallback(() => {
    if (localTimerRef.current != null) {
      window.clearTimeout(localTimerRef.current);
    }
    localTimerRef.current = window.setTimeout(() => {
      localTimerRef.current = null;
      persistLocalDraft();
    }, LOCAL_DEBOUNCE_MS);
  }, [persistLocalDraft]);

  useEffect(() => {
    if (!enabled || !projectChangeSig) return;
    scheduleLocalDraft();
    scheduleCloudSave();
  }, [enabled, projectChangeSig, scheduleCloudSave, scheduleLocalDraft]);

  useEffect(() => {
    registerEditorAutoSaveFlush(async () => {
      if (cloudTimerRef.current != null) {
        window.clearTimeout(cloudTimerRef.current);
        cloudTimerRef.current = null;
      }
      if (localTimerRef.current != null) {
        window.clearTimeout(localTimerRef.current);
        localTimerRef.current = null;
      }
      persistLocalDraft();
      await flushCloudSave({ silent: true });
    });
    return () => registerEditorAutoSaveFlush(null);
  }, [flushCloudSave, persistLocalDraft]);

  useEffect(() => {
    if (!enabled) return;
    const onHide = () => {
      persistLocalDraft();
      void flushCloudSave({ silent: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, flushCloudSave, persistLocalDraft]);

  return { flushCloudSave, persistLocalDraft };
}

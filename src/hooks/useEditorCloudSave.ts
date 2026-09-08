import { useCallback, useRef, useState, type MutableRefObject } from "react";
import type { NavigateFunction } from "react-router-dom";
import { projectApi } from "../api/client";
import { PLAN_CONFIRM_PATH } from "../lib/commercialDisclosure";
import { normalizeProject } from "../lib/normalizeProject";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { Me } from "../types/authMe";
import { useI18n } from "../i18n/I18nContext";
import { yieldToMain } from "../lib/yieldToMain";
import {
  isServerNewerThanKnown,
  projectJsonDiffers,
} from "../lib/projectConflict";

export type CloudSaveConflict = {
  kind: "save-stale";
  serverUpdatedAt: string;
  serverJson: ChoreographyProjectJson;
  serverName: string;
};

export type UseEditorCloudSaveOptions = {
  me: Me | null;
  projectName: string;
  serverId: number | null;
  knownServerUpdatedAt: string | null;
  setKnownServerUpdatedAt: (iso: string | null) => void;
  projectSaveRef: MutableRefObject<ChoreographyProjectJson | null>;
  setProjectName: (name: string) => void;
  setServerId: (id: number | null) => void;
  setServerShareToken: (token: string | null) => void;
  setSaving: (saving: boolean) => void;
  navigate: NavigateFunction;
  /** クラウド保存直前: ローカル音源を Supabase MP3 へ上げて JSON を更新 */
  prepareProjectForCloudSave?: () => Promise<ChoreographyProjectJson | null>;
  onSaveConflict?: (conflict: CloudSaveConflict) => void;
};

export function useEditorCloudSave({
  me,
  projectName,
  serverId,
  knownServerUpdatedAt,
  setKnownServerUpdatedAt,
  projectSaveRef,
  setProjectName,
  setServerId,
  setServerShareToken,
  setSaving,
  navigate,
  prepareProjectForCloudSave,
  onSaveConflict,
}: UseEditorCloudSaveOptions) {
  const { t } = useI18n();
  const [cloudSaveDialogOpen, setCloudSaveDialogOpen] = useState(false);
  /** 自動保存と手動保存の競合で古い known を掴まないよう ref で常に最新を見る */
  const knownServerUpdatedAtRef = useRef(knownServerUpdatedAt);
  knownServerUpdatedAtRef.current = knownServerUpdatedAt;

  /**
   * いまの編集内容をクラウドに upsert。
   * 既存作品は保存前に updated_at を照合し、新しければ上書きせず conflict を返す。
   * `quietConflict`: 自動保存用。ダイアログを出さず conflict だけ返す。
   */
  const syncProjectToCloud = useCallback(
    async (opts?: {
      force?: boolean;
      quietConflict?: boolean;
    }): Promise<{
      id: number;
      share_token?: string | null;
      conflict?: CloudSaveConflict;
    }> => {
      if (!me) {
        throw new Error(t("editor.cloudSave.errLoginRequired"));
      }
      let live = projectSaveRef.current;
      if (!live) {
        throw new Error(t("editor.cloudSave.errNoProject"));
      }
      if (prepareProjectForCloudSave) {
        const prepared = await prepareProjectForCloudSave();
        if (prepared) {
          live = prepared;
          projectSaveRef.current = prepared;
        }
      }
      await yieldToMain();
      let json: ChoreographyProjectJson;
      try {
        json = normalizeProject(
          JSON.parse(JSON.stringify(live)) as ChoreographyProjectJson
        );
      } catch {
        throw new Error(t("editor.cloudSave.errCopyFailed"));
      }
      await yieldToMain();
      const title =
        json.pieceTitle?.trim() ||
        projectName.trim() ||
        t("editor.untitledProject");
      const body: ChoreographyProjectJson = { ...json, pieceTitle: title };
      if (serverId != null) {
        if (!opts?.force) {
          const latest = await projectApi.get(serverId);
          const known = knownServerUpdatedAtRef.current;

          // 基準未学習: サーバー時刻を覚え、内容が違うときだけ手動保存で警告
          if (!known) {
            setKnownServerUpdatedAt(latest.updated_at);
            knownServerUpdatedAtRef.current = latest.updated_at;
            const serverJson = normalizeProject(latest.json);
            if (projectJsonDiffers(body, serverJson)) {
              const conflict: CloudSaveConflict = {
                kind: "save-stale",
                serverUpdatedAt: latest.updated_at,
                serverJson,
                serverName: latest.name,
              };
              if (!opts?.quietConflict) onSaveConflict?.(conflict);
              return { id: serverId, conflict };
            }
            // 同内容ならそのまま下の update へ
          } else if (isServerNewerThanKnown(known, latest.updated_at)) {
            const conflict: CloudSaveConflict = {
              kind: "save-stale",
              serverUpdatedAt: latest.updated_at,
              serverJson: normalizeProject(latest.json),
              serverName: latest.name,
            };
            // 自動保存ではダイアログを出さない（連発して編集を妨げるため）
            if (!opts?.quietConflict) onSaveConflict?.(conflict);
            return { id: serverId, conflict };
          }
        }
        const row = await projectApi.update(serverId, title, body);
        setProjectName(title);
        if (row.share_token) setServerShareToken(row.share_token);
        setKnownServerUpdatedAt(row.updated_at);
        knownServerUpdatedAtRef.current = row.updated_at;
        return { id: serverId, share_token: row.share_token ?? null };
      }
      let row: Awaited<ReturnType<typeof projectApi.create>>;
      try {
        row = await projectApi.create(title, body);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("free_limit") || msg.includes("無料プラン")) {
          const goUpgrade = window.confirm(
            t("editor.cloudSave.freeLimitConfirm")
          );
          if (goUpgrade) {
            navigate(PLAN_CONFIRM_PATH);
          }
          throw e;
        }
        throw e;
      }
      setServerId(row.id);
      if (row.share_token) setServerShareToken(row.share_token);
      setKnownServerUpdatedAt(row.updated_at);
      knownServerUpdatedAtRef.current = row.updated_at;
      navigate(`/editor/${row.id}`, {
        replace: true,
        state: {
          editorSeed: body,
          editorSeedProjectId: row.id,
        },
      });
      return { id: row.id, share_token: row.share_token ?? null };
    },
    [
      me,
      projectName,
      projectSaveRef,
      serverId,
      setKnownServerUpdatedAt,
      setProjectName,
      setServerId,
      setServerShareToken,
      navigate,
      prepareProjectForCloudSave,
      onSaveConflict,
      t,
    ]
  );

  const performCloudSave = useCallback(async () => {
    if (!me) return;
    setCloudSaveDialogOpen(false);
    setSaving(true);
    try {
      // 手動保存・⌘S のみダイアログ可
      const result = await syncProjectToCloud({ quietConflict: false });
      if (result.conflict) return;
    } catch (e) {
      alert(
        e instanceof Error ? e.message : t("editor.cloudSave.errSaveFailed")
      );
    } finally {
      setSaving(false);
    }
  }, [me, syncProjectToCloud, setSaving, t]);

  return {
    cloudSaveDialogOpen,
    setCloudSaveDialogOpen,
    syncProjectToCloud,
    performCloudSave,
  };
}

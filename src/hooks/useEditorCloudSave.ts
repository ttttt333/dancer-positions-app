import { useCallback, useState, type MutableRefObject } from "react";
import type { NavigateFunction } from "react-router-dom";
import { projectApi } from "../api/client";
import { PLAN_CONFIRM_PATH } from "../lib/commercialDisclosure";
import { normalizeProject } from "../lib/normalizeProject";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { Me } from "../types/authMe";
import { useI18n } from "../i18n/I18nContext";
import { yieldToMain } from "../lib/yieldToMain";

export type UseEditorCloudSaveOptions = {
  me: Me | null;
  projectName: string;
  serverId: number | null;
  projectSaveRef: MutableRefObject<ChoreographyProjectJson | null>;
  setProjectName: (name: string) => void;
  setServerId: (id: number | null) => void;
  setServerShareToken: (token: string | null) => void;
  setSaving: (saving: boolean) => void;
  navigate: NavigateFunction;
  /** クラウド保存直前: ローカル音源を Supabase MP3 へ上げて JSON を更新 */
  prepareProjectForCloudSave?: () => Promise<ChoreographyProjectJson | null>;
};

export function useEditorCloudSave({
  me,
  projectName,
  serverId,
  projectSaveRef,
  setProjectName,
  setServerId,
  setServerShareToken,
  setSaving,
  navigate,
  prepareProjectForCloudSave,
}: UseEditorCloudSaveOptions) {
  const { t } = useI18n();
  const [cloudSaveDialogOpen, setCloudSaveDialogOpen] = useState(false);

  /**
   * いまの編集内容をクラウドに upsert（フローライブラリの保存直前にも利用）。
   * 新規作成時は URL を `/editor/:id` に差し替える。
   */
  const syncProjectToCloud = useCallback(async (): Promise<{
    id: number;
    share_token?: string | null;
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
      json.pieceTitle?.trim() || projectName.trim() || t("editor.untitledProject");
    const body: ChoreographyProjectJson = { ...json, pieceTitle: title };
    if (serverId != null) {
      const row = await projectApi.update(serverId, title, body);
      setProjectName(title);
      if (row.share_token) setServerShareToken(row.share_token);
      return { id: serverId, share_token: row.share_token ?? null };
    }
    let row: Awaited<ReturnType<typeof projectApi.create>>;
    try {
      row = await projectApi.create(title, body);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("free_limit") || msg.includes("無料プラン")) {
        const goUpgrade = window.confirm(t("editor.cloudSave.freeLimitConfirm"));
        if (goUpgrade) {
          navigate(PLAN_CONFIRM_PATH);
        }
        throw e;
      }
      throw e;
    }
    setServerId(row.id);
    if (row.share_token) setServerShareToken(row.share_token);
    navigate(`/editor/${row.id}`, {
      replace: true,
      state: {
        editorSeed: body,
        editorSeedProjectId: row.id,
      },
    });
    return { id: row.id, share_token: row.share_token ?? null };
  }, [
    me,
    projectName,
    projectSaveRef,
    serverId,
    setProjectName,
    setServerId,
    setServerShareToken,
    navigate,
    prepareProjectForCloudSave,
    t,
  ]);

  const performCloudSave = useCallback(async () => {
    if (!me) return;
    setCloudSaveDialogOpen(false);
    setSaving(true);
    try {
      await syncProjectToCloud();
    } catch (e) {
      alert(e instanceof Error ? e.message : t("editor.cloudSave.errSaveFailed"));
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

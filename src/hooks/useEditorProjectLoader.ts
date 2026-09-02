import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Location, NavigateFunction } from "react-router-dom";
import { projectApi } from "../api/client";
import { isSupabaseBackend } from "../lib/supabaseClient";
import {
  getFlowLibraryItem,
  materializeFlowLibraryItemAsProject,
} from "../lib/flowLibrary";
import {
  createEmptyProject,
  tryMigrateFromLocalStorage,
} from "../lib/projectDefaults";
import { normalizeProject } from "../lib/normalizeProject";
import { loadEditorDraft } from "../lib/editorDraftStorage";
import { getEntitlements } from "../lib/entitlements";
import {
  analyzeFreePlanExcessFromList,
  trimProjectToFreeLimits,
} from "../lib/freePlanCompliance";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { Me } from "../types/authMe";
import { loadShareViewProject, primeShareViewLoaderState } from "../lib/shareViewProjectCache";

export type UseEditorProjectLoaderOptions = {
  projectId?: string;
  shareTokenParam?: string;
  choreoPublicView: boolean;
  collabParam: boolean;
  me: Me | null;
  authReady: boolean;
  location: Location;
  navigate: NavigateFunction;
  onHistoryReset: () => void;
};

export function useEditorProjectLoader({
  projectId,
  shareTokenParam,
  choreoPublicView,
  collabParam,
  me,
  authReady,
  location,
  navigate,
  onHistoryReset,
}: UseEditorProjectLoaderOptions) {
  const sharePrimed =
    choreoPublicView && shareTokenParam
      ? primeShareViewLoaderState(shareTokenParam)
      : null;
  const [plainProject, setPlainProject] = useState<ChoreographyProjectJson | null>(
    () => sharePrimed?.plainProject ?? null
  );
  const [projectName, setProjectName] = useState(
    () => sharePrimed?.projectName ?? "無題の作品"
  );
  const [serverId, setServerId] = useState<number | null>(
    () => sharePrimed?.serverId ?? null
  );
  const [serverShareToken, setServerShareToken] = useState<string | null>(
    () => sharePrimed?.serverShareToken ?? null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const skipNextProjectFetchRef = useRef<number | null>(null);

  const projectSaveRef = useRef<ChoreographyProjectJson | null>(null);
  if (plainProject) {
    projectSaveRef.current = plainProject;
  } else {
    projectSaveRef.current = null;
  }

  useEffect(() => {
    if (choreoPublicView && shareTokenParam) {
      let cancelled = false;
      setLoadError(null);
      setServerShareToken(shareTokenParam);
      if (!isSupabaseBackend()) {
        setLoadError(
          "共有閲覧には VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY の設定が必要です。"
        );
        return;
      }
      void loadShareViewProject(shareTokenParam)
        .then((payload) => {
          if (cancelled) return;
          setServerId(payload.serverId);
          setServerShareToken(payload.serverShareToken);
          setProjectName(payload.projectName);
          setPlainProject(payload.project);
          setLoadError(null);
          onHistoryReset();
        })
        .catch((e) => {
          if (!cancelled) {
            setLoadError(e instanceof Error ? e.message : "読み込み失敗");
          }
        });
      return () => {
        cancelled = true;
      };
    }

    if (projectId === "new" || !projectId) {
      const search = new URLSearchParams(location.search);
      const flowId = search.get("flow")?.trim();
      if (flowId) {
        const item = getFlowLibraryItem(flowId);
        if (!item) {
          setPlainProject(createEmptyProject());
          setProjectName("無題の作品");
          setServerId(null);
          setServerShareToken(null);
          setLoadError("端末ライブラリにその作品がありません");
          onHistoryReset();
          return;
        }
        const fromFlow = normalizeProject(materializeFlowLibraryItemAsProject(item));
        setPlainProject(fromFlow);
        setProjectName(fromFlow.pieceTitle?.trim() || item.name || "無題の作品");
        const linkId = item.linkedServerProjectId;
        setServerId(
          typeof linkId === "number" && Number.isFinite(linkId) && linkId > 0
            ? linkId
            : null
        );
        setServerShareToken(null);
        setLoadError(null);
        onHistoryReset();
        return;
      }
      const migrated = tryMigrateFromLocalStorage();
      const draft = loadEditorDraft(null);
      const fromDraft =
        draft?.project != null ? normalizeProject(draft.project) : null;
      const nameFromQuery = search.get("name")?.trim();
      const nextProject = fromDraft ?? migrated ?? createEmptyProject();
      const namedProject =
        nameFromQuery && !nextProject.pieceTitle?.trim()
          ? { ...nextProject, pieceTitle: nameFromQuery }
          : nextProject;
      setPlainProject((prev) => prev ?? namedProject);
      if (nameFromQuery) {
        setProjectName(nameFromQuery);
      } else if (fromDraft && draft?.projectName) {
        setProjectName(draft.projectName);
      } else if (namedProject.pieceTitle?.trim()) {
        setProjectName(namedProject.pieceTitle.trim());
      }
      setServerId(null);
      setServerShareToken(null);
      setLoadError(null);
      onHistoryReset();
      return;
    }

    const id = Number(projectId);
    if (!Number.isFinite(id)) {
      setPlainProject(null);
      setLoadError("無効な ID");
      return;
    }

    if (!authReady) {
      setPlainProject(null);
      setLoadError(null);
      return;
    }

    if (collabParam) {
      if (!me) {
        setPlainProject(null);
        setLoadError("共同編集にはログインが必要です");
        return;
      }
    }

    if (isSupabaseBackend() && !me && !choreoPublicView) {
      setPlainProject(null);
      setLoadError("ログインが必要です");
      return;
    }

    if (skipNextProjectFetchRef.current === id) {
      skipNextProjectFetchRef.current = null;
      return;
    }

    type NavSeed = {
      editorSeed?: ChoreographyProjectJson;
      editorSeedProjectId?: number;
    };
    const nav = (location.state ?? null) as NavSeed | null;
    if (!collabParam && nav?.editorSeed && nav.editorSeedProjectId === id) {
      const seeded = normalizeProject(nav.editorSeed);
      setPlainProject(seeded);
      setServerId(id);
      const title = seeded.pieceTitle?.trim() || "無題の作品";
      setProjectName(title);
      setLoadError(null);
      skipNextProjectFetchRef.current = id;
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: {} }
      );
      return;
    }

    let cancelled = false;
    (async () => {
      setPlainProject(null);
      setLoadError(null);
      try {
        const row = await projectApi.get(id);
        if (cancelled) return;
        setServerId(row.id);
        setServerShareToken(row.share_token ?? null);
        setProjectName(row.name);
        const baseJson = normalizeProject(row.json);
        const draft = loadEditorDraft(id);
        let loadedJson = baseJson;
        if (
          draft &&
          draft.serverId === id &&
          draft.project
        ) {
          const draftMs = Date.parse(draft.savedAt);
          const serverMs = Date.parse(row.updated_at);
          if (
            Number.isFinite(draftMs) &&
            (!Number.isFinite(serverMs) || draftMs > serverMs + 500)
          ) {
            loadedJson = normalizeProject(draft.project);
            setProjectName(
              draft.projectName?.trim() ||
                draft.project.pieceTitle?.trim() ||
                row.name
            );
          }
        }

        // 無料復帰後: 超過があるときはライブラリで削減してから開く
        if (!choreoPublicView && me && !getEntitlements(me).isPro) {
          try {
            const list = await projectApi.list();
            const report = analyzeFreePlanExcessFromList(
              list.map((p) => ({
                id: p.id,
                name: p.name,
                updated_at: p.updated_at,
                cueCount: p.cueCount,
                dancerCount: p.dancerCount,
              }))
            );
            const contentOver = trimProjectToFreeLimits(loadedJson).changed;
            if (report.hasExcess || contentOver) {
              if (!cancelled) {
                navigate("/", { replace: true });
              }
              return;
            }
          } catch {
            /* 一覧取得失敗時は通常どおり開く */
          }
        }

        if (collabParam && me) {
          setPlainProject(null);
        } else {
          setPlainProject(
            choreoPublicView ? { ...loadedJson, viewMode: "view" } : loadedJson
          );
        }
        setLoadError(null);
        onHistoryReset();
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "読み込み失敗");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    shareTokenParam,
    collabParam,
    me,
    authReady,
    location.state,
    location.pathname,
    location.search,
    navigate,
    choreoPublicView,
    onHistoryReset,
  ]);

  return {
    plainProject,
    setPlainProject,
    projectName,
    setProjectName,
    serverId,
    setServerId,
    serverShareToken,
    setServerShareToken,
    loadError,
    setLoadError,
    saving,
    setSaving,
    skipNextProjectFetchRef,
    projectSaveRef,
  };
}

export type EditorProjectLoader = ReturnType<typeof useEditorProjectLoader>;

export type SetPlainProject = Dispatch<
  SetStateAction<ChoreographyProjectJson | null>
>;

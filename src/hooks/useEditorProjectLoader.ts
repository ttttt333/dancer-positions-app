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
  getFlowLibraryItemAsync,
  materializeFlowLibraryItemAsProject,
} from "../lib/flowLibrary";
import {
  createEmptyProject,
  tryMigrateFromLocalStorage,
} from "../lib/projectDefaults";
import { normalizeProject } from "../lib/normalizeProject";
import { clearEditorDraft, loadEditorDraft } from "../lib/editorDraftStorage";
import { getEntitlements } from "../lib/entitlements";
import {
  analyzeFreePlanExcessFromList,
  trimProjectToFreeLimits,
} from "../lib/freePlanCompliance";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { Me } from "../types/authMe";
import { loadShareViewProject, primeShareViewLoaderState } from "../lib/shareViewProjectCache";
import { projectJsonDiffers } from "../lib/projectConflict";

export type PendingLoadConflict = {
  kind: "load-draft";
  serverUpdatedAt: string;
  localSavedAt: string;
  serverJson: ChoreographyProjectJson;
  draftJson: ChoreographyProjectJson;
  draftName: string;
  serverName: string;
};

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
  const [knownServerUpdatedAt, setKnownServerUpdatedAt] = useState<string | null>(
    null
  );
  const [pendingLoadConflict, setPendingLoadConflict] =
    useState<PendingLoadConflict | null>(null);
  const skipNextProjectFetchRef = useRef<number | null>(null);
  /** すでに開いている作品 ID。auth me オブジェクト再生成での再フェッチを抑止する */
  const loadedEditorProjectIdRef = useRef<number | null>(null);
  const meUserId = me?.user?.id ?? null;
  const lastMeUserIdRef = useRef<string | null>(meUserId);

  const projectSaveRef = useRef<ChoreographyProjectJson | null>(null);
  if (plainProject) {
    projectSaveRef.current = plainProject;
  } else {
    projectSaveRef.current = null;
  }

  useEffect(() => {
    // アカウント切替時は必ず再読込（同一 projectId でも所有者チェックのため）
    if (lastMeUserIdRef.current !== meUserId) {
      lastMeUserIdRef.current = meUserId;
      loadedEditorProjectIdRef.current = null;
    }

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
      loadedEditorProjectIdRef.current = null;
      const search = new URLSearchParams(location.search);
      const flowId = search.get("flow")?.trim();
      if (flowId) {
        let cancelled = false;
        void getFlowLibraryItemAsync(flowId).then((item) => {
          if (cancelled) return;
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
        });
        return () => {
          cancelled = true;
        };
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
      loadedEditorProjectIdRef.current = null;
      setPlainProject(null);
      setLoadError("無効な ID");
      return;
    }

    if (!authReady) {
      // 認証待ち中に編集中内容を消さない（既に同 ID を開いている場合）
      if (loadedEditorProjectIdRef.current !== id) {
        setPlainProject(null);
      }
      setLoadError(null);
      return;
    }

    if (collabParam) {
      if (!meUserId) {
        loadedEditorProjectIdRef.current = null;
        setPlainProject(null);
        setLoadError("共同編集にはログインが必要です");
        return;
      }
    }

    if (isSupabaseBackend() && !meUserId && !choreoPublicView) {
      loadedEditorProjectIdRef.current = null;
      setPlainProject(null);
      setLoadError("ログインが必要です");
      return;
    }

    if (skipNextProjectFetchRef.current === id) {
      skipNextProjectFetchRef.current = null;
      loadedEditorProjectIdRef.current = id;
      return;
    }

    // 同一作品を編集中に me オブジェクト再生成などで effect が再入しても、
    // メモリ上の最新編集をサーバの古い JSON で潰さない。
    if (
      loadedEditorProjectIdRef.current === id &&
      projectSaveRef.current != null
    ) {
      return;
    }

    type NavSeed = {
      editorSeed?: ChoreographyProjectJson;
      editorSeedProjectId?: number;
      editorSeedUpdatedAt?: string;
    };
    const nav = (location.state ?? null) as NavSeed | null;
    if (!collabParam && nav?.editorSeed && nav.editorSeedProjectId === id) {
      const seeded = normalizeProject(nav.editorSeed);
      setPlainProject(seeded);
      setServerId(id);
      if (nav.editorSeedUpdatedAt) {
        setKnownServerUpdatedAt(nav.editorSeedUpdatedAt);
      }
      const title = seeded.pieceTitle?.trim() || "無題の作品";
      setProjectName(title);
      setLoadError(null);
      loadedEditorProjectIdRef.current = id;
      skipNextProjectFetchRef.current = id;
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: {} }
      );
      return;
    }

    let cancelled = false;
    (async () => {
      // 初回オープン時のみクリア。再フェッチ抑止後はここまで来ない。
      setPlainProject(null);
      setLoadError(null);
      try {
        const row = await projectApi.get(id);
        if (cancelled) return;
        setServerId(row.id);
        setServerShareToken(row.share_token ?? null);
        setProjectName(row.name);
        setKnownServerUpdatedAt(row.updated_at);
        const baseJson = normalizeProject(row.json);
        const draft = loadEditorDraft(id);
        let loadedJson = baseJson;
        let deferredConflict: PendingLoadConflict | null = null;

        if (
          !choreoPublicView &&
          draft &&
          draft.serverId === id &&
          draft.project &&
          projectJsonDiffers(draft.project, baseJson)
        ) {
          const draftMs = Date.parse(draft.savedAt);
          const serverMs = Date.parse(row.updated_at);
          const draftProject = normalizeProject(draft.project);
          const draftName =
            draft.projectName?.trim() ||
            draft.project.pieceTitle?.trim() ||
            row.name;
          // 草稿の方が新しい（またはサーバ時刻不明）→ 草稿を採用して作業消失を防ぐ
          if (
            Number.isFinite(draftMs) &&
            (!Number.isFinite(serverMs) || draftMs > serverMs + 500)
          ) {
            loadedJson = draftProject;
            setProjectName(draftName);
          } else {
            deferredConflict = {
              kind: "load-draft",
              serverUpdatedAt: row.updated_at,
              localSavedAt: draft.savedAt,
              serverJson: baseJson,
              draftJson: draftProject,
              draftName,
              serverName: row.name,
            };
            // 曖昧なときは草稿を仮表示（サーバで上書きして消えるのを防ぐ）
            loadedJson = draftProject;
            setProjectName(draftName);
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
        loadedEditorProjectIdRef.current = id;
        setPendingLoadConflict(deferredConflict);
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
    meUserId,
    me,
    authReady,
    location.state,
    location.pathname,
    location.search,
    navigate,
    choreoPublicView,
    onHistoryReset,
  ]);

  const resolveLoadConflictKeepLocal = () => {
    const c = pendingLoadConflict;
    if (!c) return;
    setPlainProject(c.draftJson);
    setProjectName(c.draftName);
    setPendingLoadConflict(null);
    onHistoryReset();
  };

  const resolveLoadConflictTakeServer = () => {
    const c = pendingLoadConflict;
    if (!c) return;
    setPlainProject(c.serverJson);
    setProjectName(c.serverName);
    setKnownServerUpdatedAt(c.serverUpdatedAt);
    if (serverId != null) clearEditorDraft(serverId);
    setPendingLoadConflict(null);
    onHistoryReset();
  };

  return {
    plainProject,
    setPlainProject,
    projectName,
    setProjectName,
    serverId,
    setServerId,
    serverShareToken,
    setServerShareToken,
    knownServerUpdatedAt,
    setKnownServerUpdatedAt,
    pendingLoadConflict,
    resolveLoadConflictKeepLocal,
    resolveLoadConflictTakeServer,
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

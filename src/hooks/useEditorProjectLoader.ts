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
import { projectJsonDiffers, shouldPreferLocalDraft } from "../lib/projectConflict";

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

  const projectSaveRef = useRef<ChoreographyProjectJson | null>(null);
  if (plainProject) {
    projectSaveRef.current = plainProject;
  } else {
    projectSaveRef.current = null;
  }

  /** 同一 user + project ではクラウド再取得しない（トークン更新で編集が消えるのを防ぐ） */
  const loadedKeyRef = useRef<string | null>(null);
  const meUserId = me?.user?.id ?? null;

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
      loadedKeyRef.current = null;
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
          const linkedId =
            typeof linkId === "number" && Number.isFinite(linkId) && linkId > 0
              ? linkId
              : null;
          setServerId(linkedId);
          setServerShareToken(null);
          // 紐付け済みなら updated_at を学習（未設定のままだと保存のたびに誤競合しやすい）
          if (linkedId != null && me) {
            void projectApi
              .get(linkedId)
              .then((row) => {
                if (cancelled) return;
                setKnownServerUpdatedAt(row.updated_at);
                if (row.share_token) setServerShareToken(row.share_token);
              })
              .catch(() => {
                /* 取得失敗時は初回保存で学習 */
              });
          } else {
            setKnownServerUpdatedAt(null);
          }
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
      loadedKeyRef.current = null;
      setPlainProject(null);
      setLoadError("無効な ID");
      return;
    }

    if (!authReady) {
      // 初回ハイドレーション中は既存画面を消さない（ちらつき・巻き戻り防止）
      if (loadedKeyRef.current == null) {
        setPlainProject(null);
        setLoadError(null);
      }
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
      // セッション確立直後の一瞬だけ me が空でも、既に開いている作品は維持
      if (loadedKeyRef.current == null) {
        setPlainProject(null);
        setLoadError("ログインが必要です");
      }
      return;
    }

    if (skipNextProjectFetchRef.current === id) {
      skipNextProjectFetchRef.current = null;
      return;
    }

    const loadKey = `${meUserId ?? "anon"}:${id}`;
    if (loadedKeyRef.current === loadKey && projectSaveRef.current != null) {
      // 同一作品を保持中 → me 参照更新や課金マージでは再取得しない
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
      loadedKeyRef.current = loadKey;
      skipNextProjectFetchRef.current = id;
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: {} }
      );
      return;
    }

    let cancelled = false;
    (async () => {
      // 既に編集中の同一 ID なら画面を消さない（再取得中の巻き戻り防止）
      const keepingLive =
        (serverId === id && projectSaveRef.current != null) ||
        loadedKeyRef.current === loadKey;
      if (!keepingLive) {
        setPlainProject(null);
      }
      setLoadError(null);
      try {
        const row = await projectApi.get(id);
        if (cancelled) return;
        setServerId(row.id);
        setServerShareToken(row.share_token ?? null);
        setKnownServerUpdatedAt(row.updated_at);
        const baseJson = normalizeProject(row.json);
        const draft = loadEditorDraft(id);
        let loadedJson = baseJson;
        let nameToSet: string | null = row.name;

        // 編集中のメモリ内容がクラウドと違う場合はメモリを優先（巻き戻り防止）
        const live = projectSaveRef.current;
        const liveDiffers =
          keepingLive && live != null && projectJsonDiffers(live, baseJson);

        if (liveDiffers && live) {
          loadedJson = live;
          nameToSet = null;
        } else if (
          !choreoPublicView &&
          draft &&
          draft.serverId === id &&
          draft.project
        ) {
          if (projectJsonDiffers(draft.project, baseJson)) {
            if (shouldPreferLocalDraft(draft.savedAt, row.updated_at)) {
              loadedJson = normalizeProject(draft.project);
              nameToSet =
                draft.projectName?.trim() ||
                draft.project.pieceTitle?.trim() ||
                row.name;
            } else if (!keepingLive) {
              clearEditorDraft(id);
              loadedJson = baseJson;
            } else {
              loadedJson = live ?? normalizeProject(draft.project);
              nameToSet = null;
            }
          } else {
            clearEditorDraft(id);
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
        } else if (liveDiffers && live) {
          // 編集中はそのまま維持
        } else {
          setPlainProject(
            choreoPublicView ? { ...loadedJson, viewMode: "view" } : loadedJson
          );
          if (nameToSet) setProjectName(nameToSet);
        }
        loadedKeyRef.current = loadKey;
        setPendingLoadConflict(null);
        setLoadError(null);
        if (!keepingLive) onHistoryReset();
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

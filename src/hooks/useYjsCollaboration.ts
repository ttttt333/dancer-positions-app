import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type SetStateAction,
} from "react";
import { getToken } from "../api/client";
import { normalizeProject } from "../lib/normalizeProject";
import {
  applyProjectJsonToDoc,
  yDocToProjectJson,
} from "../lib/collab/yjsJsonBridge";
import type { ChoreographyProjectJson } from "../types/choreography";

const HISTORY_CAP = 80;

function collabWsBase(): string {
  const env = import.meta.env.VITE_COLLAB_WS as string | undefined;
  if (env) return env.replace(/\/$/, "");
  if (typeof window === "undefined") return "ws://127.0.0.1:3001";
  const { protocol, hostname } = window.location;
  const isHttps = protocol === "https:";
  const devPort = "3001";
  return `${isHttps ? "wss" : "ws"}://${hostname}:${devPort}`;
}

/**
 * ?collab=1 時: 保存済みプロジェクトを Yjs + WebSocket で同期（2〜3 人想定）
 */
export function useYjsCollaboration(
  serverId: number | null,
  enabled: boolean
): {
  project: ChoreographyProjectJson | null;
  setProjectSafe: (
    action: SetStateAction<ChoreographyProjectJson>
  ) => void;
  synced: boolean;
  undo: () => void;
  redo: () => void;
  undoStackSize: number;
  redoStackSize: number;
} {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const historyRef = useRef<{ undo: string[]; redo: string[] }>({
    undo: [],
    redo: [],
  });
  const [synced, setSynced] = useState(false);
  const [stackInfo, setStackInfo] = useState({ undo: 0, redo: 0 });

  const syncStackInfo = useCallback(() => {
    setStackInfo({
      undo: historyRef.current.undo.length,
      redo: historyRef.current.redo.length,
    });
  }, []);

  /** undo 履歴件数の表示更新を 1 フレームにまとめ、Yjs 同期直後の二重 setState 連鎖を抑える */
  const stackFlushRafRef = useRef<number | null>(null);
  const scheduleSyncStackInfo = useCallback(() => {
    if (stackFlushRafRef.current != null) return;
    stackFlushRafRef.current = requestAnimationFrame(() => {
      stackFlushRafRef.current = null;
      syncStackInfo();
    });
  }, [syncStackInfo]);

  useEffect(() => {
    return () => {
      if (stackFlushRafRef.current != null) {
        cancelAnimationFrame(stackFlushRafRef.current);
        stackFlushRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || !serverId) {
      setYdoc(null);
      setSynced(false);
      providerRef.current = null;
      historyRef.current = { undo: [], redo: [] };
      return;
    }
    const token = getToken();
    if (!token) {
      setYdoc(null);
      return;
    }

    const doc = new Y.Doc();
    const wsBase = collabWsBase();
    const provider = new WebsocketProvider(
      wsBase,
      `project-${serverId}`,
      doc,
      { params: { token } }
    );

    const onSync = (isSynced: boolean) => {
      setSynced(isSynced);
    };
    provider.on("sync", onSync);
    providerRef.current = provider;
    setYdoc(doc);
    setSynced(false);

    return () => {
      provider.off("sync", onSync);
      provider.destroy();
      providerRef.current = null;
      setYdoc(null);
      setSynced(false);
      historyRef.current = { undo: [], redo: [] };
    };
  }, [enabled, serverId]);

  const project = useSyncExternalStore(
    (cb) => {
      if (!ydoc) return () => {};
      const f = () => cb();
      ydoc.on("update", f);
      return () => {
        ydoc.off("update", f);
      };
    },
    () => {
      if (!ydoc) return null;
      try {
        const raw = yDocToProjectJson(ydoc);
        return normalizeProject(raw);
      } catch {
        return null;
      }
    },
    () => null
  );

  const setProjectSafe = useCallback(
    (action: SetStateAction<ChoreographyProjectJson>) => {
      if (!ydoc) return;
      const prev = normalizeProject(yDocToProjectJson(ydoc));
      const next =
        typeof action === "function"
          ? (action as (p: ChoreographyProjectJson) => ChoreographyProjectJson)(
              prev
            )
          : action;
      let unchanged = false;
      try {
        unchanged = JSON.stringify(next) === JSON.stringify(prev);
      } catch {
        unchanged = false;
      }
      if (unchanged) return;
      const { undo, redo } = historyRef.current;
      if (undo.length >= HISTORY_CAP) undo.shift();
      undo.push(JSON.stringify(prev));
      redo.length = 0;
      applyProjectJsonToDoc(ydoc, next);
      scheduleSyncStackInfo();
    },
    [ydoc, scheduleSyncStackInfo]
  );

  const undo = useCallback(() => {
    if (!ydoc) return;
    const { undo: u, redo: r } = historyRef.current;
    if (u.length === 0) return;
    const prevStr = u.pop()!;
    const cur = normalizeProject(yDocToProjectJson(ydoc));
    r.push(JSON.stringify(cur));
    applyProjectJsonToDoc(ydoc, normalizeProject(JSON.parse(prevStr)));
    scheduleSyncStackInfo();
  }, [ydoc, scheduleSyncStackInfo]);

  const redo = useCallback(() => {
    if (!ydoc) return;
    const { undo: u, redo: r } = historyRef.current;
    if (r.length === 0) return;
    const nextStr = r.pop()!;
    const cur = normalizeProject(yDocToProjectJson(ydoc));
    u.push(JSON.stringify(cur));
    applyProjectJsonToDoc(ydoc, normalizeProject(JSON.parse(nextStr)));
    scheduleSyncStackInfo();
  }, [ydoc, scheduleSyncStackInfo]);

  return useMemo(
    () => ({
      project,
      setProjectSafe,
      synced,
      undo,
      redo,
      undoStackSize: stackInfo.undo,
      redoStackSize: stackInfo.redo,
    }),
    [
      project,
      setProjectSafe,
      synced,
      undo,
      redo,
      stackInfo.undo,
      stackInfo.redo,
    ]
  );
}

import { projectApi } from "../api/client";
import { normalizeProject } from "./normalizeProject";
import type { ChoreographyProjectJson } from "../types/choreography";
import { prefetchShareViewAudio } from "./shareViewPrefetch";

const CACHE_PREFIX = "choreoShareViewV1:";
const MAX_CACHE_BYTES = 4_500_000;

export type ShareViewProjectPayload = {
  serverId: number;
  projectName: string;
  serverShareToken: string;
  project: ChoreographyProjectJson;
};

const inflight = new Map<string, Promise<ShareViewProjectPayload>>();

function cacheKey(shareToken: string): string {
  return `${CACHE_PREFIX}${shareToken.trim()}`;
}

function readCacheRaw(shareToken: string): ShareViewProjectPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(shareToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShareViewProjectPayload;
    if (
      !parsed ||
      typeof parsed.serverId !== "number" ||
      typeof parsed.projectName !== "string" ||
      typeof parsed.serverShareToken !== "string" ||
      !parsed.project
    ) {
      return null;
    }
    return {
      ...parsed,
      project: normalizeProject(parsed.project),
    };
  } catch {
    return null;
  }
}

function writeCache(shareToken: string, payload: ShareViewProjectPayload): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(payload);
    if (body.length > MAX_CACHE_BYTES) return;
    sessionStorage.setItem(cacheKey(shareToken), body);
  } catch {
    /* quota / private mode */
  }
}

function rowToPayload(
  shareToken: string,
  row: {
    id: number;
    name: string;
    json: unknown;
    share_token?: string | null;
  }
): ShareViewProjectPayload {
  const baseJson = normalizeProject(row.json);
  const project: ChoreographyProjectJson = { ...baseJson, viewMode: "view" };
  return {
    serverId: row.id,
    projectName: row.name,
    serverShareToken: row.share_token ?? shareToken,
    project,
  };
}

/** 現在 URL が `/view/s/{token}` なら即座に取得を開始（React マウント前） */
export function warmShareViewFromCurrentPath(): void {
  if (typeof window === "undefined") return;
  const m = window.location.pathname.match(/^\/view\/s\/([^/]+)\/?$/);
  if (!m?.[1]) return;
  void loadShareViewProject(decodeURIComponent(m[1]));
}

export function readShareViewProjectCache(
  shareToken: string
): ShareViewProjectPayload | null {
  return readCacheRaw(shareToken.trim());
}

/**
 * 共有作品を取得（sessionStorage キャッシュ + 進行中リクエストの共有）。
 * キャッシュがあってもネットワークで最新を取りにいき、成功時にキャッシュを更新する。
 */
export function loadShareViewProject(
  shareToken: string
): Promise<ShareViewProjectPayload> {
  const token = shareToken.trim();
  const existing = inflight.get(token);
  if (existing) return existing;

  const cached = readCacheRaw(token);

  const network = projectApi.getByShareToken(token).then((row) => {
    const payload = rowToPayload(token, row);
    writeCache(token, payload);
    prefetchShareViewAudio(payload.project);
    return payload;
  });

  const p = (async () => {
    try {
      return await network;
    } finally {
      inflight.delete(token);
    }
  })();

  inflight.set(token, p);

  if (cached) {
    prefetchShareViewAudio(cached.project);
    void network.catch(() => {
      /* オフライン等: キャッシュ表示を維持 */
    });
    return Promise.resolve(cached);
  }

  return p;
}

export function primeShareViewLoaderState(shareToken: string | undefined): {
  plainProject: ChoreographyProjectJson | null;
  projectName: string;
  serverId: number | null;
  serverShareToken: string | null;
} {
  if (!shareToken) {
    return {
      plainProject: null,
      projectName: "無題の作品",
      serverId: null,
      serverShareToken: null,
    };
  }
  const cached = readShareViewProjectCache(shareToken);
  if (!cached) {
    return {
      plainProject: null,
      projectName: "無題の作品",
      serverId: null,
      serverShareToken: null,
    };
  }
  prefetchShareViewAudio(cached.project);
  return {
    plainProject: cached.project,
    projectName: cached.projectName,
    serverId: cached.serverId,
    serverShareToken: cached.serverShareToken,
  };
}

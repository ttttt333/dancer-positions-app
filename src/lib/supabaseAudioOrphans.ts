import { listFlowLibraryItems, ensureFlowLibraryReady } from "./flowLibrary";
import { getSupabase } from "./supabaseClient";
import { CHOREOCORE_AUDIO_BUCKET } from "./supabaseAudio";
import { wavePeaksSidecarPath } from "./supabaseWavePeaks";

export type AudioObjectRef = {
  path: string;
  bytes: number;
};

/** 作品 JSON とフロー memento に残っている `audioSupabasePath` を集める */
export function collectReferencedAudioPaths(sources: readonly unknown[]): Set<string> {
  const out = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const raw = record.audioSupabasePath;
    if (typeof raw === "string" && raw.trim()) out.add(raw.trim());
    for (const child of Object.values(record)) visit(child);
  };
  for (const source of sources) visit(source);
  return out;
}

/** 参照中の音源と、その波形サイドカーは消さない */
export function keepPathsForReferencedAudio(audioPaths: Iterable<string>): Set<string> {
  const keep = new Set<string>();
  for (const raw of audioPaths) {
    const path = raw.trim();
    if (!path) continue;
    keep.add(path);
    keep.add(wavePeaksSidecarPath(path));
  }
  return keep;
}

/** 参照されていない Storage オブジェクト。パス順は決定的 */
export function selectOrphanAudioObjects(
  objects: readonly AudioObjectRef[],
  keep: ReadonlySet<string>
): AudioObjectRef[] {
  return objects
    .filter((object) => object.path.trim() && !keep.has(object.path.trim()))
    .map((object) => ({ path: object.path.trim(), bytes: Math.max(0, object.bytes) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export type OrphanAudioCleanupResult = {
  deletedCount: number;
  deletedBytes: number;
  keptCount: number;
};

type ListedStorageItem = {
  name: string;
  id: string | null;
  metadata: { size?: number } | null;
};

const LIST_PAGE = 100;
const REMOVE_BATCH = 100;

function isFolder(item: ListedStorageItem): boolean {
  return item.id == null;
}

async function listFolder(
  prefix: string,
  list: (path: string, offset: number) => Promise<ListedStorageItem[]>
): Promise<AudioObjectRef[]> {
  const out: AudioObjectRef[] = [];
  let offset = 0;
  for (;;) {
    const rows = await list(prefix, offset);
    for (const row of rows) {
      if (!row.name || row.name === ".emptyFolderPlaceholder") continue;
      const path = prefix ? `${prefix}/${row.name}` : row.name;
      if (isFolder(row)) {
        out.push(...(await listFolder(path, list)));
        continue;
      }
      const size = Number(row.metadata?.size);
      out.push({
        path,
        bytes: Number.isFinite(size) && size > 0 ? size : 0,
      });
    }
    if (rows.length < LIST_PAGE) break;
    offset += rows.length;
  }
  return out;
}

async function referencedAudioPathsForUser(userId: string): Promise<Set<string>> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("choreocore_projects")
    .select("json")
    .eq("user_id", userId);
  if (error) throw new Error(error.message || "作品一覧の取得に失敗しました");
  const sources: unknown[] = (data ?? []).map((row) => row.json);
  if (typeof window !== "undefined") {
    try {
      await ensureFlowLibraryReady();
      sources.push(...listFlowLibraryItems());
    } catch {
      /* この端末のフローが読めなくても、保存済み作品の音源は残す */
    }
  }
  return collectReferencedAudioPaths(sources);
}

/**
 * ログイン中のユーザーの `choreocore-audio` のうち、
 * 保存済み作品とこの端末のフローが参照していないオブジェクトを削除する。
 */
export async function deleteUnreferencedSupabaseAudio(): Promise<OrphanAudioCleanupResult> {
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) throw new Error("ログインが必要です");
  const userId = userData.user.id;
  const objects = await listFolder(userId, async (path, offset) => {
    const { data, error } = await sb.storage.from(CHOREOCORE_AUDIO_BUCKET).list(path, {
      limit: LIST_PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(error.message || "音源一覧の取得に失敗しました");
    return (data ?? []) as ListedStorageItem[];
  });
  const keep = keepPathsForReferencedAudio(await referencedAudioPathsForUser(userId));
  const orphans = selectOrphanAudioObjects(objects, keep);
  for (let i = 0; i < orphans.length; i += REMOVE_BATCH) {
    const batch = orphans.slice(i, i + REMOVE_BATCH).map((object) => object.path);
    const { error } = await sb.storage.from(CHOREOCORE_AUDIO_BUCKET).remove(batch);
    if (error) throw new Error(error.message || "音源の削除に失敗しました");
  }
  const deletedBytes = orphans.reduce((sum, object) => sum + object.bytes, 0);
  return {
    deletedCount: orphans.length,
    deletedBytes,
    keptCount: objects.length - orphans.length,
  };
}

/** 作品からもフローからも参照されていなければ、音源と波形サイドカーを消す */
export async function releaseUnreferencedSupabaseAudio(path: string): Promise<void> {
  const target = path.trim();
  if (!target) return;
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return;
  if (!target.startsWith(`${userData.user.id}/`)) return;
  const keep = keepPathsForReferencedAudio(
    await referencedAudioPathsForUser(userData.user.id)
  );
  if (keep.has(target)) return;
  const { error } = await sb.storage
    .from(CHOREOCORE_AUDIO_BUCKET)
    .remove([target, wavePeaksSidecarPath(target)]);
  if (error) throw new Error(error.message || "古い音源の削除に失敗しました");
}

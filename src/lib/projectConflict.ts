/**
 * クラウド作品の楽観的同時実行チェック用。
 * ローカルが保持する updated_at とサーバー最新を比較し、
 * 無言上書きを防ぐ。
 */

export function parseIsoMs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : NaN;
}

/** サーバーがローカル認識より新しい（または未知）なら競合 */
export function isServerNewerThanKnown(
  knownUpdatedAt: string | null | undefined,
  serverUpdatedAt: string | null | undefined
): boolean {
  const known = parseIsoMs(knownUpdatedAt);
  const server = parseIsoMs(serverUpdatedAt);
  if (!Number.isFinite(server)) return false;
  if (!Number.isFinite(known)) return true;
  // 同一時刻は競合にしない（自分の直前保存）
  return server > known + 50;
}

/** 草稿とサーバー JSON が実質違うか（簡易シグネチャ） */
export function projectJsonDiffers(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}

/**
 * クラウド保存成功後にローカル草稿を消してよいか。
 * 保存開始時スナップショットより新しい編集が残っていれば消さない。
 */
export function shouldClearEditorDraftAfterCloudSave(
  savedJsonSnapshot: string,
  liveJson: string | null | undefined
): boolean {
  if (liveJson == null || liveJson === "") return true;
  return liveJson === savedJsonSnapshot;
}

/**
 * クラウド保存用に、最新の作品 JSON へ音源パスだけを載せる。
 * 開始時スナップショット全体で上書きしない（編集消失防止）。
 */
export function patchProjectAudioCloudFields<
  T extends {
    audioSupabasePath?: string | null;
    audioAssetId?: string | null;
    flowLocalAudioKey?: string | null;
  },
>(project: T, audioSupabasePath: string): T {
  return {
    ...project,
    audioSupabasePath,
    audioAssetId: null,
    flowLocalAudioKey: null,
  };
}

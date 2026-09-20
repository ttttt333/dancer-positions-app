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

/**
 * サーバーがローカル認識より新しいなら競合。
 * 基準未設定（null）は「未知」ではなく「まだ学習していない」扱い → 競合にしない。
 * （基準未設定で true にすると、flow 紐付け直後の自動保存でダイアログが連発する）
 */
export function isServerNewerThanKnown(
  knownUpdatedAt: string | null | undefined,
  serverUpdatedAt: string | null | undefined
): boolean {
  const known = parseIsoMs(knownUpdatedAt);
  const server = parseIsoMs(serverUpdatedAt);
  if (!Number.isFinite(server)) return false;
  if (!Number.isFinite(known)) return false;
  // 同一時刻は競合にしない（自分の直前保存）。時計誤差を見て 50ms 余裕。
  return server > known + 50;
}

/**
 * 端末草稿とクラウドのどちらを開くか。
 * 草稿の savedAt がクラウド updated_at より新しければ草稿、それ以外はクラウド。
 */
export function shouldPreferLocalDraft(
  draftSavedAt: string | null | undefined,
  serverUpdatedAt: string | null | undefined
): boolean {
  const draft = parseIsoMs(draftSavedAt);
  const server = parseIsoMs(serverUpdatedAt);
  if (!Number.isFinite(draft)) return false;
  if (!Number.isFinite(server)) return true;
  return draft > server + 50;
}

/** 草稿とサーバー JSON が実質違うか（簡易シグネチャ） */
export function projectJsonDiffers(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}

import type { DancerSpot } from "../types/choreography";

/**
 * 「形の箱（Formation Box）」— ブラウザ内に保存されるユーザ独自の立ち位置ライブラリ。
 *
 * プロジェクト `savedSpotLayouts` とは独立した **端末横断のグローバル倉庫**。
 * 3 人〜任意人数の形をどんどん放り込んで、別プロジェクトでも再利用できる。
 *
 * 保管先は `localStorage`（5MB quota で十分、同期不要）。
 */

const STORAGE_KEY = "choreogrid_formation_box_v1";
/** 1 形あたりのダンサー上限（1 形が極端に大きくなりすぎるのを防ぐ安全ガード） */
const MAX_DANCERS = 80;

export type FormationBoxSpot = {
  xPct: number;
  yPct: number;
  /** 0..8 の色番号（なければ復元時に割り当て） */
  colorIndex?: number;
};

export type FormationBoxItem = {
  id: string;
  /** ユーザ命名（空なら自動命名） */
  name: string;
  /** 保存時の人数。フィルタ表示に使う。 */
  dancerCount: number;
  /** 位置情報のみ（ラベルやメンバー紐付けは持ち込まない） */
  dancers: FormationBoxSpot[];
  createdAt: number;
  updatedAt: number;
};

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function isValidSpot(x: unknown): x is FormationBoxSpot {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { xPct?: unknown; yPct?: unknown };
  return Number.isFinite(o.xPct) && Number.isFinite(o.yPct);
}

function isValidItem(x: unknown): x is FormationBoxItem {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.dancerCount === "number" &&
    Array.isArray(o.dancers)
  );
}

function normalize(raw: FormationBoxItem): FormationBoxItem {
  const dancers = (raw.dancers ?? [])
    .filter(isValidSpot)
    .slice(0, MAX_DANCERS)
    .map((d) => {
      const normalized: FormationBoxSpot = {
        xPct: clamp(d.xPct, 0, 100),
        yPct: clamp(d.yPct, 0, 100),
      };
      if (typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)) {
        normalized.colorIndex = Math.floor(d.colorIndex) % 9;
      }
      return normalized;
    });
  return {
    id: raw.id,
    name: (raw.name || "").slice(0, 120),
    dancerCount: clamp(
      Math.floor(raw.dancerCount || dancers.length || 1),
      1,
      MAX_DANCERS
    ),
    dancers,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

function safeParseAll(): FormationBoxItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidItem).map(normalize);
  } catch {
    return [];
  }
}

/**
 * 件数の自動削除（トリミング）は行わない。
 * ブラウザの localStorage 上限（およそ 5MB）に達した場合は `QuotaExceededError`
 * が投げられるので、呼び出し側で検知してユーザに告知する。
 */
class FormationBoxQuotaError extends Error {
  constructor() {
    super(
      "ブラウザ内の保存領域が一杯になりました。いくつかの形を削除するか、バックアップに書き出してからやり直してください。"
    );
    this.name = "FormationBoxQuotaError";
  }
}

function writeAll(items: FormationBoxItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    /** DOMException: QuotaExceededError / NS_ERROR_DOM_QUOTA_REACHED 等 */
    const name = (e as { name?: string } | null)?.name ?? "";
    if (
      name === "QuotaExceededError" ||
      name === "NS_ERROR_DOM_QUOTA_REACHED"
    ) {
      throw new FormationBoxQuotaError();
    }
    throw e;
  }
}

/** 新しい順に全件返す */
export function listFormationBoxItems(): FormationBoxItem[] {
  return safeParseAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 指定人数の形だけ返す（新しい順） */
export function listFormationBoxItemsByCount(
  count: number
): FormationBoxItem[] {
  const n = clamp(Math.floor(count), 1, MAX_DANCERS);
  return listFormationBoxItems().filter((x) => x.dancerCount === n);
}

/** 人数ごとの件数マップ。バッジ表示などに。 */
export function countByDancerCount(): Record<number, number> {
  const result: Record<number, number> = {};
  for (const it of listFormationBoxItems()) {
    result[it.dancerCount] = (result[it.dancerCount] ?? 0) + 1;
  }
  return result;
}

export type FormationBoxSaveResult =
  | { ok: true; item: FormationBoxItem }
  | { ok: false; reason: "empty" | "quota" | "unknown"; message: string };

/**
 * 現在のステージから立ち位置を箱に保存。
 * 件数上限は設けないので自動削除は発生しない。容量枯渇は呼び出し側で告知する。
 */
export function saveFormationToBox(
  name: string,
  dancers: DancerSpot[]
): FormationBoxSaveResult {
  const clean = dancers
    .filter((d) => Number.isFinite(d.xPct) && Number.isFinite(d.yPct))
    .slice(0, MAX_DANCERS);
  if (clean.length === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "保存する立ち位置がありません。",
    };
  }
  const now = Date.now();
  const trimmed = (name || "").trim().slice(0, 120);
  const item: FormationBoxItem = {
    id: crypto.randomUUID(),
    name: trimmed || `${clean.length}人の形`,
    dancerCount: clean.length,
    dancers: clean.map((d) => {
      const spot: FormationBoxSpot = {
        xPct: clamp(d.xPct, 0, 100),
        yPct: clamp(d.yPct, 0, 100),
      };
      if (typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)) {
        spot.colorIndex = Math.floor(d.colorIndex) % 9;
      }
      return spot;
    }),
    createdAt: now,
    updatedAt: now,
  };
  const cur = safeParseAll();
  cur.unshift(item);
  try {
    writeAll(cur);
    return { ok: true, item };
  } catch (e) {
    if (e instanceof FormationBoxQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message:
        e instanceof Error ? e.message : "保存中に予期しないエラーが発生しました。",
    };
  }
}

export function deleteFormationBoxItem(id: string): void {
  try {
    writeAll(safeParseAll().filter((x) => x.id !== id));
  } catch {
    /** 削除で容量が縮むケースのみなので基本失敗しない */
  }
}

export function renameFormationBoxItem(id: string, name: string): boolean {
  const trimmed = (name || "").trim().slice(0, 120);
  if (!trimmed) return false;
  try {
    writeAll(
      safeParseAll().map((x) =>
        x.id === id ? { ...x, name: trimmed, updatedAt: Date.now() } : x
      )
    );
    return true;
  } catch {
    return false;
  }
}

/** 既存の形を現在のステージで上書き更新（同じ id、同じ人数） */
export function updateFormationBoxItem(
  id: string,
  dancers: DancerSpot[]
): FormationBoxSaveResult {
  const clean = dancers
    .filter((d) => Number.isFinite(d.xPct) && Number.isFinite(d.yPct))
    .slice(0, MAX_DANCERS);
  if (clean.length === 0) {
    return { ok: false, reason: "empty", message: "空のステージでは上書きできません。" };
  }
  try {
    writeAll(
      safeParseAll().map((x) =>
        x.id === id
          ? {
              ...x,
              dancerCount: clean.length,
              dancers: clean.map((d) => {
                const spot: FormationBoxSpot = {
                  xPct: clamp(d.xPct, 0, 100),
                  yPct: clamp(d.yPct, 0, 100),
                };
                if (
                  typeof d.colorIndex === "number" &&
                  Number.isFinite(d.colorIndex)
                ) {
                  spot.colorIndex = Math.floor(d.colorIndex) % 9;
                }
                return spot;
              }),
              updatedAt: Date.now(),
            }
          : x
      )
    );
    const updated = safeParseAll().find((x) => x.id === id);
    if (updated) return { ok: true, item: updated };
    return { ok: false, reason: "unknown", message: "更新対象が見つかりません。" };
  } catch (e) {
    if (e instanceof FormationBoxQuotaError) {
      return { ok: false, reason: "quota", message: e.message };
    }
    return {
      ok: false,
      reason: "unknown",
      message:
        e instanceof Error ? e.message : "更新中に予期しないエラーが発生しました。",
    };
  }
}

/**
 * 箱のアイテムを `DancerSpot[]` として復元。
 * - id / label / colorIndex は新規採番
 * - xPct/yPct はステージ可動域 [5..95] × [8..92] にクランプ
 */
export function dancersFromFormationBoxItem(
  item: FormationBoxItem
): DancerSpot[] {
  return item.dancers.map((d, i) => ({
    id: crypto.randomUUID(),
    label: String(i + 1),
    xPct: clamp(d.xPct, 5, 95),
    yPct: clamp(d.yPct, 8, 92),
    colorIndex:
      typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
        ? Math.floor(d.colorIndex) % 9
        : i % 9,
  }));
}

/**
 * 箱データをまとめてエクスポート（JSON テキスト）。バックアップや端末間移行に。
 */
export function exportFormationBoxJson(): string {
  return JSON.stringify({ version: 1, items: listFormationBoxItems() }, null, 2);
}

/**
 * JSON テキストから取り込み。重複は ID でマージ（新しい方を採用）。
 * 追加件数を返す（容量不足やエラー時は負値）。
 */
export function importFormationBoxJson(jsonText: string): number {
  try {
    const parsed = JSON.parse(jsonText);
    const items = Array.isArray(parsed?.items) ? parsed.items : parsed;
    if (!Array.isArray(items)) return 0;
    const incoming = items.filter(isValidItem).map(normalize);
    if (incoming.length === 0) return 0;
    const cur = safeParseAll();
    const byId = new Map(cur.map((x) => [x.id, x]));
    let added = 0;
    for (const it of incoming) {
      const existing = byId.get(it.id);
      if (!existing || existing.updatedAt < it.updatedAt) {
        byId.set(it.id, it);
        if (!existing) added += 1;
      }
    }
    try {
      writeAll(Array.from(byId.values()));
      return added;
    } catch {
      return -1;
    }
  } catch {
    return 0;
  }
}

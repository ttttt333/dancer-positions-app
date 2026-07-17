import type { Formation } from "../types/choreography";

export type DancerSizeApplyScope = "cue" | "all";

/**
 * ダンサー ID ごとの上書き値を、指定スコープのフォーメーションへ書き込む。
 * - cue: `currentFormationId` のみ
 * - all: 全フォーメーション（同 ID のダンサーがいるもの）
 */
export function applyDancerFieldOverridesToFormations<K extends string>(
  formations: readonly Formation[],
  opts: {
    scope: DancerSizeApplyScope;
    currentFormationId: string;
    overrides: ReadonlyMap<string, number>;
    field: K;
  }
): Formation[] {
  const { scope, currentFormationId, overrides, field } = opts;
  if (overrides.size === 0) return formations as Formation[];

  return formations.map((f) => {
    if (scope === "cue" && f.id !== currentFormationId) return f;
    let changed = false;
    const dancers = f.dancers.map((d) => {
      const v = overrides.get(d.id);
      if (typeof v !== "number" || !Number.isFinite(v)) return d;
      if ((d as Record<string, unknown>)[field] === v) return d;
      changed = true;
      return { ...d, [field]: v };
    });
    return changed ? { ...f, dancers } : f;
  });
}

import { hypot, medianNearestNeighborDistance } from "./geometry";
import { normalizeNameForMatch } from "../matchNameToRoster";
import type { FormationImportWarning, ImportedDancer } from "./types";

export function validateFormationImport(
  dancers: ImportedDancer[],
  rosterCount?: number
): FormationImportWarning[] {
  const warnings: FormationImportWarning[] = [];

  if (typeof rosterCount === "number" && rosterCount > 0) {
    if (dancers.length < rosterCount) {
      warnings.push({
        kind: "count_short",
        message: `名簿${rosterCount}人に対して${dancers.length}人しか検出できませんでした。`,
      });
    } else if (dancers.length > rosterCount) {
      warnings.push({
        kind: "count_extra",
        message: `名簿にない人物が${dancers.length - rosterCount}人検出されました。`,
      });
    }
  }

  const byName = new Map<string, string[]>();
  for (const d of dancers) {
    const key = normalizeNameForMatch(d.recognizedName);
    if (!key) continue;
    const arr = byName.get(key) ?? [];
    arr.push(d.id);
    byName.set(key, arr);
  }
  for (const [name, ids] of byName) {
    if (ids.length > 1) {
      warnings.push({
        kind: "duplicate_name",
        message: `「${name}」が${ids.length}箇所に検出されています`,
        dancerIds: ids,
      });
    }
  }

  if (dancers.length >= 4) {
    const pts = dancers.map((d) => d.imagePosition);
    const nn = medianNearestNeighborDistance(pts);
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const outlierIds: string[] = [];
    dancers.forEach((d, i) => {
      const dist = hypot(pts[i]!, { x: cx, y: cy });
      if (dist > nn * 4.5) outlierIds.push(d.id);
    });
    if (outlierIds.length > 0) {
      warnings.push({
        kind: "outlier",
        message: `${outlierIds.length}名の位置が他メンバーから大きく離れています。`,
        dancerIds: outlierIds,
      });
    }
  }

  return warnings;
}

export function scoreConfidence(input: {
  nameMatched: number;
  total: number;
  rowCount: number;
  orientationConfidence: number;
  distanceError: number;
  warnings: FormationImportWarning[];
}): {
  nameRecognition: number;
  positionRecognition: number;
  formationRecognition: number;
  orientationRecognition: number;
  overall: number;
} {
  const n = Math.max(input.total, 1);
  const nameRecognition = clamp01(input.nameMatched / n);
  const positionRecognition = input.total > 0 ? 0.96 : 0;
  const rowBonus = input.rowCount >= 2 ? 0.94 : 0.7;
  const warnPenalty = input.warnings.length * 0.04;
  const formationRecognition = clamp01(
    rowBonus - input.distanceError * 0.25 - warnPenalty
  );
  const orientationRecognition = clamp01(input.orientationConfidence);
  const overall = clamp01(
    nameRecognition * 0.28 +
      positionRecognition * 0.24 +
      formationRecognition * 0.28 +
      orientationRecognition * 0.2
  );
  return {
    nameRecognition,
    positionRecognition,
    formationRecognition,
    orientationRecognition,
    overall,
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

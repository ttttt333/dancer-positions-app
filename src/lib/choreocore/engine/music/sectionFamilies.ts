/**
 * Fly / Edge の section_families（SSM クラスタ）を受け取る口。
 * 解析はしない。欠けていても既存経路は壊さない。
 */

import type { MusicSectionType } from "../types/MusicTypes";

export type SectionFamilyVariation = "first" | "repeat" | "final";

export type SectionFamilyOccurrence = {
  timeStart: number;
  timeEnd: number;
  variation: SectionFamilyVariation;
};

export type SectionFamily = {
  familyId: string;
  type: MusicSectionType;
  occurrences: SectionFamilyOccurrence[];
};

export type SectionFamilyHit = {
  family: SectionFamily;
  occurrence: SectionFamilyOccurrence;
  occurrenceIndex: number;
};

const SECTION_TYPES = new Set<MusicSectionType>([
  "INTRO",
  "VERSE",
  "PRE_CHORUS",
  "CHORUS",
  "DROP",
  "BREAK",
  "BRIDGE",
  "FINAL_CHORUS",
  "OUTRO",
  "UNKNOWN",
]);

function mapRemoteSectionType(raw: unknown): MusicSectionType | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toUpperCase();
  if (t === "CHORUS_START") return "CHORUS";
  if (t === "SE_TRIGGER") return "PRE_CHORUS";
  if (SECTION_TYPES.has(t as MusicSectionType)) return t as MusicSectionType;
  return null;
}

function mapVariation(
  raw: unknown,
  index: number,
  total: number,
  type: MusicSectionType
): SectionFamilyVariation {
  if (raw === "first" || raw === "repeat" || raw === "final") return raw;
  if (type === "FINAL_CHORUS") return index === 0 && total === 1 ? "final" : index === 0 ? "first" : "final";
  if (index <= 0) return "first";
  if (
    (type === "CHORUS" || type === "FINAL_CHORUS") &&
    index === total - 1
  ) {
    return "final";
  }
  return "repeat";
}

/**
 * 壊れた行は捨てる。フィールド自体が無い／配列でないときは空。
 */
export function parseSectionFamilies(raw: unknown): SectionFamily[] {
  if (!Array.isArray(raw)) return [];
  const out: SectionFamily[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const familyId = typeof o.familyId === "string" ? o.familyId.trim() : "";
    const type = mapRemoteSectionType(o.type);
    if (!familyId || !type) continue;
    const occRaw = Array.isArray(o.occurrences) ? o.occurrences : [];
    const drafted: Array<{
      timeStart: number;
      timeEnd: number;
      rawVariation: unknown;
    }> = [];
    for (const occ of occRaw) {
      if (!occ || typeof occ !== "object") continue;
      const c = occ as Record<string, unknown>;
      const timeStart = Number(c.timeStart);
      const timeEnd = Number(c.timeEnd);
      if (!Number.isFinite(timeStart) || !Number.isFinite(timeEnd)) continue;
      if (timeEnd <= timeStart) continue;
      drafted.push({ timeStart, timeEnd, rawVariation: c.variation });
    }
    drafted.sort((a, b) => a.timeStart - b.timeStart);
    const occurrences = drafted.map((occ, i) => ({
      timeStart: occ.timeStart,
      timeEnd: occ.timeEnd,
      variation: mapVariation(occ.rawVariation, i, drafted.length, type),
    }));
    if (occurrences.length === 0) continue;
    out.push({ familyId, type, occurrences });
  }
  return out;
}

export function sectionFamilyAt(
  families: SectionFamily[] | undefined,
  time: number
): SectionFamilyHit | null {
  if (!families?.length || !Number.isFinite(time)) return null;
  let best: SectionFamilyHit | null = null;
  let bestWidth = Infinity;
  for (const family of families) {
    for (let i = 0; i < family.occurrences.length; i += 1) {
      const occurrence = family.occurrences[i]!;
      if (time < occurrence.timeStart - 1e-6 || time >= occurrence.timeEnd) {
        continue;
      }
      const width = occurrence.timeEnd - occurrence.timeStart;
      const chorusLike =
        family.type === "CHORUS" || family.type === "FINAL_CHORUS";
      const bestChorus =
        best &&
        (best.family.type === "CHORUS" ||
          best.family.type === "FINAL_CHORUS");
      if (
        !best ||
        (chorusLike && !bestChorus) ||
        (chorusLike === Boolean(bestChorus) && width < bestWidth)
      ) {
        best = { family, occurrence, occurrenceIndex: i };
        bestWidth = width;
      }
    }
  }
  return best;
}

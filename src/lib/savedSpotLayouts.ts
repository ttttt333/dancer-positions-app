import type { DancerSpot } from "../types/choreography";
import { dancersForLayoutPreset, wingSurplusSpots } from "./formationLayouts";
import { modDancerColorIndex } from "./dancerColorPalette";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 保存済みの立ち位置を、ウィザードで選んだ人数 n に合わせて複製する。
 * 人数が少ないときは先頭から n 人分、多いときは末尾を横一列で補う。
 */
export function dancersForCountFromSaved(
  layout: { dancers: DancerSpot[] },
  n: number
): DancerSpot[] {
  const cap = Math.max(1, Math.min(80, Math.floor(n) || 1));
  const src = layout.dancers.filter(
    (d) => Number.isFinite(d.xPct) && Number.isFinite(d.yPct)
  );
  if (src.length === 0) return dancersForLayoutPreset(cap, "line");

  const out: DancerSpot[] = [];
  const take = Math.min(cap, src.length);
  for (let i = 0; i < take; i++) {
    const d = src[i];
    const label =
      typeof d.label === "string" && d.label.trim() !== ""
        ? d.label.trim().slice(0, 120)
        : String(i + 1);
    out.push({
      id: crypto.randomUUID(),
      label,
      xPct: clamp(d.xPct, 5, 95),
      yPct: clamp(d.yPct, 8, 92),
      colorIndex:
        typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
          ? modDancerColorIndex(Math.floor(d.colorIndex))
          : modDancerColorIndex(i),
      ...(typeof d.crewMemberId === "string" && d.crewMemberId
        ? { crewMemberId: d.crewMemberId }
        : {}),
    });
  }
  if (cap <= src.length) return out;

  const need = cap - out.length;
  /** §6 足りない分は袖（左右端）へ縦に並べる */
  for (const d of wingSurplusSpots(need, out.length + 1)) {
    out.push({ ...d });
  }
  return out;
}

/** プロジェクトに保存する用（位置を保ち、id を振り直す） */
export function snapshotDancersForPersist(dancers: DancerSpot[]): DancerSpot[] {
  return dancers.map((d, i) => {
    const label =
      typeof d.label === "string" && d.label.trim() !== ""
        ? d.label.trim().slice(0, 120)
        : String(i + 1);
    return {
      id: crypto.randomUUID(),
      label,
      xPct: clamp(d.xPct, 5, 95),
      yPct: clamp(d.yPct, 8, 92),
      colorIndex:
        typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
          ? modDancerColorIndex(Math.floor(d.colorIndex))
          : modDancerColorIndex(i),
      ...(typeof d.crewMemberId === "string" && d.crewMemberId
        ? { crewMemberId: d.crewMemberId }
        : {}),
    };
  });
}

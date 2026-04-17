/** 舞台寸法（内部は mm）。UI は m + cm（0–99）で編集 */

export function mmFromMeterAndCm(meters: number, centimeters: number): number {
  const m = Math.max(0, Math.floor(meters));
  const c = Math.max(0, Math.min(99, Math.floor(centimeters)));
  return m * 1000 + c * 10;
}

export function mmToMeterCm(mm: number): { m: number; cm: number } {
  let m = Math.floor(mm / 1000);
  let sub = mm - m * 1000;
  let cm = Math.round(sub / 10);
  if (cm >= 100) {
    m += 1;
    cm -= 100;
  }
  return { m, cm };
}

export function formatStageMmSummary(widthMm: number | null, depthMm: number | null): string {
  if (widthMm == null || depthMm == null) return "";
  const w = mmToMeterCm(widthMm);
  const d = mmToMeterCm(depthMm);
  return `幅 ${w.m} m ${w.cm} cm（${widthMm} mm）× 奥行 ${d.m} m ${d.cm} cm（${depthMm} mm）`;
}

/** ラベル用（例: サイド帯の表示） */
export function formatMeterCmLabel(mm: number): string {
  const u = mmToMeterCm(mm);
  return `${u.m} m ${u.cm} cm`;
}

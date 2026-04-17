/**
 * 再生時計・固定幅用。分:秒を常に `M:SS.cc`（センチ秒2桁）で揃え、桁の伸縮によるブレを防ぐ。
 */
export function formatMmSsClock(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00.00";
  const sign = sec < 0 ? "-" : "";
  const c = Math.round(Math.abs(sec) * 100);
  const m = Math.floor(c / 6000);
  const r = c % 6000;
  const s = Math.floor(r / 100);
  const cs = r % 100;
  return `${sign}${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** 表示用: 1:23（秒は切り捨て）。小数があれば 1:23.45 */
export function formatMmSs(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const sign = sec < 0 ? "-" : "";
  const x = Math.abs(sec);
  const m = Math.floor(x / 60);
  const s = x - m * 60;
  const si = Math.floor(s);
  const frac = s - si;
  const base = `${sign}${m}:${String(si).padStart(2, "0")}`;
  if (frac < 0.001) return base;
  const fracStr = frac.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${base}.${fracStr}`;
}

/** キュー一覧など: `M:SS` のみ（秒未満は切り捨て・小数は出さない） */
export function formatMmSsFloor(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const sign = sec < 0 ? "-" : "";
  const totalSec = Math.floor(Math.abs(sec) + 1e-9);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

/**
 * 分:秒 または 秒のみ をパース。
 * 例: "1:23" "01:05.5" "83.5" "-0:30"
 */
export function parseMmSsFlexible(input: string): number | null {
  const t = input.trim().replace(/[，．]/g, (ch) => (ch === "．" ? "." : ":"));
  if (!t) return null;
  const plain = Number(t);
  if (t === String(plain) && Number.isFinite(plain)) return plain;
  const neg = t.startsWith("-") ? -1 : 1;
  const body = neg < 0 ? t.slice(1).trim() : t;
  // 1:23 または 1:23.45（分:秒.小数）
  const m = body.match(/^(\d+):([\d.]+)$/);
  if (m) {
    const min = parseInt(m[1], 10);
    const secPart = parseFloat(m[2]);
    if (!Number.isFinite(secPart)) return null;
    return neg * (min * 60 + secPart);
  }
  return Number.isFinite(plain) ? plain : null;
}

/** 波形目盛り用の秒刻み（ラベル数が多すぎないよう間引き） */
export function waveRulerTicks(
  viewStart: number,
  viewEnd: number,
  maxLabels: number
): number[] {
  const span = viewEnd - viewStart;
  if (span <= 0 || !Number.isFinite(viewStart) || !Number.isFinite(viewEnd)) {
    return [];
  }
  const rawStep = span / Math.max(2, maxLabels);
  const steps = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200];
  const step = steps.find((s) => s >= rawStep) ?? steps[steps.length - 1];
  const ticks: number[] = [];
  let x = Math.ceil(viewStart / step) * step;
  const end = viewEnd + step * 0.001;
  while (x <= end) {
    if (x >= viewStart - 1e-6) ticks.push(Math.round(x * 1000) / 1000);
    x += step;
  }
  return ticks;
}

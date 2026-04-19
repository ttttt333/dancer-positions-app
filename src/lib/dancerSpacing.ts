import type { DancerSpot } from "../types/choreography";

/**
 * 「場ミリ規格」=ダンサー同士の物理的な配置間隔（mm）の流派ルール。
 *
 * 仕様（ユーザー流派・既定）:
 * - 隣同士の間隔: 1500 mm（=1.5 m）
 * - 偶数人をセンターで「割る」: ±750, ±2250, ±3750, ... mm
 *   （= 間隔の半分ずつセンターから振り分け）
 * - 奇数人を「乗せる」: 0, ±1500, ±3000, ... mm
 *
 * 偶数 / 奇数の振り分けは人数 n から自動で決まり、ユーザーは
 * 隣同士の間隔（mm）だけを指定すればよい。
 *
 * 他の流派が違う規格（例: 100 cm / 50 cm 割）を使う場合は、
 * spacingMm を変えるだけで同じ計算式で対応できる。
 */

/**
 * `formationLayouts.ts` の TARGET_STEP_X と一致させた基準値。
 * 「規格未設定 / ステージ幅未設定」のときの内部既定スケール。
 */
export const FORMATION_REFERENCE_STEP_PCT = 8;

export interface DancerSpacingPresetOption {
  /** select の value 用に mm をそのまま */
  mm: number;
  /** UI ラベル */
  label: string;
}

/**
 * UI 用の代表的な場ミリ規格プリセット。
 *
 * 「割センター」（偶数人時のセンターから第 1 立ち位置までの距離）は
 * 仕様上 spacingMm/2 で自動計算なので、ラベルにのみ補足表示。
 */
export const DANCER_SPACING_PRESET_OPTIONS: DancerSpacingPresetOption[] = [
  { mm: 900, label: "0.9 m（割 45cm）" },
  { mm: 1000, label: "1.0 m（割 50cm）" },
  { mm: 1200, label: "1.2 m（割 60cm）" },
  { mm: 1500, label: "1.5 m（割 75cm）" },
  { mm: 1800, label: "1.8 m（割 90cm）" },
  { mm: 2000, label: "2.0 m（割 1m）" },
];

/** UI のドロップダウンで「規格を使わない」を選んだ時の sentinel 値 */
export const DANCER_SPACING_AUTO = 0;

/**
 * 場ミリ規格の有効性チェック。stageWidthMm が無いと % 換算できないので、
 * 両方そろっているかつ正の値のときだけ true。
 */
export function isDancerSpacingActive(
  dancerSpacingMm: number | null | undefined,
  stageWidthMm: number | null | undefined
): boolean {
  return (
    typeof dancerSpacingMm === "number" &&
    Number.isFinite(dancerSpacingMm) &&
    dancerSpacingMm > 0 &&
    typeof stageWidthMm === "number" &&
    Number.isFinite(stageWidthMm) &&
    stageWidthMm > 0
  );
}

/**
 * 場ミリ規格に基づく「隣同士の間隔（％）」。
 * stage 幅が未設定なら null（規格未適用）。
 */
export function dancerStepPctFromSpacingMm(
  dancerSpacingMm: number | null | undefined,
  stageWidthMm: number | null | undefined
): number | null {
  if (!isDancerSpacingActive(dancerSpacingMm, stageWidthMm)) return null;
  return (dancerSpacingMm! / stageWidthMm!) * 100;
}

/**
 * n 人を「隣同士 step ％」の規格に従ってセンター対称に並べたときの x 位置（％）。
 *
 * - n=1: [50]
 * - n=2: [50-step/2, 50+step/2]    （割センター）
 * - n=3: [50-step, 50, 50+step]    （センター乗せ）
 * - n=4: [50-1.5*step, 50-0.5*step, 50+0.5*step, 50+1.5*step]
 * - …
 *
 * 端からはみ出ても丸めない（呼び出し側で必要なら clamp する）。
 */
export function dancerXPositionsPctForCount(n: number, stepPct: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [50];
  const start = 50 - (stepPct * (n - 1)) / 2;
  return Array.from({ length: n }, (_, i) => start + i * stepPct);
}

/**
 * フォーメーションプリセット由来の立ち位置を、場ミリ規格に合わせて
 * センターを中心に等比拡大／縮小する。
 *
 * - 既存プリセットは「TARGET_STEP_X = 8%」を隣同士の目安として組まれている。
 * - 場ミリ規格が指定されているとき、`scale = 規格step% / 8%` で xPct/yPct を
 *   センター（50,50）から伸縮させる。ライン・グリッド・ピラミッド等は
 *   隣同士の間隔がそのまま規格通りになる。
 * - 円・ひし形・スパイラル等の「絶対座標」プリセットは形状はそのままに
 *   規格に応じて拡大／縮小される（小さなステージで詰まりすぎない）。
 * - はみ出しは安全範囲（5–95% / 8–92%）に clamp する。
 */
export function rescaleSpotsForSpacing(
  spots: DancerSpot[],
  dancerSpacingMm: number | null | undefined,
  stageWidthMm: number | null | undefined,
  /** 既存プリセットが基準にしている x 方向のステップ（％）。 */
  referenceStepPct: number = FORMATION_REFERENCE_STEP_PCT
): DancerSpot[] {
  const stepPct = dancerStepPctFromSpacingMm(dancerSpacingMm, stageWidthMm);
  if (stepPct == null || referenceStepPct <= 0) return spots;
  const scale = stepPct / referenceStepPct;
  if (Math.abs(scale - 1) < 1e-3) return spots;
  return spots.map((s) => ({
    ...s,
    xPct: clampPct(50 + (s.xPct - 50) * scale, 5, 95),
    yPct: clampPct(50 + (s.yPct - 50) * scale, 8, 92),
  }));
}

/**
 * ドラッグ中の x 座標（％）に最も近い「規格スロット」を返す。
 *
 * 規格スロットは 50% を中心に半 step ずつ並ぶ点列：
 *   50, 50±step/2, 50±step, 50±1.5*step, 50±2*step, ...
 *
 * 半 step 刻みなので、奇数人の「センター乗せ」と偶数人の「割センター」の
 * どちらの並びでも同じスロット集合に吸い付く。
 *
 * 場ミリ規格が無効な場合は null（呼び出し側で従来挙動にフォールバック）。
 */
export function snapXPctToConvention(
  xPct: number,
  dancerSpacingMm: number | null | undefined,
  stageWidthMm: number | null | undefined,
  /** どこまで離れたら吸い付かないか（％）。既定は半 step */
  maxDistancePct?: number
): number | null {
  const stepPct = dancerStepPctFromSpacingMm(dancerSpacingMm, stageWidthMm);
  if (stepPct == null || stepPct <= 0) return null;
  const halfStep = stepPct / 2;
  const k = Math.round((xPct - 50) / halfStep);
  const snapped = 50 + k * halfStep;
  const limit = maxDistancePct ?? halfStep;
  if (Math.abs(snapped - xPct) > limit) return null;
  return clampPct(snapped, 2, 98);
}

/**
 * ステージ上に「規格スロット」のドットを薄く可視化するための座標列（％）。
 *
 * `maxAbsHalfStep` 個までセンターから両側に並べる（端を超えるものは間引く）。
 * 半 step 刻みなので奇数 / 偶数どちらの並びでも同じ点に乗る。
 */
export function dancerConventionGuideDotsPct(
  dancerSpacingMm: number | null | undefined,
  stageWidthMm: number | null | undefined,
  /** 何 step 分まで描くか（既定 8 step ＝ 16 半ステップ） */
  maxSteps = 8
): { xPct: number; isMain: boolean }[] {
  const stepPct = dancerStepPctFromSpacingMm(dancerSpacingMm, stageWidthMm);
  if (stepPct == null || stepPct <= 0) return [];
  const halfStep = stepPct / 2;
  const out: { xPct: number; isMain: boolean }[] = [];
  out.push({ xPct: 50, isMain: true });
  const halfCount = Math.max(1, Math.floor(maxSteps * 2));
  for (let k = 1; k <= halfCount; k++) {
    const x = 50 + k * halfStep;
    if (x > 98 || x < 2) break;
    /** integer step は「センター乗せ」位置（main）。half step は「割センター」位置 */
    const isMain = k % 2 === 0;
    out.push({ xPct: 100 - x, isMain });
    out.push({ xPct: x, isMain });
  }
  return out;
}

function clampPct(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

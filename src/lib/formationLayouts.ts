import type { DancerSpot } from "../types/choreography";
import {
  dancerStepPctFromSpacingMm,
  dancerXPositionsPctForCount,
  FORMATION_REFERENCE_STEP_PCT,
  rescaleSpotsForSpacing,
} from "./dancerSpacing";
import { modDancerColorIndex } from "./dancerColorPalette";
import { generateId } from "./generateId";

/**
 * 場ミリ規格を `dancersForLayoutPreset` / `dancersWithPresetAndWingSurplus`
 * に渡すための共通オプション。両値そろっているときだけ規格適用される。
 */
export interface LayoutPresetOptions {
  /** ダンサー間隔（mm）。`dancerSpacingMm` と同じ。 */
  dancerSpacingMm?: number | null;
  /** ステージ幅（mm）。`stageWidthMm` と同じ。 */
  stageWidthMm?: number | null;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function pushSpot(out: DancerSpot[], i: number, x: number, y: number) {
  out.push({
    id: generateId(),
    label: String(i + 1),
    xPct: clamp(x, 5, 95),
    yPct: clamp(y, 8, 92),
    colorIndex: modDancerColorIndex(i),
  });
}

/**
 * n 人を「一定の目安間隔」で等間隔に並べる座標列（％）。
 *
 * - 人数が少ないときはステージ端までは広げず、`preferredStepPct` 刻みで中央付近にまとめる。
 * - 人数が増えて目安間隔だと `[minPct, maxPct]` の範囲を超える場合のみ、均等間隔のまま
 *   範囲に収まるようステップを縮める（＝詰めて等間隔）。
 *
 * これで「2 人なら隣り合い、6 人でも隣り合い、20 人でも変わらず隣り合う」等、
 * 人数に関わらず見た目の間隔が揃うようになる。
 */
function evenSpacingPositions(
  n: number,
  center: number,
  preferredStepPct: number,
  minPct: number,
  maxPct: number
): number[] {
  if (n <= 0) return [];
  if (n === 1) return [center];
  const halfSpan = Math.min(center - minPct, maxPct - center);
  const maxTotal = Math.max(0, halfSpan * 2);
  const desiredTotal = preferredStepPct * (n - 1);
  const step =
    desiredTotal <= maxTotal ? preferredStepPct : maxTotal / (n - 1);
  const start = center - (step * (n - 1)) / 2;
  return Array.from({ length: n }, (_, i) => start + i * step);
}

/**
 * ステージ横方向の目安間隔（％）。隣り合う立ち位置間の距離。
 *
 * 場ミリ規格（`dancerSpacingMm`）が指定されたときは、生成後に
 * `rescaleSpotsForSpacing` で 50% を中心に等比拡大／縮小して規格に合わせる。
 * `FORMATION_REFERENCE_STEP_PCT` と同値（場ミリ規格モジュール側の参照と一致）。
 */
const TARGET_STEP_X = FORMATION_REFERENCE_STEP_PCT;
/**
 * ステージ奥行きの目安間隔（％）。列間の距離。
 * 名簿取り込み後の「名前は○の下」では、○＋名前で縦にかなり占めるため 10% だと
 * 段同士が重なりやすい。14% 前後を目安にする。
 */
const TARGET_STEP_Y = 14;

/**
 * 客席が下のとき: 行 r を奥→手前に線形配置（0 始まり）。
 *
 * 列間隔は `TARGET_STEP_Y`（％）を目安に固定し、人数が多くて範囲を超える場合のみ、
 * `[yUp, yDn]` の範囲に収まるよう等間隔に縮める。少人数でも横一列に広がらず、
 * 中央付近に列が密集するようになる。
 *
 * `yUp` / `yDn` は「○の下に名前」を想定し、上下に少し余白を残した帯にする。
 */
function yPctPyramidRow(r: number, numRows: number, yUp = 16, yDn = 78): number {
  if (numRows <= 1) return (yUp + yDn) / 2;
  const center = (yUp + yDn) / 2;
  const maxTotal = Math.max(0, yDn - yUp);
  const desiredTotal = TARGET_STEP_Y * (numRows - 1);
  const total = Math.min(desiredTotal, maxTotal);
  const top = center - total / 2;
  return top + (r / (numRows - 1)) * total;
}

/**
 * ピラミッド等で行ごとに人数が違うとき、「どの行も隣接間隔は等しい」グリッド上に
 * 並べて x 位置を返す。
 *
 * 水平ステップは `TARGET_STEP_X` を目安に固定し、多人数行で端に寄りすぎないための
 * 上限（`maxHalfWidth` から算出）を設ける。これで人数が少ない行は中心寄りに、
 * 多い行でも隣接同士は常に一定の近い間隔で並ぶようになる。
 */
function xPctInPyramidGrid(
  j: number,
  cnt: number,
  maxCnt: number,
  _numRows: number,
  /** （使っていない：互換のため引数シグネチャ維持） */
  _yRangePct = 52,
  /** 中心からの最大片側幅（％）。大人数でも端まで行かない上限 */
  maxHalfWidth = 32
): number {
  if (cnt <= 1) return 50;
  if (maxCnt <= 1) return 50;
  /** 最も広い行が端に寄りすぎない上限 */
  const stepCap = (maxHalfWidth * 2) / (maxCnt - 1);
  const step = Math.min(TARGET_STEP_X, stepCap);
  return 50 + (j - (cnt - 1) / 2) * step;
}

/**
 * ピラミッド（先端が奥・1 番が客席側）の行人数（手前→奥の順）。
 *
 * 最前列は常に 1 人、そこから奥に向かって 1 行ずつ 1 人ずつ増やしていく：
 *   - n = 1 → [1]
 *   - n = 2 → [1, 1]
 *   - n = 3 → [1, 2]       （手前 1、奥 2）
 *   - n = 4 → [1, 2, 1]
 *   - n = 5 → [1, 2, 2]
 *   - n = 6 → [1, 2, 3]
 *   - n = 7 → [1, 2, 3, 1]
 *   - n = 8 → [1, 2, 3, 2]
 *   - n = 9 → [1, 2, 3, 3]
 *   - n = 10 → [1, 2, 3, 4]
 *
 * 行数 k が揃わない端数は、最奥行に残りの人数を入れる（広がりすぎず三角に近い形を保つ）。
 */
function pyramidFrontOneGrowingRowCounts(n: number): number[] {
  if (n <= 0) return [];
  const rows: number[] = [];
  let rem = n;
  let w = 1;
  while (rem > 0) {
    const take = Math.min(w, rem);
    rows.push(take);
    rem -= take;
    w += 1;
  }
  return rows;
}

/**
 * 手前が広い逆ピラミッド: 基本は三角数 [1, 2, …, k]。
 *
 * 余り人数は **最前列にだけ積む** のではなく **前側から 1 人ずつ、上の行へ** 順に
 * 配っていく。こうすると人数が増えても形の幅（最前列の人数）がなだらかに増え、
 * 横に広がりすぎずに三角形のシルエットを保てる。
 *
 * 例:
 *   n=7  → [1,2,4]    (余1を最前列に)
 *   n=8  → [1,3,4]    (余2を最前列とその後ろに)
 *   n=9  → [2,3,4]    (余3を全列に)
 *   n=10 → [1,2,3,4]  (三角数ぴったり)
 *   n=11 → [1,2,3,5]
 *   n=12 → [1,2,4,5]
 *   n=13 → [1,3,4,5]
 *   n=14 → [2,3,4,5]
 */
function pyramidNarrowFirstRowCounts(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  let k = 1;
  while (((k + 1) * (k + 2)) / 2 <= n) k++;
  const tri = (k * (k + 1)) / 2;
  const rem = n - tri;
  const rows = Array.from({ length: k }, (_, i) => i + 1);
  for (let i = 0; i < rem; i++) {
    rows[k - 1 - i]! += 1;
  }
  return rows;
}

/**
 * 定番の「n 列均等配置」用に n 人を targetRows 個の列に割り振る。
 *
 * - 列数は `min(targetRows, n)` に制限（人数が少ないときは空の列を作らない）
 * - `floor(n / rows)` を基準にし、余りは **奥側の列から 1 人ずつ** 足す
 *   → 最前列（客席側）が等しいか少なめに保たれ、奥ほど見切れずバランスよく見える
 *
 * 戻り値は `counts[0]` が **最前列（客席側）**、末尾が **最奥列**。
 */
function evenRowCounts(n: number, targetRows: number): number[] {
  if (n <= 0 || targetRows <= 0) return [];
  const rows = Math.min(targetRows, n);
  const base = Math.floor(n / rows);
  const rem = n - base * rows;
  const counts = new Array<number>(rows).fill(base);
  for (let i = 0; i < rem; i++) {
    counts[rows - 1 - i]! += 1;
  }
  return counts;
}

/**
 * 客席側（y 大）の列から埋める行人数: first, first+1, first+2, …（最後の列は余りのみ）。
 * rowCounts[0] が最前列（手前）。
 */
function frontAudienceGrowingRowCounts(n: number, firstRow: number): number[] {
  if (n <= 0) return [];
  const rows: number[] = [];
  let rem = n;
  let w = Math.max(1, Math.floor(firstRow));
  while (rem > 0) {
    const take = Math.min(w, rem);
    rows.push(take);
    rem -= take;
    w += 1;
  }
  return rows;
}

/** UI 順・ラベル（id は dancersForLayoutPreset と一致させる） */
export const LAYOUT_PRESET_OPTIONS = [
  /** ★ 推奨順（先頭ブロック）: ユーザ指定の並び */
  { id: "line", label: "横一列" },
  { id: "pyramid", label: "ピラミッド" },
  { id: "pyramid_inverse", label: "逆ピラミッド" },
  { id: "stagger", label: "千鳥" },
  { id: "stagger_inverse", label: "逆千鳥" },
  { id: "two_rows", label: "2列" },
  { id: "rows_3", label: "3列" },
  { id: "rows_4", label: "4列" },
  { id: "rows_5", label: "5列" },
  /** ─ 列系 ─ */
  { id: "rows_6", label: "6列" },
  { id: "rows_7", label: "7列" },
  { id: "rows_8", label: "8列" },
  { id: "stagger_3", label: "3段千鳥" },
  { id: "offset_triple", label: "3列オフセット" },
  { id: "two_rows_dense_back", label: "2列（前少・奥多）" },
  /** ─ 段の列 ─ */
  { id: "front_stair_from_2", label: "段の列２（手前2人〜）" },
  { id: "front_stair_from_3", label: "段の列３（手前3人〜）" },
  { id: "front_stair_from_4", label: "段の列４（手前4人〜）" },
  { id: "front_stair_from_5", label: "段の列５（手前5人〜）" },
  { id: "front_stair_from_6", label: "段の列６（手前6人〜）" },
  { id: "front_stair_from_7", label: "段の列７（手前7人〜）" },
  { id: "front_stair_from_8", label: "段の列８（手前8人〜）" },
  { id: "front_stair_from_9", label: "段の列９（手前9人〜）" },
  { id: "front_stair_from_10", label: "段の列10（手前10人〜）" },
  { id: "front_stair_from_11", label: "段の列11（手前11人〜）" },
  /** ─ 直線・対角線 ─ */
  { id: "line_front", label: "横一列（客席寄り・手前）" },
  { id: "line_back", label: "横一列（奥）" },
  { id: "line_vertical", label: "縦一列（センター）" },
  { id: "diagonal_se", label: "斜め（↘）" },
  { id: "diagonal_ne", label: "斜め（↗）" },
  { id: "stairs_diag", label: "階段状" },
  { id: "zigzag", label: "ジグザグ" },
  /** ─ グリッド・縦列 ─ */
  { id: "grid", label: "グリッド" },
  { id: "columns_4", label: "4列縦並び" },
  { id: "columns_5", label: "5列縦並び" },
  { id: "columns_6", label: "6列縦並び" },
  { id: "columns_7", label: "7列縦並び" },
  { id: "columns_8", label: "8列縦並び" },
  { id: "columns_9", label: "9列縦並び" },
  { id: "columns_10", label: "10列縦並び" },
  /** ─ ピラミッド・V字系 ─ */
  { id: "vee", label: "V字" },
  { id: "inverse_vee", label: "逆V字（奥に先端）" },
  { id: "wedge", label: "楔（手前先端）" },
  { id: "fan_back", label: "扇状（奥を頂点）" },
  { id: "hourglass", label: "砂時計（前後広・中狭）" },
  { id: "bowtie", label: "蝶ネクタイ" },
  { id: "arrow_back", label: "矢印（奥向き）" },
  { id: "arrow_front", label: "矢印（手前向き）" },
  /** ─ 弧・円形 ─ */
  { id: "arc", label: "円弧（客席向き）" },
  { id: "arc_tight", label: "円弧（狭い）" },
  { id: "circle", label: "円周均等" },
  { id: "hollow_ring", label: "周辺リング" },
  { id: "double_ring", label: "二重リング" },
  { id: "u_shape", label: "U字（客席向き）" },
  { id: "double_arc", label: "二重弧（客席向き）" },
  { id: "concentric", label: "同心グループ（中+外）" },
  /** ─ グループ分け・3分割 ─ */
  { id: "block_lr", label: "左右ブロック" },
  { id: "block_3", label: "3ブロック（左・中・右）" },
  { id: "block_3_depth", label: "3グループ（前・中・奥）" },
  { id: "three_clusters", label: "3密集（前+左奥+右奥）" },
  { id: "wing_spread", label: "翼形（中央+左右ウィング）" },
  { id: "cross_split", label: "十字グループ" },
  /** ─ 幾何形・枠形 ─ */
  { id: "diamond", label: "ひし形周り" },
  { id: "square_outline", label: "四角枠（周り）" },
  { id: "cross", label: "十字形" },
  { id: "x_shape", label: "X字形" },
  /** ─ 個性的・アート系 ─ */
  { id: "scatter", label: "ランダム風（固定パターン）" },
  { id: "spiral", label: "螺旋" },
  { id: "wave", label: "波型ライン" },
  { id: "cluster_tight", label: "密集（センター）" },
  { id: "spread_loose", label: "広く分散" },
  { id: "asymmetric_l", label: "アシンメ L字" },
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_OPTIONS)[number]["id"];

export const LAYOUT_PRESET_LABELS = Object.fromEntries(
  LAYOUT_PRESET_OPTIONS.map((o) => [o.id, o.label])
) as Record<LayoutPresetId, string>;

export const ALL_LAYOUT_PRESET_IDS: LayoutPresetId[] = LAYOUT_PRESET_OPTIONS.map(
  (o) => o.id
);

/**
 * 立ち位置クイックバー・名簿「未配置を一括でステージへ」で共通利用するプリセット一覧。
 * キュー作成ダイアログ等の `LAYOUT_PRESET_OPTIONS` と同一の並び・種類。
 */
export const COMMON_QUICK_LAYOUT_PRESETS: { id: LayoutPresetId; label: string }[] =
  LAYOUT_PRESET_OPTIONS.map((o) => ({ id: o.id, label: o.label }));

/**
 * 雛形選択 UI で使うカテゴリ定義。
 * キュー追加ダイアログ・名簿プリセットモーダルで共有。
 */
export const PRESET_CATEGORIES: { label: string; ids: LayoutPresetId[] }[] = [
  {
    label: "▲ ピラミッド・V字系",
    ids: [
      "pyramid",
      "pyramid_inverse",
      "vee",
      "inverse_vee",
      "wedge",
      "fan_back",
      "hourglass",
      "bowtie",
      "arrow_back",
      "arrow_front",
    ],
  },
  {
    label: "🟦 複数列・千鳥",
    ids: [
      "two_rows",
      "rows_3",
      "rows_4",
      "rows_5",
      "rows_6",
      "rows_7",
      "rows_8",
      "stagger",
      "stagger_inverse",
      "stagger_3",
      "two_rows_dense_back",
      "offset_triple",
    ],
  },
  {
    label: "📐 段の列（客席側から増える）",
    ids: [
      "front_stair_from_2",
      "front_stair_from_3",
      "front_stair_from_4",
      "front_stair_from_5",
      "front_stair_from_6",
      "front_stair_from_7",
      "front_stair_from_8",
      "front_stair_from_9",
      "front_stair_from_10",
      "front_stair_from_11",
    ],
  },
  {
    label: "➖ 直線・対角線",
    ids: [
      "line",
      "line_front",
      "line_back",
      "line_vertical",
      "diagonal_se",
      "diagonal_ne",
      "stairs_diag",
      "zigzag",
    ],
  },
  {
    label: "⬜ グリッド・縦列",
    ids: [
      "grid",
      "columns_4",
      "columns_5",
      "columns_6",
      "columns_7",
      "columns_8",
      "columns_9",
      "columns_10",
    ],
  },
  {
    label: "🌐 弧・円形",
    ids: [
      "arc",
      "arc_tight",
      "double_arc",
      "circle",
      "hollow_ring",
      "double_ring",
      "u_shape",
      "concentric",
    ],
  },
  {
    label: "🔀 グループ分け・3分割",
    ids: [
      "block_lr",
      "block_3",
      "block_3_depth",
      "three_clusters",
      "wing_spread",
      "cross_split",
    ],
  },
  {
    label: "✴️ 幾何形・枠形",
    ids: ["diamond", "square_outline", "cross", "x_shape"],
  },
  {
    label: "🎨 個性・アート系",
    ids: [
      "scatter",
      "spiral",
      "wave",
      "cluster_tight",
      "spread_loose",
      "asymmetric_l",
    ],
  },
];

/**
 * 番号割り当てルール（ユーザ指定）:
 *
 * - 必ず **客席に近い側（y が大きい側）** の列から順に番号を振る
 * - **1列目（最前列）だけ** センター起点（中央 #1、左 #2、右 #3、さらに左 #4…）
 * - **2列目以降は 左→右** の順に連番（左端が一番小さい番号）
 *
 * プリセットで生成した位置列の末尾で呼び、ラベルと配色を打ち直す。
 */
function relabelByAudienceCenterOut(dancers: DancerSpot[]): DancerSpot[] {
  if (dancers.length <= 1) {
    return dancers.map((d, i) => ({
      ...d,
      label: String(i + 1),
      colorIndex: modDancerColorIndex(i),
    }));
  }
  /** 行（y）のグルーピング許容値（％）。列間隔が広いプリセットでも同じ行にまとまるよう少し余裕 */
  const Y_EPS = 4;

  const indexed = dancers.map((d, i) => ({ d, i }));
  // y 降順で安定ソート（同じ y はとりあえず元順のまま）
  indexed.sort((a, b) => b.d.yPct - a.d.yPct);

  // 同じ y とみなせる範囲で行（row）にまとめる
  const rows: { d: DancerSpot; i: number }[][] = [];
  for (const it of indexed) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0]!.d.yPct - it.d.yPct) <= Y_EPS) {
      last.push(it);
    } else {
      rows.push([it]);
    }
  }

  const newLabelByIdx = new Array<number>(dancers.length).fill(0);
  let seq = 1;
  rows.forEach((row, rowIdx) => {
    if (rowIdx === 0) {
      // 最前列：センターから近い順、同距離なら左側を先
      const sorted = [...row].sort((a, b) => {
        const da = Math.abs(a.d.xPct - 50);
        const db = Math.abs(b.d.xPct - 50);
        if (Math.abs(da - db) > 0.5) return da - db;
        return a.d.xPct - b.d.xPct;
      });
      for (const it of sorted) newLabelByIdx[it.i] = seq++;
    } else {
      // 2列目以降：左から順（x 昇順）
      const sorted = [...row].sort((a, b) => a.d.xPct - b.d.xPct);
      for (const it of sorted) newLabelByIdx[it.i] = seq++;
    }
  });

  return dancers.map((d, i) => ({
    ...d,
    label: String(newLabelByIdx[i]),
    colorIndex: modDancerColorIndex(newLabelByIdx[i]! - 1),
  }));
}

/**
 * n 人分の立ち位置（%）。
 * 画面下が観客席帯の UI に合わせ、y が大きいほど客席に近い（手前）とする。
 *
 * `opts.dancerSpacingMm` と `opts.stageWidthMm` の両方が指定されていれば、
 * 最終結果をその場ミリ規格に合わせてセンターから等比拡大／縮小する
 * （隣同士が指定 mm 間隔、偶数人は割センター、奇数人はセンター乗せ、
 *  のあなたの流派ルール）。指定がないときは従来 % ベースの挙動。
 */
export function dancersForLayoutPreset(
  n: number,
  preset: LayoutPresetId,
  opts?: LayoutPresetOptions
): DancerSpot[] {
  if (n <= 0) return [];
  const out: DancerSpot[] = [];
  /** 横一列系で場ミリから直接敷いたとき、`rescaleSpotsForSpacing` の参照％を実ステップに合わせる */
  let lineSpacingReferencePct: number | null = null;

  switch (preset) {
    case "line": {
      const stepPct = dancerStepPctFromSpacingMm(
        opts?.dancerSpacingMm,
        opts?.stageWidthMm
      );
      if (stepPct != null && stepPct > 0) {
        const xs = dancerXPositionsPctForCount(n, stepPct);
        xs.forEach((x, i) => pushSpot(out, i, x, 44));
        lineSpacingReferencePct = stepPct;
      } else {
        const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 8, 92);
        xs.forEach((x, i) => pushSpot(out, i, x, 44));
      }
      break;
    }
    case "line_front": {
      const stepPct = dancerStepPctFromSpacingMm(
        opts?.dancerSpacingMm,
        opts?.stageWidthMm
      );
      if (stepPct != null && stepPct > 0) {
        const xs = dancerXPositionsPctForCount(n, stepPct);
        xs.forEach((x, i) => pushSpot(out, i, x, 66));
        lineSpacingReferencePct = stepPct;
      } else {
        const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 10, 90);
        xs.forEach((x, i) => pushSpot(out, i, x, 66));
      }
      break;
    }
    case "line_back": {
      const stepPct = dancerStepPctFromSpacingMm(
        opts?.dancerSpacingMm,
        opts?.stageWidthMm
      );
      if (stepPct != null && stepPct > 0) {
        const xs = dancerXPositionsPctForCount(n, stepPct);
        xs.forEach((x, i) => pushSpot(out, i, x, 24));
        lineSpacingReferencePct = stepPct;
      } else {
        const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 12, 88);
        xs.forEach((x, i) => pushSpot(out, i, x, 24));
      }
      break;
    }
    case "line_vertical": {
      const ys = evenSpacingPositions(n, 48, TARGET_STEP_Y, 22, 78);
      ys.forEach((y, i) => pushSpot(out, i, 50, y));
      break;
    }
    case "fan_back": {
      const apexX = 50;
      const apexY = 22;
      const sweep = Math.min(0.42 * Math.PI, 0.11 * Math.max(n, 3));
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const ang = Math.PI / 2 - sweep + u * (2 * sweep);
        const r = 28 + Math.min(8, n * 0.35);
        pushSpot(out, i, apexX + r * Math.cos(ang), apexY + r * Math.sin(ang));
      }
      break;
    }
    case "square_outline": {
      if (n === 1) {
        pushSpot(out, 0, 50, 50);
        break;
      }
      /** 軸そろえの四角（上辺＝奥）。周長に沿って等分 */
      const verts: [number, number][] = [
        [22, 22],
        [78, 22],
        [78, 78],
        [22, 78],
      ];
      const edges = 4;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * edges;
        const seg = Math.floor(t) % edges;
        const u = t - seg;
        const a = verts[seg]!;
        const b = verts[(seg + 1) % 4]!;
        pushSpot(out, i, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
      }
      break;
    }
    case "arc": {
      const a0 = Math.PI * 0.2;
      const a1 = Math.PI * 0.8;
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const a = a0 + (a1 - a0) * u;
        const cx = 50;
        const cy = 52;
        const r = 26 + Math.min(8, n * 0.35);
        pushSpot(out, i, cx + r * Math.cos(a), cy - r * Math.sin(a));
      }
      break;
    }
    case "arc_tight": {
      const a0 = Math.PI * 0.35;
      const a1 = Math.PI * 0.65;
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const a = a0 + (a1 - a0) * u;
        const cx = 50;
        const cy = 54;
        const r = 16 + Math.min(5, n * 0.2);
        pushSpot(out, i, cx + r * Math.cos(a), cy - r * Math.sin(a));
      }
      break;
    }
    case "vee": {
      const leftN = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) {
        if (i < leftN) {
          const t = leftN <= 1 ? 0.5 : i / (leftN - 1);
          pushSpot(out, i, 28 + t * 22, 36 + t * 28);
        } else {
          const j = i - leftN;
          const rightN = n - leftN;
          const t = rightN <= 1 ? 0.5 : j / (rightN - 1);
          pushSpot(out, i, 72 - t * 22, 36 + t * 28);
        }
      }
      break;
    }
    case "grid": {
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const xs = evenSpacingPositions(cols, 50, TARGET_STEP_X, 10, 90);
      const ys = evenSpacingPositions(rows, 48, TARGET_STEP_Y, 16, 80);
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        pushSpot(out, i, xs[col]!, ys[row]!);
      }
      break;
    }
    case "diamond": {
      if (n === 1) {
        pushSpot(out, 0, 50, 50);
        break;
      }
      const verts = [
        { x: 50, y: 28 },
        { x: 78, y: 50 },
        { x: 50, y: 72 },
        { x: 22, y: 50 },
      ];
      for (let i = 0; i < n; i++) {
        const pos = (i / n) * 4;
        const seg = Math.floor(pos) % 4;
        const t = pos - seg;
        const a = verts[seg];
        const b = verts[(seg + 1) % 4];
        pushSpot(out, i, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
      break;
    }
    case "pyramid": {
      /** rowCounts[0] が最前列（客席側・y 大）。以降、奥へ 1 行ずつ。 */
      const rowCounts = pyramidFrontOneGrowingRowCounts(n);
      const nr = rowCounts.length;
      /**
       * 各行 r は「本来 (r+1) 人並ぶ幅」を占める想定で配置する。
       * これで奥の行ほど横幅が広がり、実人数が仮想枠より少ない行では
       * その枠の中に等間隔で均等配置されるため三角形のシルエットを保てる。
       */
      const maxVirtualW = nr;
      const maxHalfWidth = 32;
      const stepCap =
        maxVirtualW > 1 ? (maxHalfWidth * 2) / (maxVirtualW - 1) : TARGET_STEP_X;
      const step = Math.min(TARGET_STEP_X, stepCap);
      let idx = 0;
      for (let r = 0; r < nr; r++) {
        const cnt = rowCounts[r]!;
        const virtualW = r + 1;
        const y = yPctPyramidRow(nr - 1 - r, nr);
        /** 仮想枠の幅（％）。この行が本来並ぶ左右幅。 */
        const span = step * (virtualW - 1);
        if (cnt === 1) {
          pushSpot(out, idx++, 50, y);
        } else {
          /** 実人数 cnt を仮想枠の中に等間隔で展開する */
          for (let j = 0; j < cnt; j++) {
            const x = 50 - span / 2 + (span / (cnt - 1)) * j;
            pushSpot(out, idx++, x, y);
          }
        }
      }
      break;
    }
    case "pyramid_inverse": {
      const rowCounts = pyramidNarrowFirstRowCounts(n);
      const nr = rowCounts.length;
      const maxCnt = Math.max(1, ...rowCounts);
      let idx = 0;
      for (let r = 0; r < nr; r++) {
        const cnt = rowCounts[r]!;
        const y = yPctPyramidRow(r, nr);
        for (let j = 0; j < cnt; j++) {
          pushSpot(out, idx++, xPctInPyramidGrid(j, cnt, maxCnt, nr), y);
        }
      }
      break;
    }
    case "front_stair_from_2":
    case "front_stair_from_3":
    case "front_stair_from_4":
    case "front_stair_from_5":
    case "front_stair_from_6":
    case "front_stair_from_7":
    case "front_stair_from_8":
    case "front_stair_from_9":
    case "front_stair_from_10":
    case "front_stair_from_11": {
      const first = parseInt(preset.replace("front_stair_from_", ""), 10);
      const rowCounts = frontAudienceGrowingRowCounts(
        n,
        Math.max(2, Math.min(11, first))
      );
      const nr = rowCounts.length;
      const maxCnt = Math.max(1, ...rowCounts);
      let idx = 0;
      for (let r = 0; r < nr; r++) {
        const cnt = rowCounts[r]!;
        const y = yPctPyramidRow(nr - 1 - r, nr);
        for (let j = 0; j < cnt; j++) {
          pushSpot(out, idx++, xPctInPyramidGrid(j, cnt, maxCnt, nr), y);
        }
      }
      break;
    }
    case "rows_3":
    case "rows_4":
    case "rows_5":
    case "rows_6": {
      const target =
        preset === "rows_3"
          ? 3
          : preset === "rows_4"
            ? 4
            : preset === "rows_5"
              ? 5
              : 6;
      /** counts[0] が最前列（客席側）、末尾が最奥列。 */
      const rowCounts = evenRowCounts(n, target);
      const nr = rowCounts.length;
      let idx = 0;
      for (let r = 0; r < nr; r++) {
        const cnt = rowCounts[r]!;
        /** r=0 が手前（y 大）、r=nr-1 が奥（y 小）。 */
        const y = yPctPyramidRow(nr - 1 - r, nr);
        /** 長い表示名が横にはみ出しにくいよう、横方向の余白をやや広げる */
        const xs = evenSpacingPositions(cnt, 50, TARGET_STEP_X, 5, 95);
        for (let j = 0; j < cnt; j++) {
          pushSpot(out, idx++, xs[j]!, y);
        }
      }
      break;
    }
    case "stagger": {
      const rows = 2;
      const per = Math.ceil(n / rows);
      const xs = evenSpacingPositions(per, 50, TARGET_STEP_X, 12, 88);
      /** 千鳥: 手前列（客席寄り・y 大）を横に半ステップずらす */
      for (let i = 0; i < n; i++) {
        const r = i % rows;
        const col = Math.floor(i / rows);
        const offset = r === 1 ? TARGET_STEP_X / 2 : 0;
        /** 奥行きを確保（名前が○の下のときの重なり防止） */
        pushSpot(out, i, (xs[col] ?? 50) + offset, r === 0 ? 30 : 60);
      }
      break;
    }
    case "stagger_inverse": {
      /**
       * 逆千鳥（ユーザ基準図）:
       * - 奥行（y 小）に `ceil(n/2)` 人を等間隔
       * - 手前（y 大）に残りを、奥の隣同士の中点（隙間）に並べる（奇数 n で奥が 1 人多い）
       * - 同人数のときは二段とも等間隔＋手前をハーフステップずらす
       */
      const yBack = 30;
      const yFront = 60;
      const nBack = Math.ceil(n / 2);
      const nFront = n - nBack;

      if (n === 1) {
        pushSpot(out, 0, 50, yFront);
        break;
      }

      const xsBack = evenSpacingPositions(nBack, 50, TARGET_STEP_X, 12, 88);
      let idx = 0;
      for (let j = 0; j < nBack; j++) {
        pushSpot(out, idx++, xsBack[j]!, yBack);
      }

      if (nFront === 0) break;

      let xsFront: number[];
      if (nBack >= 2 && nFront <= nBack - 1) {
        const nGap = nBack - 1;
        const start = Math.max(0, Math.floor((nGap - nFront) / 2));
        xsFront = [];
        for (let j = 0; j < nFront; j++) {
          const k = start + j;
          xsFront.push((xsBack[k]! + xsBack[k + 1]!) / 2);
        }
      } else {
        /** n_front === n_back（同数）など */
        if (nBack === 1) {
          xsFront = evenSpacingPositions(nFront, 50, TARGET_STEP_X, 12, 88);
        } else {
          const halfStep = (xsBack[1]! - xsBack[0]!) / 2;
          const raw = evenSpacingPositions(nFront, 50, TARGET_STEP_X, 12, 88);
          xsFront = raw.map((x) => x + halfStep);
        }
      }

      for (let j = 0; j < nFront; j++) {
        pushSpot(out, idx++, xsFront[j] ?? 50, yFront);
      }
      break;
    }
    case "two_rows": {
      const front = Math.ceil(n / 2);
      const back = n - front;
      const xsFront = evenSpacingPositions(front, 50, TARGET_STEP_X, 10, 90);
      const xsBack = evenSpacingPositions(back, 50, TARGET_STEP_X, 12, 88);
      for (let i = 0; i < n; i++) {
        const isFront = i < front;
        const idx = isFront ? i : i - front;
        const x = isFront ? xsFront[idx]! : (xsBack[idx] ?? 50);
        const y = isFront ? 62 : 28;
        pushSpot(out, i, x, y);
      }
      break;
    }
    case "circle": {
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = 22 + Math.min(6, n * 0.25);
        pushSpot(out, i, 50 + r * Math.cos(ang), 50 + r * Math.sin(ang) * 0.85);
      }
      break;
    }
    case "u_shape": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        let x: number;
        let y: number;
        if (u < 1 / 3) {
          const t = u / (1 / 3);
          x = 24;
          y = 32 + t * 36;
        } else if (u < 2 / 3) {
          const t = (u - 1 / 3) / (1 / 3);
          x = 24 + t * 52;
          y = 68;
        } else {
          const t = (u - 2 / 3) / (1 / 3);
          x = 76;
          y = 68 - t * 36;
        }
        pushSpot(out, i, x, y);
      }
      break;
    }
    case "diagonal_se": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        pushSpot(out, i, 22 + u * 56, 30 + u * 42);
      }
      break;
    }
    case "diagonal_ne": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        pushSpot(out, i, 22 + u * 56, 72 - u * 42);
      }
      break;
    }
    case "columns_4": {
      const cols = Math.min(4, Math.max(1, n));
      const per = Math.ceil(n / cols);
      const xs = evenSpacingPositions(cols, 50, TARGET_STEP_X, 14, 86);
      const ys = evenSpacingPositions(per, 48, TARGET_STEP_Y, 16, 80);
      for (let i = 0; i < n; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        pushSpot(out, i, xs[c]!, ys[r]!);
      }
      break;
    }
    case "wedge": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const spread = 18 + u * 52;
        const x = 50 + (u - 0.5) * spread;
        const y = 66 - u * 32;
        pushSpot(out, i, x, y);
      }
      break;
    }
    case "scatter": {
      for (let i = 0; i < n; i++) {
        const x = 50 + Math.sin(i * 2.391 + 0.3) * 32 + Math.cos(i * 1.17) * 12;
        const y = 50 + Math.cos(i * 1.883) * 26 + Math.sin(i * 0.91) * 10;
        pushSpot(out, i, x, y);
      }
      break;
    }
    case "spiral": {
      for (let i = 0; i < n; i++) {
        const ang = i * 0.65;
        const r = 6 + i * 1.35;
        pushSpot(out, i, 50 + r * Math.cos(ang), 52 + r * Math.sin(ang) * 0.82);
      }
      break;
    }
    case "wave": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const x = 14 + u * 72;
        const y = 48 + Math.sin(u * Math.PI * 3) * 14;
        pushSpot(out, i, x, y);
      }
      break;
    }
    case "block_lr": {
      const leftN = Math.ceil(n / 2);
      const rightN = n - leftN;
      const cols = 2;
      const leftRows = Math.ceil(leftN / cols);
      const rightRows = Math.ceil(rightN / cols);
      const xsLeft = evenSpacingPositions(cols, 28, TARGET_STEP_X, 10, 44);
      const xsRight = evenSpacingPositions(cols, 72, TARGET_STEP_X, 56, 90);
      const ysLeft = evenSpacingPositions(leftRows, 48, TARGET_STEP_Y, 20, 76);
      const ysRight = evenSpacingPositions(rightRows, 48, TARGET_STEP_Y, 20, 76);
      for (let i = 0; i < n; i++) {
        if (i < leftN) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          pushSpot(out, i, xsLeft[col] ?? 28, ysLeft[row] ?? 48);
        } else {
          const j = i - leftN;
          const col = j % cols;
          const row = Math.floor(j / cols);
          pushSpot(out, i, xsRight[col] ?? 72, ysRight[row] ?? 48);
        }
      }
      break;
    }
    case "two_rows_dense_back": {
      const front = Math.max(1, Math.floor(n / 2));
      const back = n - front;
      const xsFront = evenSpacingPositions(front, 50, TARGET_STEP_X, 12, 88);
      const xsBack = evenSpacingPositions(back, 50, TARGET_STEP_X, 10, 90);
      for (let i = 0; i < n; i++) {
        const isFront = i < front;
        const idx = isFront ? i : i - front;
        const x = isFront ? xsFront[idx]! : (xsBack[idx] ?? 50);
        const y = isFront ? 62 : 26;
        pushSpot(out, i, x, y);
      }
      break;
    }
    case "inverse_vee": {
      if (n === 1) {
        pushSpot(out, 0, 50, 44);
        break;
      }
      pushSpot(out, 0, 50, 24);
      const rest = n - 1;
      const left = Math.ceil(rest / 2);
      for (let k = 1; k <= left; k++) {
        const t = k / (left + 1);
        pushSpot(out, k, 26 + t * 20, 30 + t * 32);
      }
      for (let k = 1; k <= rest - left; k++) {
        const t = k / (rest - left + 1);
        pushSpot(out, left + k, 74 - t * 20, 30 + t * 32);
      }
      break;
    }
    case "cluster_tight": {
      const base: [number, number][] = [
        [48, 50],
        [52, 52],
        [46, 54],
        [54, 48],
        [50, 48],
      ];
      for (let i = 0; i < n; i++) {
        const [bx, by] = base[i % base.length]!;
        const ring = Math.floor(i / base.length);
        pushSpot(out, i, bx + (ring % 2) * 1.4, by + ring * 1.1);
      }
      break;
    }
    case "spread_loose": {
      const pos: [number, number][] = [
        [16, 20],
        [50, 14],
        [84, 20],
        [12, 48],
        [88, 48],
        [22, 82],
        [50, 88],
        [78, 82],
      ];
      for (let i = 0; i < n; i++) {
        const [px, py] = pos[i % pos.length]!;
        const ring = Math.floor(i / pos.length);
        pushSpot(out, i, px + ring * 2.2, py - ring * 1.5);
      }
      break;
    }
    case "asymmetric_l": {
      const cut = Math.max(1, Math.ceil(n * 0.52));
      for (let i = 0; i < n; i++) {
        if (i < cut) {
          pushSpot(out, i, 22, 26 + i * 9);
        } else {
          const j = i - cut;
          pushSpot(out, i, 32 + j * 14, 74);
        }
      }
      break;
    }
    case "hollow_ring": {
      for (let i = 0; i < n; i++) {
        const ang = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
        const rx = 32;
        const ry = 24;
        pushSpot(out, i, 50 + rx * Math.cos(ang), 50 + ry * Math.sin(ang));
      }
      break;
    }
    case "stairs_diag": {
      for (let i = 0; i < n; i++) {
        const u = n <= 1 ? 0.5 : i / (n - 1);
        pushSpot(out, i, 18 + u * 64, 30 + u * 38 + (i % 3) * 3);
      }
      break;
    }
    case "offset_triple": {
      const cols = Math.min(3, Math.max(1, n));
      const per = Math.ceil(n / cols);
      const xs = evenSpacingPositions(cols, 50, TARGET_STEP_X * 1.6, 20, 80);
      const ys = evenSpacingPositions(per, 48, TARGET_STEP_Y, 18, 78);
      for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const offset = col === 1 ? TARGET_STEP_Y / 2 : 0;
        pushSpot(out, i, xs[col]!, ys[row]! + offset);
      }
      break;
    }
    case "rows_7":
    case "rows_8": {
      const target = preset === "rows_7" ? 7 : 8;
      const rowCounts = evenRowCounts(n, target);
      const nr = rowCounts.length;
      let idx = 0;
      for (let r = 0; r < nr; r++) {
        const cnt = rowCounts[r]!;
        const y = yPctPyramidRow(nr - 1 - r, nr);
        const xs = evenSpacingPositions(cnt, 50, TARGET_STEP_X, 5, 95);
        for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
      }
      break;
    }
    case "stagger_3": {
      /** 3段千鳥: 奥・中・手前の3段をそれぞれ半ステップずらしながら */
      const rows = 3;
      const per = Math.ceil(n / rows);
      const xs = evenSpacingPositions(per, 50, TARGET_STEP_X, 10, 90);
      const ys = [25, 48, 71];
      for (let i = 0; i < n; i++) {
        const r = i % rows;
        const col = Math.floor(i / rows);
        const offset = r === 1 ? TARGET_STEP_X / 2 : r === 2 ? TARGET_STEP_X : 0;
        pushSpot(out, i, (xs[col] ?? 50) + offset, ys[r]!);
      }
      break;
    }
    case "columns_5":
    case "columns_6":
    case "columns_7":
    case "columns_8":
    case "columns_9":
    case "columns_10": {
      const cols =
        preset === "columns_5" ? 5
        : preset === "columns_6" ? 6
        : preset === "columns_7" ? 7
        : preset === "columns_8" ? 8
        : preset === "columns_9" ? 9
        : 10;
      const actualCols = Math.min(cols, Math.max(1, n));
      const per = Math.ceil(n / actualCols);
      const xs = evenSpacingPositions(actualCols, 50, TARGET_STEP_X, 8, 92);
      const ys = evenSpacingPositions(per, 48, TARGET_STEP_Y, 16, 80);
      for (let i = 0; i < n; i++) {
        const c = i % actualCols;
        const r = Math.floor(i / actualCols);
        pushSpot(out, i, xs[c]!, ys[r]!);
      }
      break;
    }
    case "zigzag": {
      /** ジグザグ: 横一列を前後に交互にずらしながら配置 */
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const x = 14 + u * 72;
        const y = 48 + (i % 2 === 0 ? -12 : 12);
        pushSpot(out, i, x, y);
      }
      break;
    }
    case "block_3": {
      /** 3ブロック横（左・中・右）: 1/3ずつ3つのグループに縦に積む */
      const sizes = [Math.ceil(n / 3), Math.ceil((n - Math.ceil(n / 3)) / 2), n - Math.ceil(n / 3) - Math.ceil((n - Math.ceil(n / 3)) / 2)];
      const centers = [22, 50, 78];
      let idx = 0;
      for (let g = 0; g < 3; g++) {
        const cnt = Math.max(0, sizes[g]!);
        const rows = Math.ceil(cnt / 2);
        const ys = evenSpacingPositions(Math.max(1, rows), 48, TARGET_STEP_Y * 0.9, 20, 76);
        for (let k = 0; k < cnt; k++) {
          const col = k % 2;
          const row = Math.floor(k / 2);
          const xOff = (col === 0 ? -TARGET_STEP_X / 2 : TARGET_STEP_X / 2);
          pushSpot(out, idx++, centers[g]! + xOff, ys[row] ?? 48);
        }
      }
      break;
    }
    case "block_3_depth": {
      /** 3グループ（前・中・奥）: 深さ方向に3分割、各グループは横一列 */
      const sizeF = Math.ceil(n / 3);
      const sizeM = Math.ceil((n - sizeF) / 2);
      const sizeB = n - sizeF - sizeM;
      const groups = [
        { cnt: Math.max(0, sizeF), y: 72 },
        { cnt: Math.max(0, sizeM), y: 48 },
        { cnt: Math.max(0, sizeB), y: 24 },
      ];
      let idx = 0;
      for (const g of groups) {
        const xs = evenSpacingPositions(Math.max(1, g.cnt), 50, TARGET_STEP_X, 10, 90);
        for (let k = 0; k < g.cnt; k++) pushSpot(out, idx++, xs[k]!, g.y);
      }
      break;
    }
    case "three_clusters": {
      /** 3密集グループ（前中央・左奥・右奥）: 三角形に配置した3つの密集体 */
      const clusterCenters: [number, number][] = [[50, 74], [22, 24], [78, 24]];
      for (let i = 0; i < n; i++) {
        const g = i % 3;
        const k = Math.floor(i / 3);
        const [cx, cy] = clusterCenters[g]!;
        /** 各クラスターは螺旋状に広がる */
        const ang = k * 2.4;
        const r = k === 0 ? 0 : 3 + k * 2.5;
        pushSpot(out, i, cx + r * Math.cos(ang), cy + r * Math.sin(ang) * 0.7);
      }
      break;
    }
    case "wing_spread": {
      /** 翼形（センター縦列 + 左右ウィング） */
      const centerN = Math.max(1, Math.round(n * 0.34));
      const wingN = n - centerN;
      const leftN = Math.ceil(wingN / 2);
      const rightN = wingN - leftN;
      let idx = 0;
      /** センター縦列 */
      const ysC = evenSpacingPositions(centerN, 48, TARGET_STEP_Y, 20, 76);
      for (let k = 0; k < centerN; k++) pushSpot(out, idx++, 50, ysC[k]!);
      /** 左ウィング: 斜め上に広がる */
      for (let k = 0; k < leftN; k++) {
        const t = leftN <= 1 ? 0.5 : k / (leftN - 1);
        pushSpot(out, idx++, 22 + t * 18, 44 + t * 22);
      }
      /** 右ウィング */
      for (let k = 0; k < rightN; k++) {
        const t = rightN <= 1 ? 0.5 : k / (rightN - 1);
        pushSpot(out, idx++, 78 - t * 18, 44 + t * 22);
      }
      break;
    }
    case "cross_split": {
      /** 十字グループ: 前・奥・左・右・中央の5方向グループ */
      const perGroup = Math.max(1, Math.floor(n / 5));
      const remainder = n - perGroup * 5;
      const groupSizes = [perGroup + (remainder > 0 ? 1 : 0), perGroup + (remainder > 1 ? 1 : 0), perGroup + (remainder > 2 ? 1 : 0), perGroup + (remainder > 3 ? 1 : 0), n - (perGroup + (remainder > 0 ? 1 : 0)) - (perGroup + (remainder > 1 ? 1 : 0)) - (perGroup + (remainder > 2 ? 1 : 0)) - (perGroup + (remainder > 3 ? 1 : 0))];
      const groupCenters: [number, number][] = [[50, 74], [50, 24], [18, 48], [82, 48], [50, 48]];
      let idx = 0;
      for (let g = 0; g < 5; g++) {
        const cnt = Math.max(0, groupSizes[g]!);
        const [cx, cy] = groupCenters[g]!;
        const ys = evenSpacingPositions(Math.max(1, cnt), cy, TARGET_STEP_Y * 0.7, cy - 10, cy + 10);
        for (let k = 0; k < cnt; k++) pushSpot(out, idx++, cx, ys[k] ?? cy);
      }
      break;
    }
    case "double_arc": {
      /** 二重弧（内側・外側）: 前半は内側弧、後半は外側弧 */
      const innerN = Math.ceil(n / 2);
      const outerN = n - innerN;
      for (let i = 0; i < innerN; i++) {
        const u = innerN === 1 ? 0.5 : i / (innerN - 1);
        const a = Math.PI * 0.25 + u * Math.PI * 0.5;
        pushSpot(out, i, 50 + 18 * Math.cos(a), 60 - 18 * Math.sin(a));
      }
      for (let i = 0; i < outerN; i++) {
        const u = outerN === 1 ? 0.5 : i / (outerN - 1);
        const a = Math.PI * 0.15 + u * Math.PI * 0.7;
        pushSpot(out, innerN + i, 50 + 32 * Math.cos(a), 62 - 32 * Math.sin(a));
      }
      break;
    }
    case "double_ring": {
      /** 二重リング（内外2円）: 前半は内側、後半は外側 */
      const innerN = Math.ceil(n / 2);
      const outerN = n - innerN;
      for (let i = 0; i < innerN; i++) {
        const ang = (i / Math.max(innerN, 1)) * Math.PI * 2 - Math.PI / 2;
        pushSpot(out, i, 50 + 16 * Math.cos(ang), 50 + 13 * Math.sin(ang));
      }
      for (let i = 0; i < outerN; i++) {
        const ang = (i / Math.max(outerN, 1)) * Math.PI * 2 - Math.PI / 2;
        pushSpot(out, innerN + i, 50 + 30 * Math.cos(ang), 50 + 24 * Math.sin(ang));
      }
      break;
    }
    case "concentric": {
      /** 同心グループ（中央密集 + 外周リング） */
      const coreN = Math.max(1, Math.round(n * 0.3));
      const ringN = n - coreN;
      /** 中央は螺旋状に密集 */
      for (let i = 0; i < coreN; i++) {
        const ang = i * 2.4;
        const r = i === 0 ? 0 : 4 + i * 2.2;
        pushSpot(out, i, 50 + r * Math.cos(ang), 50 + r * Math.sin(ang) * 0.72);
      }
      /** 外周はリング */
      for (let i = 0; i < ringN; i++) {
        const ang = (i / Math.max(ringN, 1)) * Math.PI * 2 - Math.PI / 2;
        pushSpot(out, coreN + i, 50 + 30 * Math.cos(ang), 50 + 23 * Math.sin(ang));
      }
      break;
    }
    case "cross": {
      /** 十字形（横バー + 縦バー） */
      const hN = Math.ceil(n / 2);
      const vN = n - hN;
      const xs = evenSpacingPositions(hN, 50, TARGET_STEP_X, 10, 90);
      for (let i = 0; i < hN; i++) pushSpot(out, i, xs[i]!, 50);
      const ys = evenSpacingPositions(vN, 48, TARGET_STEP_Y * 0.9, 20, 76);
      for (let i = 0; i < vN; i++) pushSpot(out, hN + i, 50, ys[i]!);
      break;
    }
    case "x_shape": {
      /** X字形（右下がり対角線 + 右上がり対角線） */
      const lineA = Math.ceil(n / 2);
      const lineB = n - lineA;
      for (let i = 0; i < lineA; i++) {
        const u = lineA === 1 ? 0.5 : i / (lineA - 1);
        pushSpot(out, i, 20 + u * 60, 25 + u * 50);
      }
      for (let i = 0; i < lineB; i++) {
        const u = lineB === 1 ? 0.5 : i / (lineB - 1);
        pushSpot(out, lineA + i, 20 + u * 60, 75 - u * 50);
      }
      break;
    }
    case "hourglass": {
      /** 砂時計（前後は広く・中央は狭い）: 3行で前行多め・中央少なめ・奥行多め */
      const frontN = Math.ceil(n * 0.4);
      const midN = Math.max(1, Math.floor(n * 0.2));
      const backN = n - frontN - midN;
      const rows = [
        { cnt: frontN, y: 72 },
        { cnt: midN, y: 48 },
        { cnt: Math.max(0, backN), y: 24 },
      ];
      let idx = 0;
      for (const row of rows) {
        const xs = evenSpacingPositions(Math.max(1, row.cnt), 50, TARGET_STEP_X, 10, 90);
        for (let k = 0; k < row.cnt; k++) pushSpot(out, idx++, xs[k]!, row.y);
      }
      break;
    }
    case "bowtie": {
      /** 蝶ネクタイ（2つの三角形が中央で接触: 左三角手前 + 右三角手前） */
      const leftN = Math.ceil(n / 2);
      const rightN = n - leftN;
      for (let i = 0; i < leftN; i++) {
        const u = leftN === 1 ? 0.5 : i / (leftN - 1);
        /** 左三角: 先端が中央（50, 48）→ 左端に広がる */
        pushSpot(out, i, 50 - u * 28, 48 - u * 24 + (i % 2) * 8);
      }
      for (let i = 0; i < rightN; i++) {
        const u = rightN === 1 ? 0.5 : i / (rightN - 1);
        pushSpot(out, leftN + i, 50 + u * 28, 48 - u * 24 + (i % 2) * 8);
      }
      break;
    }
    case "arrow_back": {
      /** 矢印（奥向き）: 先端が奥・手前に広がる */
      if (n === 1) { pushSpot(out, 0, 50, 50); break; }
      pushSpot(out, 0, 50, 18);
      const rest = n - 1;
      for (let i = 0; i < rest; i++) {
        const u = rest === 1 ? 0.5 : i / (rest - 1);
        pushSpot(out, i + 1, 18 + u * 64, 38 + Math.abs(u - 0.5) * 36);
      }
      break;
    }
    case "arrow_front": {
      /** 矢印（手前向き）: 先端が手前・奥に広がる */
      if (n === 1) { pushSpot(out, 0, 50, 50); break; }
      pushSpot(out, 0, 50, 80);
      const rest = n - 1;
      for (let i = 0; i < rest; i++) {
        const u = rest === 1 ? 0.5 : i / (rest - 1);
        pushSpot(out, i + 1, 18 + u * 64, 60 - Math.abs(u - 0.5) * 36);
      }
      break;
    }
    default:
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 50 : 12 + ((76 * i) / (n - 1 || 1));
        pushSpot(out, i, x, 44);
      }
  }
  /**
   * 場ミリ規格があれば等比リスケール、その後に「客席に近い側から・中央→左→右」
   * ルールで番号を振り直す（プリセットの生成順に依存しない一貫番号）。
   */
  const refPct = lineSpacingReferencePct ?? TARGET_STEP_X;
  const scaled = rescaleSpotsForSpacing(
    out,
    opts?.dancerSpacingMm,
    opts?.stageWidthMm,
    refPct
  );
  return relabelByAudienceCenterOut(scaled);
}

/**
 * §6 袖（左右端のサイドライン）へ余り人数を縦に避ける。
 * `firstLabelNumber` は先頭の印に付ける番号（1 始まり）。
 */
export function wingSurplusSpots(extra: number, firstLabelNumber: number): DancerSpot[] {
  if (extra <= 0) return [];
  const out: DancerSpot[] = [];
  for (let j = 0; j < extra; j++) {
    const isLeft = j % 2 === 0;
    const xPct = isLeft ? 7 : 93;
    const t = extra === 1 ? 0.5 : j / (extra - 1);
    const yPct = 18 + t * 56;
    const i = firstLabelNumber - 1 + j;
    out.push({
      id: generateId(),
      label: String(firstLabelNumber + j),
      xPct: clamp(xPct, 5, 95),
      yPct: clamp(yPct, 10, 90),
      colorIndex: modDancerColorIndex(i),
    });
  }
  return out;
}

/**
 * §6 プリセットは「既存のメイン人数」分だけ幾何を敷き、増えた分は袖へ逃がす。
 * `previousBodyCount` は直前の確定人数またはステージ上の人数。
 *
 * ただし次のいずれかでは袖逃がしを行わず、`n` 人全員をプリセットで敷く：
 * - 既存メインが 2 人未満（初期テンプレや空の形にプリセットを当てたとき、ピラミッド等が
 *   「中央 1 人＋両サイド 6 人」のようになってしまうのを防ぐ）。
 * - 袖に送る余剰人数がメインより多くなる（「袖ばかりの形」になるのを防ぐ）。
 * - 袖に送る余剰人数が上限（8 人）を超える。
 */
const MIN_BODY_FOR_WING_SURPLUS = 2;
const MAX_WING_SURPLUS = 8;

export function dancersWithPresetAndWingSurplus(
  n: number,
  preset: LayoutPresetId,
  previousBodyCount: number,
  enableWingSurplus: boolean,
  opts?: LayoutPresetOptions
): DancerSpot[] {
  const nn = Math.max(0, Math.min(80, Math.floor(n) || 0));
  if (nn <= 0) return [];
  const prev = Math.max(0, Math.floor(previousBodyCount) || 0);
  if (!enableWingSurplus || nn <= prev || prev < MIN_BODY_FOR_WING_SURPLUS) {
    return dancersForLayoutPreset(nn, preset, opts);
  }
  const surplus = nn - prev;
  if (surplus > prev || surplus > MAX_WING_SURPLUS) {
    return dancersForLayoutPreset(nn, preset, opts);
  }
  const core = Math.min(nn, prev);
  const main = dancersForLayoutPreset(core, preset, opts);
  const wings = wingSurplusSpots(surplus, core + 1);
  return [...main, ...wings];
}

/**
 * プリセットで得た座標に、既存の id / 表示 / 名簿紐付けを順番で上書きする。
 * （クイックバー適用・名簿一括配置と同じ振る舞い）
 */
export function transferDancerIdentitiesByOrder(
  positioned: DancerSpot[],
  identitySource: DancerSpot[]
): DancerSpot[] {
  return positioned.map((nd, i) => {
    const od = identitySource[i];
    if (!od) return nd;
    /** 名簿紐付け時は「○の下に名前・○内は空」（StageBoard の below モード＋ markerBadge 空） */
    const markerBadge =
      od.crewMemberId
        ? ""
        : od.markerBadge !== undefined
          ? od.markerBadge
          : nd.markerBadge;
    const markerBadgeSource = od.crewMemberId
      ? undefined
      : od.markerBadgeSource;
    return {
      ...nd,
      id: od.id,
      label: od.label,
      colorIndex: od.colorIndex,
      crewMemberId: od.crewMemberId,
      markerBadge,
      markerBadgeSource,
      sizePx: od.sizePx ?? nd.sizePx,
      note: od.note ?? nd.note,
      heightCm: od.heightCm ?? nd.heightCm,
    };
  });
}

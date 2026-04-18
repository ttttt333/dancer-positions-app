import type { DancerSpot } from "../types/choreography";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function pushSpot(out: DancerSpot[], i: number, x: number, y: number) {
  out.push({
    id: crypto.randomUUID(),
    label: String(i + 1),
    xPct: clamp(x, 5, 95),
    yPct: clamp(y, 8, 92),
    colorIndex: i % 9,
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

/** ステージ横方向の目安間隔（％）。隣り合う立ち位置間の距離。 */
const TARGET_STEP_X = 8;
/** ステージ奥行きの目安間隔（％）。列間の距離。 */
const TARGET_STEP_Y = 10;

/**
 * 客席が下のとき: 行 r を奥→手前に線形配置（0 始まり）。
 *
 * 列間隔は `TARGET_STEP_Y` を目安に固定し、人数が多くて範囲を超える場合のみ、
 * `[yUp, yDn]` の範囲に収まるよう等間隔に縮める。少人数でも横一列に広がらず、
 * 中央付近に列が密集するようになる。
 */
function yPctPyramidRow(r: number, numRows: number, yUp = 20, yDn = 72): number {
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
  /** フォーメーション案で先に並べる推奨順 */
  { id: "pyramid", label: "ピラミッド（先端が奥・1番が客席側）" },
  { id: "pyramid_inverse", label: "逆ピラミッド（手前多→奥少）" },
  {
    id: "front_stair_from_2",
    label: "段の列（手前2人→奥で列ごと+1人）",
  },
  {
    id: "front_stair_from_3",
    label: "段の列（手前3人→奥で列ごと+1人）",
  },
  /** 定番の列フォーメーション（人数を n 列に均等分割） */
  { id: "rows_3", label: "3列（均等）" },
  { id: "rows_4", label: "4列（均等）" },
  { id: "rows_5", label: "5列（均等）" },
  { id: "rows_6", label: "6列（均等）" },
  /** そのほかの定番 */
  { id: "line", label: "横一列（中）" },
  { id: "line_front", label: "横一列（客席寄り・手前）" },
  { id: "line_back", label: "横一列（奥）" },
  { id: "arc", label: "円弧（客席向き）" },
  { id: "arc_tight", label: "円弧（狭い）" },
  { id: "vee", label: "V字" },
  { id: "grid", label: "グリッド" },
  { id: "diamond", label: "ひし形周り" },
  { id: "stagger", label: "千鳥（2段）" },
  { id: "two_rows", label: "前後2列" },
  { id: "circle", label: "円周均等" },
  { id: "u_shape", label: "U字（客席向き）" },
  { id: "diagonal_se", label: "斜め（↘）" },
  { id: "diagonal_ne", label: "斜め（↗）" },
  { id: "columns_4", label: "4列縦並び" },
  { id: "wedge", label: "楔（手前先端）" },
  { id: "block_lr", label: "左右ブロック" },
  { id: "two_rows_dense_back", label: "2列（前少・奥多）" },
  { id: "inverse_vee", label: "逆V字（奥に先端）" },
  { id: "offset_triple", label: "3列オフセット" },
  { id: "stairs_diag", label: "階段状" },
  /** 個性的・バリエーション */
  { id: "scatter", label: "ランダム風（固定パターン）" },
  { id: "spiral", label: "螺旋" },
  { id: "wave", label: "波型ライン" },
  { id: "cluster_tight", label: "密集（センター）" },
  { id: "spread_loose", label: "広く分散" },
  { id: "asymmetric_l", label: "アシンメ L字" },
  { id: "hollow_ring", label: "周辺リング" },
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_OPTIONS)[number]["id"];

export const LAYOUT_PRESET_LABELS = Object.fromEntries(
  LAYOUT_PRESET_OPTIONS.map((o) => [o.id, o.label])
) as Record<LayoutPresetId, string>;

export const ALL_LAYOUT_PRESET_IDS: LayoutPresetId[] = LAYOUT_PRESET_OPTIONS.map(
  (o) => o.id
);

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
      colorIndex: i % 9,
    }));
  }
  /** 行（y）のグルーピング許容値（％）。目安間隔が 10% なので半分程度 */
  const Y_EPS = 3;

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
    colorIndex: (newLabelByIdx[i]! - 1) % 9,
  }));
}

/**
 * n 人分の立ち位置（%）。
 * 画面下が観客席帯の UI に合わせ、y が大きいほど客席に近い（手前）とする。
 */
export function dancersForLayoutPreset(n: number, preset: LayoutPresetId): DancerSpot[] {
  if (n <= 0) return [];
  const out: DancerSpot[] = [];

  switch (preset) {
    case "line": {
      const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 8, 92);
      xs.forEach((x, i) => pushSpot(out, i, x, 44));
      break;
    }
    case "line_front": {
      const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 10, 90);
      xs.forEach((x, i) => pushSpot(out, i, x, 66));
      break;
    }
    case "line_back": {
      const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 12, 88);
      xs.forEach((x, i) => pushSpot(out, i, x, 24));
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
    case "front_stair_from_3": {
      const first = preset === "front_stair_from_2" ? 2 : 3;
      const rowCounts = frontAudienceGrowingRowCounts(n, first);
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
        const xs = evenSpacingPositions(cnt, 50, TARGET_STEP_X, 8, 92);
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
      for (let i = 0; i < n; i++) {
        const r = i % rows;
        const idx = Math.floor(i / rows);
        const offset = r === 1 ? TARGET_STEP_X / 2 : 0;
        pushSpot(out, i, (xs[idx] ?? 50) + offset, r === 0 ? 38 : 54);
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
        const y = isFront ? 58 : 34;
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
        const y = isFront ? 58 : 32;
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
    default:
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 50 : 12 + ((76 * i) / (n - 1 || 1));
        pushSpot(out, i, x, 44);
      }
  }
  /**
   * 最後に「客席に近い側から・中央→左→右」ルールで番号を振り直す。
   * これでプリセットの生成順に依存せず、どのフォーメーションでも一貫した番号になる。
   */
  return relabelByAudienceCenterOut(out);
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
      id: crypto.randomUUID(),
      label: String(firstLabelNumber + j),
      xPct: clamp(xPct, 5, 95),
      yPct: clamp(yPct, 10, 90),
      colorIndex: i % 9,
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
  enableWingSurplus: boolean
): DancerSpot[] {
  const nn = Math.max(0, Math.min(80, Math.floor(n) || 0));
  if (nn <= 0) return [];
  const prev = Math.max(0, Math.floor(previousBodyCount) || 0);
  if (!enableWingSurplus || nn <= prev || prev < MIN_BODY_FOR_WING_SURPLUS) {
    return dancersForLayoutPreset(nn, preset);
  }
  const surplus = nn - prev;
  if (surplus > prev || surplus > MAX_WING_SURPLUS) {
    return dancersForLayoutPreset(nn, preset);
  }
  const core = Math.min(nn, prev);
  const main = dancersForLayoutPreset(core, preset);
  const wings = wingSurplusSpots(surplus, core + 1);
  return [...main, ...wings];
}

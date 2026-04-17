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

/** 客席が下のとき: 行 r を奥→手前に yUp…yDn へ線形配置（0 始まり） */
function yPctPyramidRow(r: number, numRows: number, yUp = 20, yDn = 72): number {
  if (numRows <= 1) return (yUp + yDn) / 2;
  return yUp + (r / (numRows - 1)) * (yDn - yUp);
}

/**
 * ピラミッド等で行ごとに人数が違うとき、「どの行も隣接間隔は等しい」グリッド上に
 * 並べて x 位置を返す。最も広い行（maxCnt）がステージ幅 usableHalfWidth×2 に収まる。
 * 結果として、少人数の行ほど中心寄りに集まり、全体が本来のピラミッド形になる。
 */
function xPctInPyramidGrid(
  j: number,
  cnt: number,
  maxCnt: number,
  usableHalfWidth = 38
): number {
  if (cnt <= 1) return 50;
  if (maxCnt <= 1) return 50;
  const step = (usableHalfWidth * 2) / (maxCnt - 1);
  return 50 + (j - (cnt - 1) / 2) * step;
}

/** 単峰（手前に向かって一度広がり、狭まる）。例: 1,3,2,1 */
function isUnimodalRowCounts(rows: number[]): boolean {
  if (rows.length <= 1) return true;
  let i = 1;
  while (i < rows.length && rows[i]! >= rows[i - 1]!) i++;
  while (i < rows.length && rows[i]! <= rows[i - 1]!) i++;
  return i === rows.length;
}

/**
 * 奥（画面上端）に先端1人・客席側（y 大）の最前列も1人、のピラミッド行人数。
 * 奥→手前の行人数配列。手前列から敷くので、7 人は手前から 1・2・3・1 列＝奥から [1,3,2,1]。
 */
function pyramidApexBackRowCounts(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  /**
   * 7 人は参照形に固定（奥に7、手前に1、中列 4・5・6 と手前2列 2・3）。
   * 汎用探索だと [1,2,2,2] のように最大列2の解が先に選ばれ、形が崩れるため。
   */
  if (n === 7) return [1, 3, 2, 1];

  const candidates: number[][] = [];

  function dfs(k: number, pos: number, sum: number, path: number[]) {
    if (sum > n) return;
    if (pos === k) {
      if (
        sum === n &&
        path[0] === 1 &&
        path[k - 1] === 1 &&
        isUnimodalRowCounts(path)
      ) {
        candidates.push([...path]);
      }
      return;
    }
    if (pos === 0) {
      path.push(1);
      dfs(k, pos + 1, sum + 1, path);
      path.pop();
      return;
    }
    if (pos === k - 1) {
      path.push(1);
      dfs(k, pos + 1, sum + 1, path);
      path.pop();
      return;
    }
    for (let w = 1; w <= n - sum - 1; w++) {
      path.push(w);
      dfs(k, pos + 1, sum + w, path);
      path.pop();
    }
  }

  for (let k = 2; k <= Math.min(n, 24); k++) {
    dfs(k, 0, 0, []);
  }

  let viable =
    n < 4
      ? candidates
      : candidates.filter((p) => Math.max(...p) >= 2);

  /** 7 人以上で「最大列が 2 のまま4行以上」は帯状になりがちなので除外（7 は上で固定済み） */
  if (n >= 8) {
    const filtered = viable.filter(
      (p) => !(p.length >= 4 && Math.max(...p) <= 2)
    );
    if (filtered.length > 0) viable = filtered;
  }

  if (viable.length === 0) {
    return n >= 3 ? [1, n - 2, 1] : n === 2 ? [1, 1] : [n];
  }

  const peakIndex = (rows: number[]) => rows.indexOf(Math.max(...rows));
  /** いちばん広い列が狭い形を優先 */
  viable.sort((a, b) => {
    const ma = Math.max(...a);
    const mb = Math.max(...b);
    if (ma !== mb) return ma - mb;
    if (a.length !== b.length) return a.length - b.length;
    const pa = peakIndex(a);
    const pb = peakIndex(b);
    if (pa !== pb) return pa - pb;
    return a.join(",").localeCompare(b.join(","));
  });
  return viable[0]!;
}

/** 手前が広い逆ピラミッド: 1, 2, …, k（三角数で厳密）＋余りは最前列に */
function pyramidNarrowFirstRowCounts(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  let k = 1;
  while (((k + 1) * (k + 2)) / 2 <= n) k++;
  const tri = (k * (k + 1)) / 2;
  const rem = n - tri;
  const rows = Array.from({ length: k }, (_, i) => i + 1);
  if (rem > 0) rows[rows.length - 1]! += rem;
  return rows;
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
 * n 人分の立ち位置（%）。
 * 画面下が観客席帯の UI に合わせ、y が大きいほど客席に近い（手前）とする。
 */
export function dancersForLayoutPreset(n: number, preset: LayoutPresetId): DancerSpot[] {
  if (n <= 0) return [];
  const out: DancerSpot[] = [];

  switch (preset) {
    case "line": {
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 50 : 12 + ((76 * i) / (n - 1 || 1));
        pushSpot(out, i, x, 44);
      }
      break;
    }
    case "line_front": {
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 50 : 10 + ((80 * i) / (n - 1 || 1));
        pushSpot(out, i, x, 62 + Math.min(6, n * 0.15));
      }
      break;
    }
    case "line_back": {
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 50 : 12 + ((76 * i) / (n - 1 || 1));
        pushSpot(out, i, x, 28);
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
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = cols === 1 ? 50 : 18 + (col * (64 / (cols - 1 || 1)));
        const y = rows === 1 ? 48 : 28 + (row * (44 / (rows - 1 || 1)));
        pushSpot(out, i, x, y);
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
      const rowCounts = pyramidApexBackRowCounts(n);
      const nr = rowCounts.length;
      const maxCnt = Math.max(1, ...rowCounts);
      let idx = 0;
      /** 手前列から敷く → ラベル 1 が客席側（y 大）の先頭行になる */
      for (let r = nr - 1; r >= 0; r--) {
        const cnt = rowCounts[r]!;
        const y = yPctPyramidRow(r, nr);
        for (let j = 0; j < cnt; j++) {
          pushSpot(out, idx++, xPctInPyramidGrid(j, cnt, maxCnt), y);
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
          pushSpot(out, idx++, xPctInPyramidGrid(j, cnt, maxCnt), y);
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
          pushSpot(out, idx++, xPctInPyramidGrid(j, cnt, maxCnt), y);
        }
      }
      break;
    }
    case "stagger": {
      const rows = 2;
      const per = Math.ceil(n / rows);
      for (let i = 0; i < n; i++) {
        const r = i % rows;
        const idx = Math.floor(i / rows);
        const x = per <= 1 ? 50 : 14 + (idx * (72 / (per - 1 || 1))) + (r === 1 ? 8 : 0);
        const y = r === 0 ? 38 : 54;
        pushSpot(out, i, x, y);
      }
      break;
    }
    case "two_rows": {
      const front = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) {
        const isFront = i < front;
        const idx = isFront ? i : i - front;
        const len = isFront ? front : n - front;
        const x = len <= 1 ? 50 : 12 + (idx * (76 / (len - 1 || 1)));
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
      for (let i = 0; i < n; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = cols === 1 ? 50 : 18 + (c * (64 / (cols - 1 || 1)));
        const y = per <= 1 ? 48 : 28 + (r * (44 / (per - 1 || 1)));
        pushSpot(out, i, x, y);
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
      for (let i = 0; i < n; i++) {
        if (i < leftN) {
          const len = leftN;
          const j = i;
          const x = len <= 1 ? 32 : 18 + (j * (28 / (len - 1 || 1)));
          const y = 36 + ((i % 3) * 10);
          pushSpot(out, i, x, y);
        } else {
          const j = i - leftN;
          const len = n - leftN;
          const x = len <= 1 ? 68 : 58 + (j * (28 / (len - 1 || 1)));
          const y = 36 + ((j % 3) * 10);
          pushSpot(out, i, x, y);
        }
      }
      break;
    }
    case "two_rows_dense_back": {
      const front = Math.max(1, Math.floor(n / 2));
      const back = n - front;
      for (let i = 0; i < n; i++) {
        const isFront = i < front;
        const idx = isFront ? i : i - front;
        const len = isFront ? front : back;
        const x = len <= 1 ? 50 : 12 + (idx * (76 / (len - 1 || 1)));
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
      for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col === 0 ? 26 : col === 1 ? 50 : 74;
        const y = 34 + row * 16 + (col === 1 ? 8 : 0);
        pushSpot(out, i, x, y);
      }
      break;
    }
    default:
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 50 : 12 + ((76 * i) / (n - 1 || 1));
        pushSpot(out, i, x, 44);
      }
  }
  return out;
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

/**
 * 矩形コスト行列に対する最小費用完全マッチング（Hungarian / Kuhn–Munkres）。
 * `cost[i][j]` = 行 i を列 j に割り当てる費用。
 *
 * 行数・列数が違う場合はダミーを費用 0 で埋め、余剰側は assignment が -1。
 * 戻り値 `assignment[i]` = 選ばれた列 index（ダミー列なら -1）。
 */
export function minCostBipartiteAssignment(cost: number[][]): number[] {
  const nRows = cost.length;
  const nCols = nRows > 0 ? cost[0]!.length : 0;
  if (nRows === 0) return [];
  if (nCols === 0) return Array(nRows).fill(-1);

  const n = Math.max(nRows, nCols);
  const a: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i < nRows && j < nCols) return cost[i]![j]!;
      return 0;
    })
  );

  const u = Array(n + 1).fill(0);
  const v = Array(n + 1).fill(0);
  const p = Array(n + 1).fill(0);
  const way = Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(n + 1).fill(Infinity);
    const used = Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0] as number;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = a[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minv[j]! -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0] as number;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0);
  }

  const colOfRow = Array(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] !== 0) colOfRow[p[j]! - 1] = j - 1;
  }

  return Array.from({ length: nRows }, (_, i) => {
    const j = colOfRow[i] as number;
    if (j < 0 || j >= nCols) return -1;
    return j;
  });
}

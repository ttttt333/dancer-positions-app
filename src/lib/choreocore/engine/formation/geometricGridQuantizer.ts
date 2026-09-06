/**
 * 隊形座標を 0.9m × 1.0m ステージ格子へ量子化し、
 * 千鳥・左右対称・最小距離を機械的に保証する。
 *
 * 座標系: 原点=ステージ中央、x=右正、y=手前正（メートル）。
 */

export type Position2D = {
  x: number;
  y: number;
};

export type GeometricGridConfig = {
  /** 横方向（左右）の格子ステップ（メートル）。既定: 0.9 */
  xGridStep: number;
  /** 縦方向（前後）の格子ステップ（メートル）。既定: 1.0 */
  yGridStep: number;
  /** ダンサー間の物理的最小距離（メートル）。既定: 0.8 */
  minDancerDistance: number;
  /** センター（X=0）とみなす許容範囲（メートル）。既定: 0.3 */
  centerTolerance: number;
  /** 千鳥配置を自動適用するか。既定: true */
  enableStaggering: boolean;
};

export const DEFAULT_GEOMETRIC_GRID_CONFIG: GeometricGridConfig = {
  xGridStep: 0.9,
  yGridStep: 1.0,
  minDancerDistance: 0.8,
  centerTolerance: 0.3,
  enableStaggering: true,
};

/**
 * 連続小数座標を格子に吸着し、千鳥・左右対称・最小距離を適用する。
 */
export function quantizeFormationGeometry<T extends Position2D>(
  positions: T[],
  customConfig?: Partial<GeometricGridConfig>
): T[] {
  if (!positions.length) return [];

  const config = { ...DEFAULT_GEOMETRIC_GRID_CONFIG, ...customConfig };
  const {
    xGridStep,
    yGridStep,
    minDancerDistance,
    centerTolerance,
    enableStaggering,
  } = config;

  // 1. Y（前後・列）を格子化
  const yQuantized = positions.map((p) => {
    const snappedY = Math.round(p.y / yGridStep) * yGridStep;
    return { ...p, y: round2(snappedY) };
  });

  // 2. 列ごとに X 量子化 + 千鳥
  const rowGroups = new Map<number, T[]>();
  for (const pos of yQuantized) {
    const rowY = pos.y;
    const list = rowGroups.get(rowY);
    if (list) list.push(pos);
    else rowGroups.set(rowY, [pos]);
  }

  const sortedYKeys = [...rowGroups.keys()].sort((a, b) => a - b);
  const previousRowXSet = new Set<number>();
  const xQuantized: T[] = [];

  for (let rowIndex = 0; rowIndex < sortedYKeys.length; rowIndex += 1) {
    const yKey = sortedYKeys[rowIndex]!;
    const rowPositions = rowGroups.get(yKey)!;
    const snappedXs: number[] = [];

    for (const pos of rowPositions) {
      let snappedX = snapX(pos.x, xGridStep, centerTolerance);

      if (
        enableStaggering &&
        rowIndex > 0 &&
        snappedX !== 0 &&
        previousRowXSet.has(round2(snappedX))
      ) {
        const offset = (xGridStep / 2) * (snappedX > 0 ? 1 : -1);
        snappedX = round2(snappedX + offset);
      }

      snappedXs.push(snappedX);
      xQuantized.push({
        ...pos,
        x: snappedX,
      });
    }

    previousRowXSet.clear();
    for (const x of snappedXs) previousRowXSet.add(round2(x));
  }

  // 3. 左右完全ミラー（右をマスター）
  const mirrored = enforceRightMasterSymmetry(xQuantized, centerTolerance);

  // 4. 最小距離クランプ
  return resolveCollisions(mirrored, minDancerDistance, xGridStep);
}

function snapX(
  x: number,
  xGridStep: number,
  centerTolerance: number
): number {
  if (Math.abs(x) <= centerTolerance) return 0;
  const steps = Math.max(1, Math.round(Math.abs(x) / xGridStep));
  return round2(steps * xGridStep * Math.sign(x));
}

/**
 * 右側をマスターとして、同じ列の左側を鏡面コピー。
 */
export function enforceRightMasterSymmetry<T extends Position2D>(
  positions: T[],
  centerTolerance: number
): T[] {
  const out = positions.map((p) => ({ ...p }));

  for (let i = 0; i < out.length; i += 1) {
    if (Math.abs(out[i]!.x) <= centerTolerance) {
      out[i] = { ...out[i]!, x: 0 };
    }
  }

  const byRow = new Map<number, number[]>();
  for (let i = 0; i < out.length; i += 1) {
    const y = round2(out[i]!.y);
    const list = byRow.get(y);
    if (list) list.push(i);
    else byRow.set(y, [i]);
  }

  for (const indices of byRow.values()) {
    const rights = indices
      .filter((i) => out[i]!.x > centerTolerance)
      .sort((a, b) => out[a]!.x - out[b]!.x || a - b);
    const lefts = indices
      .filter((i) => out[i]!.x < -centerTolerance)
      .sort((a, b) => out[b]!.x - out[a]!.x || a - b);

    const n = Math.min(rights.length, lefts.length);
    for (let k = 0; k < n; k += 1) {
      const ri = rights[rights.length - 1 - k]!;
      const li = lefts[k]!;
      const master = Math.abs(out[ri]!.x);
      out[ri] = { ...out[ri]!, x: round2(master) };
      out[li] = { ...out[li]!, x: round2(-master) };
    }
  }

  return out;
}

/**
 * 最小距離未満のペアを外側へ押し出す（同列は X、異列は弱い反発）。
 */
export function resolveCollisions<T extends Position2D>(
  positions: T[],
  minDistance: number,
  stepSize: number
): T[] {
  const result = positions.map((p) => ({ ...p }));
  const minD = Math.max(0.35, minDistance);

  for (let iter = 0; iter < 24; iter += 1) {
    let moved = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const p1 = result[i]!;
        const p2 = result[j]!;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= minD - 1e-6) continue;

        if (Math.abs(dy) < 0.25) {
          const push = stepSize * 0.5;
          if (p1.x >= p2.x) {
            p1.x = round2(p1.x + push);
            p2.x = round2(p2.x - push);
          } else {
            p1.x = round2(p1.x - push);
            p2.x = round2(p2.x + push);
          }
        } else {
          const need = (minD - Math.max(dist, 1e-4)) / 2;
          let ux: number;
          let uy: number;
          if (dist < 1e-4) {
            ux = 1;
            uy = 0;
          } else {
            ux = dx / dist;
            uy = dy / dist;
          }
          p1.x = round2(p1.x + ux * need);
          p1.y = round2(p1.y + uy * need);
          p2.x = round2(p2.x - ux * need);
          p2.y = round2(p2.y - uy * need);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

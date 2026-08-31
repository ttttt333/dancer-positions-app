import type { DancerSpot } from "../types/choreography";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
  dancerStepPctFromSpacingMm,
} from "./dancerSpacing";
import {
  dancersForLayoutPreset,
  type LayoutPresetId,
  type LayoutPresetOptions,
} from "./formationLayouts";
import { minCostBipartiteAssignment } from "./minCostAssignment";
import type { StagePosPct } from "./stageEffectivePosition";

/** FORMATION SHAPE。line 系は既存 formationLayouts、vee 以降は Generator 側 geometry。 */
export const STAGE_SHAPE_PRESETS = [
  { id: "line", label: "横一列" },
  { id: "line_vertical", label: "縦一列" },
  { id: "vee", label: "V字" },
  { id: "w", label: "W字" },
  { id: "circle", label: "円形" },
  { id: "triangle", label: "三角形" },
  { id: "diagonal", label: "斜め" },
] as const;

export type StageShapePresetId = (typeof STAGE_SHAPE_PRESETS)[number]["id"];

export type ShapeGeneratorInput = {
  dancers: readonly DancerSpot[];
  selectedIds: readonly string[];
  presetId: StageShapePresetId;
  layoutOpts?: LayoutPresetOptions;
};

export type ShapeGeneratorResult = {
  positions: Map<string, StagePosPct>;
  /** ステージ％での移動距離合計（評価用。UI 表示は任意） */
  movementCostPct: number;
};

/**
 * 形ごとの配置枠。y は既存ステージと同じく大きいほど客席側。
 * 将来の W / 円 / 三角も count + bbox + minSpacing から slot を出す。
 */
export type ShapeGeometry = {
  x0: number;
  x1: number;
  /** 奥（客席から遠い） */
  y0: number;
  /** 手前（客席側） */
  y1: number;
  minSpacingPct: number;
};

/** FORMATION SHAPE 用 V。既存 formationLayouts の vee とは独立。 */
export const SHAPE_VEE_BBOX = {
  x0: 20,
  x1: 80,
  y0: 30,
  y1: 68,
} as const;

export const SHAPE_W_BBOX = {
  x0: 16,
  x1: 84,
  y0: 30,
  y1: 68,
} as const;

export const SHAPE_CIRCLE_BBOX = {
  x0: 22,
  x1: 78,
  y0: 26,
  y1: 74,
} as const;

export const SHAPE_TRIANGLE_BBOX = {
  x0: 22,
  x1: 78,
  y0: 28,
  y1: 70,
} as const;

export const SHAPE_DIAGONAL_BBOX = {
  x0: 22,
  x1: 78,
  y0: 28,
  y1: 72,
} as const;

const DEFAULT_MIN_SPACING_PCT = 8;
/** 同一座標とみなす距離（％）。slot validation 用 */
const SLOT_DUP_EPS_PCT = 0.35;

function clampStagePct(v: number): number {
  return Math.max(
    DANCER_STAGE_POSITION_PCT_LO,
    Math.min(DANCER_STAGE_POSITION_PCT_HI, v)
  );
}

function resolveMinSpacingPct(layoutOpts?: LayoutPresetOptions): number {
  const fromMm = dancerStepPctFromSpacingMm(
    layoutOpts?.dancerSpacingMm,
    layoutOpts?.stageWidthMm
  );
  if (fromMm != null && fromMm > 0) return fromMm;
  return DEFAULT_MIN_SPACING_PCT;
}

export function movementCostPct(from: StagePosPct, to: StagePosPct): number {
  const dx = from.xPct - to.xPct;
  const dy = from.yPct - to.yPct;
  return Math.hypot(dx, dy);
}

export function shapeSlotsOverlap(
  slots: readonly StagePosPct[],
  minDistPct = SLOT_DUP_EPS_PCT
): boolean {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (movementCostPct(slots[i]!, slots[j]!) < minDistPct) return true;
    }
  }
  return false;
}

/**
 * slot 数・範囲・重複を検証する。壊れていれば例外（UI より先にテストで落とす）。
 */
export function validateShapeSlots(
  slots: readonly StagePosPct[],
  expectedCount: number
): StagePosPct[] {
  if (slots.length !== expectedCount) {
    throw new Error(
      `shape slot count ${slots.length} !== expected ${expectedCount}`
    );
  }
  const next = slots.map((s) => ({
    xPct: clampStagePct(s.xPct),
    yPct: clampStagePct(s.yPct),
  }));
  for (const s of next) {
    if (!Number.isFinite(s.xPct) || !Number.isFinite(s.yPct)) {
      throw new Error("shape slot is not finite");
    }
  }
  if (shapeSlotsOverlap(next)) {
    throw new Error("shape slots overlap");
  }
  return next;
}

/**
 * 奇数: 客席側に独立した中央 1 slot。そこから奥へ左右対称に開く。
 * 偶数: 先端は中央 1 人ではなく、客席側の 2 人が独立 slot。
 */
export function generateVeeSlots(
  count: number,
  geometry: ShapeGeometry
): StagePosPct[] {
  if (count <= 0) return [];
  const cx = (geometry.x0 + geometry.x1) / 2;
  const frontY = geometry.y1;
  const maxHalfW = (geometry.x1 - geometry.x0) / 2;
  const minSp = Math.max(3, geometry.minSpacingPct);
  const maxDepth = Math.max(8, frontY - geometry.y0);

  if (count === 1) {
    return [{ xPct: clampStagePct(cx), yPct: clampStagePct((geometry.y0 + frontY) / 2) }];
  }

  const odd = count % 2 === 1;
  const rows = odd ? (count + 1) / 2 : count / 2;
  const gaps = Math.max(1, rows - 1);
  const frontHalf = odd ? 0 : Math.max(minSp / 2, 4);
  const openPerRow = Math.max(minSp * 0.9, 7);
  const rowStep = Math.max(minSp * 0.85, 7);
  const minBackHalf = odd ? 14 : Math.max(14, frontHalf + 8);
  const minDepth = 16;

  let backHalf = Math.min(
    maxHalfW,
    Math.max(minBackHalf, frontHalf + openPerRow * gaps)
  );
  if (backHalf < frontHalf + 0.8) {
    backHalf = Math.min(maxHalfW, frontHalf + 0.8);
  }
  let depth = Math.min(maxDepth, Math.max(minDepth, rowStep * gaps));

  const slots: StagePosPct[] = [];
  for (let r = 0; r < rows; r++) {
    const t = rows === 1 ? 0 : r / gaps;
    const y = frontY - t * depth;
    const half = frontHalf + t * (backHalf - frontHalf);
    if (odd && r === 0) {
      slots.push({ xPct: clampStagePct(cx), yPct: clampStagePct(y) });
    } else {
      slots.push({
        xPct: clampStagePct(cx - half),
        yPct: clampStagePct(y),
      });
      slots.push({
        xPct: clampStagePct(cx + half),
        yPct: clampStagePct(y),
      });
    }
  }
  return slots;
}

function clampPos(s: StagePosPct): StagePosPct {
  return { xPct: clampStagePct(s.xPct), yPct: clampStagePct(s.yPct) };
}

function pointAlongOpen(
  vertices: readonly StagePosPct[],
  t01: number
): StagePosPct {
  if (vertices.length === 0) return { xPct: 50, yPct: 50 };
  if (vertices.length === 1) return { ...vertices[0]! };
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < vertices.length; i++) {
    const d = movementCostPct(vertices[i - 1]!, vertices[i]!);
    lengths.push(d);
    total += d;
  }
  if (total < 1e-9) return { ...vertices[0]! };
  const target = Math.max(0, Math.min(1, t01)) * total;
  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    const a = vertices[i]!;
    const b = vertices[i + 1]!;
    if (acc + len >= target - 1e-12 || i === lengths.length - 1) {
      const u = len < 1e-12 ? 0 : Math.max(0, Math.min(1, (target - acc) / len));
      return {
        xPct: a.xPct + (b.xPct - a.xPct) * u,
        yPct: a.yPct + (b.yPct - a.yPct) * u,
      };
    }
    acc += len;
  }
  return { ...vertices[vertices.length - 1]! };
}

function sampleOpenPath(
  vertices: readonly StagePosPct[],
  count: number
): StagePosPct[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) =>
    pointAlongOpen(vertices, count === 1 ? 0.5 : i / (count - 1))
  );
}

function sampleClosedPath(
  vertices: readonly StagePosPct[],
  count: number
): StagePosPct[] {
  if (count <= 0 || vertices.length === 0) return [];
  const loop = [...vertices, vertices[0]!];
  return Array.from({ length: count }, (_, i) =>
    pointAlongOpen(loop, i / count)
  );
}

/**
 * 客席側に谷が2つ、奥に峰が3つ。2人は谷だけ、3人は谷+中央峰。
 * 既存 formationLayouts の w_shape は使わない。
 */
export function generateWSlots(
  count: number,
  geometry: ShapeGeometry
): StagePosPct[] {
  if (count <= 0) return [];
  const cx = (geometry.x0 + geometry.x1) / 2;
  const yBack = geometry.y0;
  const yFront = geometry.y1;
  const w = geometry.x1 - geometry.x0;
  const leftBack = { xPct: geometry.x0, yPct: yBack };
  const leftFront = { xPct: geometry.x0 + w * 0.25, yPct: yFront };
  const midBack = { xPct: cx, yPct: yBack };
  const rightFront = { xPct: geometry.x0 + w * 0.75, yPct: yFront };
  const rightBack = { xPct: geometry.x1, yPct: yBack };

  if (count === 1) {
    return [clampPos({ xPct: cx, yPct: (yBack + yFront) / 2 })];
  }
  if (count === 2) return [leftFront, rightFront].map(clampPos);
  if (count === 3) return [leftFront, midBack, rightFront].map(clampPos);
  if (count === 4) {
    return [leftBack, leftFront, rightFront, rightBack].map(clampPos);
  }
  return sampleOpenPath(
    [leftBack, leftFront, midBack, rightFront, rightBack],
    count
  ).map(clampPos);
}

/**
 * 客席側（y 大）から等角度。1人は中心。
 */
export function generateCircleSlots(
  count: number,
  geometry: ShapeGeometry
): StagePosPct[] {
  if (count <= 0) return [];
  const cx = (geometry.x0 + geometry.x1) / 2;
  const cy = (geometry.y0 + geometry.y1) / 2;
  if (count === 1) return [clampPos({ xPct: cx, yPct: cy })];

  const rx = (geometry.x1 - geometry.x0) / 2;
  const ry = (geometry.y1 - geometry.y0) / 2;
  void geometry.minSpacingPct;

  return Array.from({ length: count }, (_, i) => {
    const ang = Math.PI / 2 + (2 * Math.PI * i) / count;
    return clampPos({
      xPct: cx + rx * Math.cos(ang),
      yPct: cy + ry * Math.sin(ang),
    });
  });
}

/**
 * 先端は客席側中央。辺上に等間隔（閉じる頂点は重ねない）。
 */
export function generateTriangleSlots(
  count: number,
  geometry: ShapeGeometry
): StagePosPct[] {
  if (count <= 0) return [];
  const cx = (geometry.x0 + geometry.x1) / 2;
  const tip = { xPct: cx, yPct: geometry.y1 };
  const leftBack = { xPct: geometry.x0, yPct: geometry.y0 };
  const rightBack = { xPct: geometry.x1, yPct: geometry.y0 };
  if (count === 1) {
    return [
      clampPos({
        xPct: cx,
        yPct: (geometry.y0 + geometry.y1) / 2,
      }),
    ];
  }
  if (count === 2) return [leftBack, rightBack].map(clampPos);
  if (count === 3) return [tip, leftBack, rightBack].map(clampPos);
  return sampleClosedPath([tip, leftBack, rightBack], count).map(clampPos);
}

/**
 * 左奥 → 右手前。1人は中点。
 */
export function generateDiagonalSlots(
  count: number,
  geometry: ShapeGeometry
): StagePosPct[] {
  if (count <= 0) return [];
  const a = { xPct: geometry.x0, yPct: geometry.y0 };
  const b = { xPct: geometry.x1, yPct: geometry.y1 };
  return sampleOpenPath([a, b], count).map(clampPos);
}

function generateLineSlotsFromPreset(
  count: number,
  presetId: "line" | "line_vertical",
  layoutOpts?: LayoutPresetOptions
): StagePosPct[] {
  return dancersForLayoutPreset(count, presetId as LayoutPresetId, layoutOpts).map(
    (d) => ({
      xPct: clampStagePct(d.xPct),
      yPct: clampStagePct(d.yPct),
    })
  );
}

/** 座標スロットだけ。identity は持たない。vee は既存プリセットを使わない。 */
export function generateShapeSlots(
  count: number,
  presetId: StageShapePresetId,
  layoutOpts?: LayoutPresetOptions
): StagePosPct[] {
  if (count <= 0) return [];
  const minSpacingPct = resolveMinSpacingPct(layoutOpts);
  let raw: StagePosPct[];
  switch (presetId) {
    case "line":
    case "line_vertical":
      raw = generateLineSlotsFromPreset(count, presetId, layoutOpts);
      break;
    case "vee":
      raw = generateVeeSlots(count, {
        ...SHAPE_VEE_BBOX,
        minSpacingPct,
      });
      break;
    case "w":
      raw = generateWSlots(count, { ...SHAPE_W_BBOX, minSpacingPct });
      break;
    case "circle":
      raw = generateCircleSlots(count, {
        ...SHAPE_CIRCLE_BBOX,
        minSpacingPct,
      });
      break;
    case "triangle":
      raw = generateTriangleSlots(count, {
        ...SHAPE_TRIANGLE_BBOX,
        minSpacingPct,
      });
      break;
    case "diagonal":
      raw = generateDiagonalSlots(count, {
        ...SHAPE_DIAGONAL_BBOX,
        minSpacingPct,
      });
      break;
  }
  return validateShapeSlots(raw, count);
}

/**
 * 選択中の現在位置とスロットの最小費用割当。
 * 配列順は変えない。戻りは id → 新座標。
 */
export function assignSlotsByMinMovement(
  selected: readonly DancerSpot[],
  slots: readonly StagePosPct[]
): { positions: Map<string, StagePosPct>; movementCostPct: number } {
  const positions = new Map<string, StagePosPct>();
  if (selected.length === 0 || slots.length === 0) {
    return { positions, movementCostPct: 0 };
  }

  const n = Math.min(selected.length, slots.length);
  const cost: number[][] = [];
  for (let i = 0; i < n; i++) {
    const from = selected[i]!;
    const row: number[] = [];
    for (let j = 0; j < slots.length; j++) {
      row.push(movementCostPct(from, slots[j]!));
    }
    cost.push(row);
  }

  const assignment = minCostBipartiteAssignment(cost);
  let total = 0;
  for (let i = 0; i < assignment.length; i++) {
    const slotIndex = assignment[i]!;
    if (slotIndex < 0) continue;
    const slot = slots[slotIndex];
    const dancer = selected[i];
    if (!slot || !dancer) continue;
    positions.set(dancer.id, slot);
    total += cost[i]![slotIndex]!;
  }

  return { positions, movementCostPct: total };
}

/**
 * Shape Generator。UI も将来の AI もこの関数だけを呼ぶ。
 * 形状スロット → validation → 最小移動割当 → 評価（movementCostPct）。
 * 永続データは変更しない。xPct/yPct の Map だけ返す。
 */
export function generateShapePreview(
  input: ShapeGeneratorInput
): ShapeGeneratorResult {
  const idSet = new Set(input.selectedIds);
  const selected = input.dancers.filter((d) => idSet.has(d.id));
  const slots = generateShapeSlots(
    selected.length,
    input.presetId,
    input.layoutOpts
  );
  return assignSlotsByMinMovement(selected, slots);
}

export type TryShapePreviewOutcome =
  | {
      ok: true;
      result: ShapeGeneratorResult;
      /** 場ミリ付きが失敗し、間隔制約なしで置いた */
      ignoredSpacing: boolean;
    }
  | { ok: false };

function layoutOptsHaveSpacing(opts?: LayoutPresetOptions): boolean {
  return (
    typeof opts?.dancerSpacingMm === "number" &&
    opts.dancerSpacingMm > 0 &&
    typeof opts?.stageWidthMm === "number" &&
    opts.stageWidthMm > 0
  );
}

/**
 * 場ミリ付きで slot が作れない（幅不足の overlap など）ときは間隔なしで再試行する。
 * 呼び出し側は ignoredSpacing / ok:false を必ずユーザーへ知らせること。
 */
export function tryGenerateShapePreview(
  input: ShapeGeneratorInput
): TryShapePreviewOutcome {
  try {
    return {
      ok: true,
      result: generateShapePreview(input),
      ignoredSpacing: false,
    };
  } catch {
    if (!layoutOptsHaveSpacing(input.layoutOpts)) return { ok: false };
    try {
      return {
        ok: true,
        result: generateShapePreview({ ...input, layoutOpts: undefined }),
        ignoredSpacing: true,
      };
    } catch {
      return { ok: false };
    }
  }
}

export function applyShapePositionsToDancers(
  dancers: DancerSpot[],
  positions: ReadonlyMap<string, StagePosPct>
): DancerSpot[] {
  if (positions.size === 0) return dancers;
  return dancers.map((d) => {
    const pos = positions.get(d.id);
    if (!pos) return d;
    return { ...d, xPct: pos.xPct, yPct: pos.yPct };
  });
}

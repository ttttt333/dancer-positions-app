import type { DancerSpot } from "../types/choreography";
import type { StagePosPct } from "./stageEffectivePosition";
import {
  clusterSelectionColumns,
  formatSelectionColumnSummary,
  getSelectionSwapAxis,
  swapSelectionColumnsDepth,
  type SwapAxis,
} from "./stageColumnSwap";
import { movementCostPct } from "./stageShapeGenerator";

export type DepthSwapPair = { colA: number; colB: number };

export type DepthMovementLabel = "なし" | "小" | "中" | "大";

export type DepthSwapPairInfo = DepthSwapPair & {
  markA: string;
  markB: string;
  countA: number;
  countB: number;
  noChange: boolean;
  movementCostPct: number;
  movementLabel: DepthMovementLabel;
};

export type DepthSwapInspect = {
  axis: SwapAxis;
  unit: "列" | "段";
  /** 補助。主役は「Nグループ」 */
  axisHint: string;
  groupCount: number;
  groupSizes: number[];
  groupLines: string[];
  /** ① 1人　② 3人　③ 5人　④ 2人 */
  groupSummaryLine: string;
  summary: string;
  lines: string[];
  pairs: DepthSwapPairInfo[];
};

export type DepthGroupMark = {
  dancerId: string;
  groupIndex: number;
  mark: string;
};

/**
 * クラスタ結果をダンサー id に固定する。Preview 中も再クラスタしないこと。
 * 番号は人の ID ではなく、判定時点のグループ位置（①＝先頭グループ）。
 */
export function mapDancerDepthGroupMarks(
  dancers: readonly DancerSpot[],
  selectedIds: readonly string[]
): DepthGroupMark[] {
  const columns = clusterSelectionColumns([...dancers], [...selectedIds]);
  const out: DepthGroupMark[] = [];
  columns.forEach((col, i) => {
    const mark = circleMark(i);
    for (const member of col.members) {
      out.push({ dancerId: member.id, groupIndex: i, mark });
    }
  });
  return out;
}

export type DepthGroupMarkOnStage = {
  dancerId: string;
  mark: string;
  xPct: number;
  yPct: number;
};

const LEFT_MARK_OFFSET_PCT = 5.5;

function isLeftOf(
  a: StagePosPct,
  b: StagePosPct
): boolean {
  if (a.xPct < b.xPct - 0.05) return true;
  if (a.xPct > b.xPct + 0.05) return false;
  return a.yPct < b.yPct;
}

/** ステージ表示用。各グループは列の左端に番号を1つだけ置く。 */
export function layoutDepthGroupMarksOnStage(
  marks: readonly DepthGroupMark[],
  positionById: ReadonlyMap<string, StagePosPct>
): DepthGroupMarkOnStage[] {
  const byGroup = new Map<number, DepthGroupMark[]>();
  for (const m of marks) {
    const arr = byGroup.get(m.groupIndex) ?? [];
    arr.push(m);
    byGroup.set(m.groupIndex, arr);
  }
  const out: DepthGroupMarkOnStage[] = [];
  for (const group of byGroup.values()) {
    let leftmost: { mark: DepthGroupMark; pos: StagePosPct } | null = null;
    for (const g of group) {
      const pos = positionById.get(g.dancerId);
      if (!pos) continue;
      if (!leftmost || isLeftOf(pos, leftmost.pos)) {
        leftmost = { mark: g, pos };
      }
    }
    if (!leftmost) continue;
    out.push({
      dancerId: leftmost.mark.dancerId,
      mark: leftmost.mark.mark,
      xPct: Math.max(2, Math.min(98, leftmost.pos.xPct - LEFT_MARK_OFFSET_PCT)),
      yPct: Math.max(2, Math.min(98, leftmost.pos.yPct)),
    });
  }
  return out;
}

const CIRCLE_MARKS = [
  "①",
  "②",
  "③",
  "④",
  "⑤",
  "⑥",
  "⑦",
  "⑧",
  "⑨",
  "⑩",
  "⑪",
  "⑫",
  "⑬",
  "⑭",
  "⑮",
  "⑯",
  "⑰",
  "⑱",
  "⑲",
  "⑳",
] as const;

export function circleMark(index: number): string {
  return CIRCLE_MARKS[index] ?? String(index + 1);
}

export function labelDepthMovement(costPct: number): DepthMovementLabel {
  if (costPct < 0.05) return "なし";
  if (costPct < 20) return "小";
  if (costPct < 50) return "中";
  return "大";
}

/**
 * 隣接グループだけ。①⇄②, ②⇄③, ③⇄④ …（飛び越し ①⇄③ などは今回出さない）
 */
export function adjacentDepthSwapPairs(groupCount: number): DepthSwapPair[] {
  if (groupCount < 2) return [];
  const pairs: DepthSwapPair[] = [];
  for (let i = 0; i < groupCount - 1; i++) {
    pairs.push({ colA: i, colB: i + 1 });
  }
  return pairs;
}

export function inspectFormationDepthSwap(
  dancers: readonly DancerSpot[],
  selectedIds: readonly string[]
): DepthSwapInspect {
  const ids = [...selectedIds];
  const list = [...dancers];
  const axis = getSelectionSwapAxis(list, ids);
  const columns = clusterSelectionColumns(list, ids);
  const unit = axis === "depth-rows" ? "段" : "列";
  const groupSizes = columns.map((col) => col.members.length);
  const groupLines = columns.map(
    (col, i) => `${circleMark(i)} ${col.members.length}人`
  );
  const pairs = adjacentDepthSwapPairs(columns.length).map((pair) => {
    const ev = evaluateDepthSwapPair(list, ids, pair.colA, pair.colB);
    return {
      ...pair,
      markA: circleMark(pair.colA),
      markB: circleMark(pair.colB),
      countA: groupSizes[pair.colA] ?? 0,
      countB: groupSizes[pair.colB] ?? 0,
      noChange: ev.noChange,
      movementCostPct: ev.movementCostPct,
      movementLabel: ev.movementLabel,
    };
  });
  const lines = columns.map(
    (col, i) => `${i + 1}${unit}目 ${col.members.length}人`
  );
  return {
    axis,
    unit,
    axisHint: `${columns.length}${unit}として判定`,
    groupCount: columns.length,
    groupSizes,
    groupLines,
    groupSummaryLine: groupLines.join("　"),
    summary: formatSelectionColumnSummary(list, ids, axis),
    lines,
    pairs,
  };
}

/**
 * 永続配列は変えない。swap 後に座標が変わった id だけの Map。
 * xPct は既存ロジックどおり変わらない想定。
 */
export function generateDepthSwapPreview(
  dancers: readonly DancerSpot[],
  selectedIds: readonly string[],
  colA: number,
  colB: number
): Map<string, StagePosPct> {
  const list = [...dancers];
  const ids = [...selectedIds];
  const next = swapSelectionColumnsDepth(list, ids, colA, colB);
  const prevById = new Map(list.map((d) => [d.id, d] as const));
  const byId = new Map<string, StagePosPct>();
  const idSet = new Set(ids);
  for (const d of next) {
    if (!idSet.has(d.id)) continue;
    const prev = prevById.get(d.id);
    if (!prev) continue;
    if (prev.xPct === d.xPct && prev.yPct === d.yPct) continue;
    byId.set(d.id, { xPct: d.xPct, yPct: d.yPct });
  }
  return byId;
}

export function evaluateDepthSwapPair(
  dancers: readonly DancerSpot[],
  selectedIds: readonly string[],
  colA: number,
  colB: number
): {
  byId: Map<string, StagePosPct>;
  movementCostPct: number;
  noChange: boolean;
  movementLabel: DepthMovementLabel;
} {
  const byId = generateDepthSwapPreview(dancers, selectedIds, colA, colB);
  const prevById = new Map(dancers.map((d) => [d.id, d] as const));
  let cost = 0;
  for (const [id, pos] of byId) {
    const prev = prevById.get(id);
    if (!prev) continue;
    cost += movementCostPct(prev, pos);
  }
  return {
    byId,
    movementCostPct: cost,
    noChange: byId.size === 0,
    movementLabel: labelDepthMovement(cost),
  };
}

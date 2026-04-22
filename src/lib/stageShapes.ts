import type { StageShape, StageShapePresetId } from "../types/choreography";

/**
 * 変形舞台プリセットの定義。
 *
 * 多角形はすべて「上が奥・下が客席」の % 座標 (0〜100) で生成する。
 * ステージ上では親コンテナ側で客席方向 (audienceEdge) に応じて回転されるため、
 * 本モジュールではそれを気にする必要はない。
 *
 * params はユーザが後から寸法を微調整できる値（奥行・幅など）。
 * params を変更した際は `buildStageShape(presetId, params)` を呼び直して
 * polygonPct を再計算する。
 */

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export type StageShapePresetOption = {
  id: StageShapePresetId;
  label: string;
  /** UI ツールチップ / 説明文 */
  description: string;
  /** 調整可能なパラメータ定義。UI はこれを見てスライダーを出す */
  paramDefs?: StageShapeParamDef[];
};

export type StageShapeParamDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** 未指定時の初期値 */
  default: number;
  /** 値の末尾に付ける単位（% など） */
  unit?: string;
};

export const STAGE_SHAPE_PRESETS: readonly StageShapePresetOption[] = [
  {
    id: "rectangle",
    label: "長方形（標準）",
    description: "舞台全面を使う既定の形。",
  },
  {
    id: "hanamichi_front",
    label: "花道つき（中央前方へ）",
    description:
      "長方形の手前中央から客席に向かって細い花道が伸びる、歌舞伎型の舞台。",
    paramDefs: [
      { key: "depthPct", label: "花道の奥行", min: 8, max: 36, step: 1, default: 16, unit: "%" },
      { key: "widthPct", label: "花道の幅", min: 12, max: 70, step: 1, default: 28, unit: "%" },
    ],
  },
  {
    id: "thrust",
    label: "スラスト（手前に大きく張出し）",
    description: "客席側中央に、花道よりも幅広の大きな張出しがある舞台。",
    paramDefs: [
      { key: "depthPct", label: "張出しの奥行", min: 10, max: 40, step: 1, default: 22, unit: "%" },
      { key: "widthPct", label: "張出しの幅", min: 30, max: 80, step: 1, default: 56, unit: "%" },
    ],
  },
  {
    id: "t_stage",
    label: "T字（奥方向に突出）",
    description:
      "メインステージの奥・中央から、さらに奥へ細い舞台が伸びる T 字型。",
    paramDefs: [
      { key: "stemDepthPct", label: "突き出しの奥行", min: 8, max: 36, step: 1, default: 18, unit: "%" },
      { key: "stemWidthPct", label: "突き出しの幅", min: 12, max: 60, step: 1, default: 30, unit: "%" },
    ],
  },
  {
    id: "trapezoid_narrow_back",
    label: "台形（奥が狭い）",
    description: "奥に行くほど細くなる台形。遠近感を強調できる。",
    paramDefs: [
      { key: "narrowPct", label: "奥の幅", min: 30, max: 95, step: 1, default: 70, unit: "%" },
    ],
  },
  {
    id: "trapezoid_narrow_front",
    label: "台形（手前が狭い）",
    description: "手前（客席側）が狭く、奥が広い逆台形。",
    paramDefs: [
      { key: "narrowPct", label: "手前の幅", min: 30, max: 95, step: 1, default: 70, unit: "%" },
    ],
  },
  {
    id: "hexagon",
    label: "六角形（四隅を切り落とし）",
    description: "長方形の四隅を斜めに切った六角形。",
    paramDefs: [
      { key: "cornerPct", label: "角落としの幅", min: 6, max: 30, step: 1, default: 14, unit: "%" },
    ],
  },
  {
    id: "diamond",
    label: "ダイヤ（菱形）",
    description:
      "四方向に頂点を持つ菱形の舞台。手前・奥方向の幅（客席側の広がり）を変えられます。",
    paramDefs: [
      {
        key: "breadthPct",
        label: "左右の広がり",
        min: 40,
        max: 100,
        step: 1,
        default: 100,
        unit: "%",
      },
    ],
  },
  {
    id: "rounded",
    label: "角丸",
    description: "四隅を丸めた舞台。",
    paramDefs: [
      { key: "radiusPct", label: "角の丸み", min: 4, max: 30, step: 1, default: 12, unit: "%" },
    ],
  },
  {
    id: "oval",
    label: "楕円（円形舞台）",
    description:
      "楕円形のアリーナ／円形劇場向け舞台。横・縦の半径をそれぞれ変えて扁平楕円にもできます。",
    paramDefs: [
      {
        key: "radiusXPct",
        label: "左右の半径",
        min: 15,
        max: 50,
        step: 1,
        default: 50,
        unit: "%",
      },
      {
        key: "radiusYPct",
        label: "前後の半径",
        min: 15,
        max: 50,
        step: 1,
        default: 50,
        unit: "%",
      },
    ],
  },
  {
    id: "corner_cut_fl",
    label: "手前左の角を落とす",
    description: "客席左手の角を斜めに切り落とした変形舞台。",
    paramDefs: [
      { key: "cornerPct", label: "角落としの幅", min: 10, max: 50, step: 1, default: 26, unit: "%" },
    ],
  },
  {
    id: "corner_cut_fr",
    label: "手前右の角を落とす",
    description: "客席右手の角を斜めに切り落とした変形舞台。",
    paramDefs: [
      { key: "cornerPct", label: "角落としの幅", min: 10, max: 50, step: 1, default: 26, unit: "%" },
    ],
  },
  {
    id: "custom",
    label: "カスタム（頂点で形を作る）",
    description:
      "長方形の四隅を基準に、頂点の座標（%）を編集して任意の凸形に近い形を作れます。3 点以上が必要です。",
  },
];

export const STAGE_SHAPE_PRESET_MAP: Record<
  StageShapePresetId,
  StageShapePresetOption
> = Object.fromEntries(
  STAGE_SHAPE_PRESETS.map((p) => [p.id, p])
) as Record<StageShapePresetId, StageShapePresetOption>;

/**
 * プリセット params の初期値（定義からコピー）。
 */
export function defaultParamsFor(id: StageShapePresetId): Record<string, number> {
  const opt = STAGE_SHAPE_PRESET_MAP[id];
  const out: Record<string, number> = {};
  for (const def of opt?.paramDefs ?? []) {
    out[def.key] = def.default;
  }
  return out;
}

/** 引数の params から値を取り出し、欠けていればデフォルトで補う。 */
function pickParam(
  params: Record<string, number> | undefined,
  defs: StageShapeParamDef[] | undefined,
  key: string
): number {
  const d = defs?.find((x) => x.key === key);
  const fallback = d?.default ?? 0;
  const v = params?.[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (d) return clamp(v, d.min, d.max);
  return v;
}

/**
 * プリセット id と params から多角形（% 座標）を生成する。
 */
export function buildStageShapePolygon(
  presetId: StageShapePresetId,
  params?: Record<string, number>
): [number, number][] {
  const defs = STAGE_SHAPE_PRESET_MAP[presetId]?.paramDefs;
  const p = (k: string) => pickParam(params, defs, k);

  switch (presetId) {
    case "rectangle":
      return [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ];
    case "hanamichi_front": {
      /** 花道：中央前方へ延びる帯。メインは残し、前方コーナーだけ削る。 */
      const depth = p("depthPct");
      const width = p("widthPct");
      /** 花道の左右端 x 座標（中央基準） */
      const hxL = 50 - width / 2;
      const hxR = 50 + width / 2;
      /** 花道が始まる y（メインの下端） */
      const mainBottom = 100 - depth;
      return [
        [0, 0],
        [100, 0],
        [100, mainBottom],
        [hxR, mainBottom],
        [hxR, 100],
        [hxL, 100],
        [hxL, mainBottom],
        [0, mainBottom],
      ];
    }
    case "apron_front":
      /** 旧 id 互換（UI からは非表示）。長方形扱い。 */
      return [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ];
    case "thrust": {
      const depth = p("depthPct");
      const width = p("widthPct");
      const hxL = 50 - width / 2;
      const hxR = 50 + width / 2;
      const mainBottom = 100 - depth;
      return [
        [0, 0],
        [100, 0],
        [100, mainBottom],
        [hxR, mainBottom],
        [hxR, 100],
        [hxL, 100],
        [hxL, mainBottom],
        [0, mainBottom],
      ];
    }
    case "t_stage": {
      /** T字：奥中央から、さらに奥方向（y 小）へ突き出す形。
       *  polygon は 0〜100 の範囲に収めるため、メイン本体を下側に寄せる。 */
      const stemDepth = p("stemDepthPct");
      const stemWidth = p("stemWidthPct");
      const sxL = 50 - stemWidth / 2;
      const sxR = 50 + stemWidth / 2;
      /** メイン本体の上端（奥側の境界） */
      const mainTop = stemDepth;
      return [
        [sxL, 0],
        [sxR, 0],
        [sxR, mainTop],
        [100, mainTop],
        [100, 100],
        [0, 100],
        [0, mainTop],
        [sxL, mainTop],
      ];
    }
    case "trapezoid_narrow_back": {
      const narrow = p("narrowPct");
      const insetEach = (100 - narrow) / 2;
      return [
        [insetEach, 0],
        [100 - insetEach, 0],
        [100, 100],
        [0, 100],
      ];
    }
    case "trapezoid_narrow_front": {
      const narrow = p("narrowPct");
      const insetEach = (100 - narrow) / 2;
      return [
        [0, 0],
        [100, 0],
        [100 - insetEach, 100],
        [insetEach, 100],
      ];
    }
    case "hexagon": {
      const c = p("cornerPct");
      return [
        [c, 0],
        [100 - c, 0],
        [100, c],
        [100, 100 - c],
        [100 - c, 100],
        [c, 100],
        [0, 100 - c],
        [0, c],
      ];
    }
    case "diamond": {
      /** 客席側（y=100）付近の横幅。100＝頂点が左右端、小さいほど細い菱形。 */
      const breadth = p("breadthPct");
      const half = breadth / 2;
      return [
        [50, 0],
        [50 + half, 50],
        [50, 100],
        [50 - half, 50],
      ];
    }
    case "rounded": {
      /** 角丸：四隅をそれぞれ 6 分割の近似円弧でつなぐ多角形。 */
      const r = p("radiusPct");
      const STEPS = 6;
      const pts: [number, number][] = [];
      const addArc = (
        cx: number,
        cy: number,
        startDeg: number,
        endDeg: number
      ) => {
        for (let i = 0; i <= STEPS; i++) {
          const t = i / STEPS;
          const a = ((startDeg + (endDeg - startDeg) * t) * Math.PI) / 180;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
      };
      addArc(100 - r, r, -90, 0);
      addArc(100 - r, 100 - r, 0, 90);
      addArc(r, 100 - r, 90, 180);
      addArc(r, r, 180, 270);
      return pts;
    }
    case "oval": {
      /** 楕円（中心 50,50・半径は params で可変の 32 角近似） */
      const rx = p("radiusXPct");
      const ry = p("radiusYPct");
      const STEPS = 32;
      const pts: [number, number][] = [];
      for (let i = 0; i < STEPS; i++) {
        const a = (i / STEPS) * Math.PI * 2 - Math.PI / 2;
        pts.push([50 + Math.cos(a) * rx, 50 + Math.sin(a) * ry]);
      }
      return pts;
    }
    case "corner_cut_fl": {
      /** 手前左（客席から見て左）の角を斜めに落とす。 */
      const c = p("cornerPct");
      return [
        [0, 0],
        [100, 0],
        [100, 100],
        [c, 100],
        [0, 100 - c],
      ];
    }
    case "corner_cut_fr": {
      const c = p("cornerPct");
      return [
        [0, 0],
        [100, 0],
        [100, 100 - c],
        [100 - c, 100],
        [0, 100],
      ];
    }
    case "custom":
      /** 一覧サムネ・初期値用の長方形。実データは `StageShape.polygonPct` を直接編集する。 */
      return [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ];
  }
}

/** メイン床の既定長方形（奥左上原点・手前右下 (100,100)） */
export const DEFAULT_STAGE_RECT_POLYGON: [number, number][] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

/** 手書きを直線の折れ線にする RDP のしきい値（% 座標） */
export const STAGE_SHAPE_SKETCH_EPSILON_PCT = 3.35;
/** 既存の頂点・ストローク端に吸着する距離（%） */
export const STAGE_SHAPE_SKETCH_SNAP_PCT = 4.25;

function dedupeConsecutivePct(
  pts: readonly [number, number][],
  minDist: number
): [number, number][] {
  const out: [number, number][] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDist) {
      out.push([p[0], p[1]]);
    }
  }
  return out;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/**
 * 手書きポリラインを Douglas–Peucker で直線の折れ線に簡略化する（0〜100% 座標）。
 */
export function simplifyPolylinePct(
  pts: readonly [number, number][],
  epsilonPct: number
): [number, number][] {
  if (pts.length < 3) {
    return pts.length === 0 ? [] : clonePolygonPct(pts as [number, number][]);
  }
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const d = pointToSegmentDistance(
      p[0],
      p[1],
      first[0],
      first[1],
      last[0],
      last[1]
    );
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist < epsilonPct) {
    return [first, last];
  }
  const left = simplifyPolylinePct(pts.slice(0, maxIdx + 1), epsilonPct);
  const right = simplifyPolylinePct(pts.slice(maxIdx), epsilonPct);
  return [...left.slice(0, -1), ...right];
}

function ensureAtLeastThreeVertices(
  simplified: [number, number][],
  originalDense: readonly [number, number][]
): [number, number][] {
  if (simplified.length >= 3) return simplified;
  if (simplified.length === 2 && originalDense.length >= 3) {
    const a = simplified[0]!;
    const b = simplified[1]!;
    const midIdx = Math.floor(originalDense.length / 2);
    const m = originalDense[midIdx]!;
    return [a, [m[0], m[1]] as [number, number], b];
  }
  return simplified;
}

/**
 * 手書きストロークから舞台輪郭用の頂点列を作る。
 * 直線化（RDP）のあと、既存の多角形の頂点・ストロークの両端に近い点へ吸着する。
 */
export function polygonFromFreehandPct(
  rawSketch: readonly [number, number][],
  anchorPolygon: readonly [number, number][],
  epsilonPct: number = STAGE_SHAPE_SKETCH_EPSILON_PCT,
  snapThresholdPct: number = STAGE_SHAPE_SKETCH_SNAP_PCT
): [number, number][] | null {
  if (rawSketch.length < 2) return null;
  let pts = dedupeConsecutivePct(rawSketch, 0.38);
  if (pts.length < 2) return null;
  let simplified = simplifyPolylinePct(pts, epsilonPct);
  simplified = dedupeConsecutivePct(simplified, 0.22);
  if (simplified.length < 2) return null;
  simplified = ensureAtLeastThreeVertices(simplified, pts);
  if (simplified.length < 3) return null;

  const anchors: [number, number][] = [];
  for (const p of anchorPolygon) {
    anchors.push([clamp(p[0], 0, 100), clamp(p[1], 0, 100)]);
  }

  const th2 = snapThresholdPct * snapThresholdPct;
  const snapped = simplified.map(([x, y]) => {
    let bx = x;
    let by = y;
    let bestD2 = Infinity;
    for (const [ax, ay] of anchors) {
      const d2 = (x - ax) ** 2 + (y - ay) ** 2;
      if (d2 <= th2 && d2 < bestD2) {
        bestD2 = d2;
        bx = ax;
        by = ay;
      }
    }
    return [bx, by] as [number, number];
  });
  return sanitizePolygonPct(snapped);
}

export function clonePolygonPct(
  pts: readonly [number, number][]
): [number, number][] {
  return pts.map(([x, y]) => [x, y] as [number, number]);
}

/** 各座標を 0〜100 に収め、3 未満なら長方形にフォールバック。 */
export function sanitizePolygonPct(
  pts: readonly [number, number][]
): [number, number][] {
  const out: [number, number][] = [];
  for (const pair of pts) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const x = clamp(Number(pair[0]), 0, 100);
    const y = clamp(Number(pair[1]), 0, 100);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push([x, y]);
  }
  return out.length >= 3 ? out : clonePolygonPct(DEFAULT_STAGE_RECT_POLYGON);
}

/**
 * プリセット id と任意の params から StageShape を組み立てる。
 */
export function buildStageShape(
  presetId: StageShapePresetId,
  params?: Record<string, number>
): StageShape {
  const merged = { ...defaultParamsFor(presetId), ...(params ?? {}) };
  return {
    presetId,
    polygonPct: buildStageShapePolygon(presetId, merged),
    params: Object.keys(merged).length > 0 ? merged : undefined,
  };
}

/**
 * StageShape を SVG の `points` 属性文字列に変換する（"x,y x,y …"）。
 */
export function polygonToSvgPoints(polygon: [number, number][]): string {
  return polygon.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ");
}

/**
 * 旧仕様（hanamichiEnabled / hanamichiDepthPct）から StageShape を組み立てる後方互換ヘルパ。
 */
export function stageShapeFromLegacyHanamichi(
  depthPct: number
): StageShape {
  return buildStageShape("hanamichi_front", {
    depthPct: clamp(depthPct, 8, 36),
    /** 旧仕様は全幅の帯だったので、花道幅は広めで近い見た目に。 */
    widthPct: 100,
  });
}

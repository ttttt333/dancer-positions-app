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
    description: "四方向に頂点を持つ菱形の舞台。",
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
    description: "楕円形のアリーナ／円形劇場向け舞台。",
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
    case "diamond":
      return [
        [50, 0],
        [100, 50],
        [50, 100],
        [0, 50],
      ];
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
      /** 楕円（x 半径 50, y 半径 50 の 32-gon 近似） */
      const STEPS = 32;
      const pts: [number, number][] = [];
      for (let i = 0; i < STEPS; i++) {
        const a = (i / STEPS) * Math.PI * 2 - Math.PI / 2;
        pts.push([50 + Math.cos(a) * 50, 50 + Math.sin(a) * 50]);
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
      return [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ];
  }
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

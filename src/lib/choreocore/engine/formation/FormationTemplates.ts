import type { FormationCueAction } from "../types/CueTypes";
import type {
  FormationGenerateOptions,
  FormationTemplate,
  FormationType,
} from "../types/FormationTypes";
import {
  applySpread,
  layoutArc,
  layoutArrow,
  layoutCenter,
  layoutCenterWings,
  layoutCluster,
  layoutDiamond,
  layoutDoubleDiagonal,
  layoutDoubleLine,
  layoutGrid,
  layoutLine,
  layoutPair,
  layoutPyramid,
  layoutSolo,
  layoutSplit,
  layoutSquare,
  layoutTriangle,
  layoutV,
  layoutDiagonal,
  separateSlots,
} from "./geometry";

function tmpl(
  id: string,
  type: FormationType,
  minCount: number,
  maxCount: number,
  preferredIntents: FormationCueAction[],
  tags: string[],
  complexity: number,
  generate: (count: number, options: FormationGenerateOptions) => ReturnType<typeof layoutLine>
): FormationTemplate {
  return {
    id,
    type,
    minCount,
    maxCount,
    preferredIntents,
    tags,
    complexity,
    generator: (count, options) => {
        const raw = generate(count, options);
        return separateSlots(applySpread(raw, options.spread), 0.11);
    },
  };
}

export function createDefaultFormationTemplates(): FormationTemplate[] {
  return [
    tmpl("solo-center", "CENTER", 1, 1, ["CENTER", "HOLD", "CONTRACT"], ["solo", "center"], 10, () =>
      layoutSolo("center")
    ),
    tmpl("solo-left", "CUSTOM", 1, 1, ["MICRO_SHIFT", "LINE"], ["solo", "left"], 12, () =>
      layoutSolo("left")
    ),
    tmpl("solo-right", "CUSTOM", 1, 1, ["MICRO_SHIFT", "LINE"], ["solo", "right"], 12, () =>
      layoutSolo("right")
    ),
    tmpl("solo-front", "CUSTOM", 1, 1, ["CENTER", "MICRO_SHIFT"], ["solo", "front"], 12, () =>
      layoutSolo("front")
    ),
    tmpl("solo-back", "CUSTOM", 1, 1, ["CENTER", "MICRO_SHIFT"], ["solo", "back"], 12, () =>
      layoutSolo("back")
    ),
    tmpl("solo-diagonal", "DIAGONAL", 1, 1, ["DIAGONAL"], ["solo", "diagonal"], 15, () =>
      layoutSolo("diagonal")
    ),

    tmpl(
      "pair-side-by-side",
      "LINE",
      2,
      2,
      ["LINE", "HOLD"],
      ["pair", "side-by-side"],
      18,
      () => layoutPair("side")
    ),
    tmpl(
      "pair-front-back",
      "CUSTOM",
      2,
      2,
      ["CENTER", "MICRO_SHIFT"],
      ["pair", "front-back"],
      18,
      () => layoutPair("front-back")
    ),
    tmpl("pair-diagonal", "DIAGONAL", 2, 2, ["DIAGONAL"], ["pair", "diagonal"], 20, () =>
      layoutPair("diagonal")
    ),
    tmpl("pair-mirror", "CUSTOM", 2, 2, ["V", "CENTER"], ["pair", "mirror"], 20, () =>
      layoutPair("mirror")
    ),
    tmpl("pair-center", "CENTER", 2, 2, ["CENTER", "MERGE", "CONTRACT"], ["pair", "center-pair"], 16, () =>
      layoutPair("center-pair")
    ),

    tmpl("center", "CENTER", 3, 30, ["CENTER", "MERGE", "CONTRACT"], ["center", "symmetric"], 10, (n) =>
      layoutCenter(n)
    ),
    tmpl("line", "LINE", 3, 30, ["LINE"], ["line"], 20, (n) => layoutLine(n)),
    tmpl("double-line", "DOUBLE_LINE", 4, 30, ["LINE"], ["line", "double"], 25, (n) =>
      layoutDoubleLine(n, 2)
    ),
    tmpl("multi-line", "DOUBLE_LINE", 9, 30, ["LINE", "MAJOR_CHANGE"], ["multi-line"], 40, (n) =>
      layoutDoubleLine(n, 3)
    ),
    tmpl("v-back", "V", 3, 30, ["V", "EXPAND", "MERGE"], ["v", "symmetric", "show"], 30, (n) =>
      layoutV(n, false, 0.72)
    ),
    tmpl("v-front", "V", 3, 30, ["V", "EXPAND"], ["v", "v-front"], 30, (n) =>
      layoutV(n, false, -0.55)
    ),
    tmpl(
      "wide-v",
      "WIDE_V",
      5,
      30,
      ["EXPAND", "MAJOR_CHANGE", "V"],
      ["wide", "strong", "symmetric", "show"],
      32,
      (n) => layoutV(n, true, 0.78)
    ),
    tmpl("diagonal-down", "DIAGONAL", 3, 30, ["DIAGONAL", "EXPAND"], ["diagonal"], 35, (n) =>
      layoutDiagonal(n, 1)
    ),
    tmpl("diagonal-up", "DIAGONAL", 3, 30, ["DIAGONAL", "EXPAND"], ["diagonal", "large-diagonal"], 35, (n) =>
      layoutDiagonal(n, -1)
    ),
    tmpl(
      "double-diagonal",
      "DOUBLE_DIAGONAL",
      6,
      30,
      ["DIAGONAL", "SPLIT", "MAJOR_CHANGE"],
      ["diagonal", "split"],
      40,
      (n) => layoutDoubleDiagonal(n)
    ),
    tmpl("triangle", "TRIANGLE", 3, 24, ["TRIANGLE", "CENTER", "V"], ["triangle"], 40, (n) =>
      layoutTriangle(n)
    ),
    tmpl("diamond", "DIAMOND", 4, 24, ["CONTRACT", "MERGE", "CENTER"], ["diamond", "symmetric"], 45, (n) =>
      layoutDiamond(n, false)
    ),
    tmpl(
      "diamond-center",
      "DIAMOND",
      5,
      24,
      ["CENTER", "CONTRACT"],
      ["diamond", "diamond-center"],
      46,
      (n) => layoutDiamond(n, true)
    ),
    tmpl("square", "GRID", 4, 4, ["LINE", "HOLD"], ["square"], 30, (n) => layoutSquare(n)),
    tmpl("grid", "GRID", 6, 40, ["LINE", "MAJOR_CHANGE"], ["grid"], 55, (n) => layoutGrid(n)),
    tmpl("arc", "ARC", 5, 30, ["EXPAND", "ARC", "MAJOR_CHANGE"], ["arc", "show"], 50, (n) =>
      layoutArc(n)
    ),
    tmpl("cluster", "CLUSTER", 3, 30, ["CLUSTER", "CONTRACT", "HOLD"], ["cluster"], 25, (n) =>
      layoutCluster(n)
    ),
    tmpl(
      "center-wings",
      "CENTER_WINGS",
      5,
      30,
      ["CENTER", "EXPAND", "SPLIT", "MAJOR_CHANGE"],
      ["center-wings", "show", "hierarchy"],
      60,
      (n) => layoutCenterWings(n)
    ),
    tmpl(
      "split",
      "SPLIT",
      4,
      40,
      ["SPLIT", "MAJOR_CHANGE"],
      ["split", "groups"],
      70,
      (n, opt) => layoutSplit(n, opt.groupSizes)
    ),
    tmpl(
      "groups-8-8-8",
      "SPLIT",
      24,
      24,
      ["SPLIT", "MAJOR_CHANGE"],
      ["group-based", "groups"],
      85,
      (n) => layoutSplit(n, [8, 8, 8])
    ),
    tmpl(
      "groups-6-12-6",
      "SPLIT",
      24,
      24,
      ["SPLIT", "MAJOR_CHANGE"],
      ["group-based", "groups"],
      85,
      (n) => layoutSplit(n, [6, 12, 6])
    ),
    tmpl(
      "groups-4-8-8-4",
      "SPLIT",
      24,
      24,
      ["SPLIT", "MAJOR_CHANGE"],
      ["group-based", "groups"],
      85,
      (n) => layoutSplit(n, [4, 8, 8, 4])
    ),
    tmpl("pyramid", "PYRAMID", 6, 40, ["MAJOR_CHANGE", "TRIANGLE", "CENTER"], ["pyramid", "show"], 75, (n) =>
      layoutPyramid(n)
    ),
    tmpl("arrow", "ARROW", 5, 24, ["V", "EXPAND"], ["arrow"], 40, (n) => layoutArrow(n)),
    tmpl("two-plus-three", "CENTER_WINGS", 5, 5, ["CENTER", "V"], ["2-plus-3"], 40, () =>
      layoutCenterWings(5)
    ),
    tmpl("center-plus-two", "CENTER", 3, 3, ["CENTER", "V"], ["center-plus-two"], 22, () =>
      layoutCenter(3)
    ),
    tmpl("wave", "ARC", 13, 30, ["EXPAND", "MAJOR_CHANGE", "ARC"], ["wave", "show"], 55, (n) =>
      layoutArc(n, 0.88, Math.PI * 0.08, Math.PI * 0.92)
    ),
  ];
}

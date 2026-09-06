import type { SectionLabelV2 } from "../../types/songStructure";

/**
 * 楽曲セクションと隊形カテゴリの適合スコアを評価。
 * OUTRO の平坦 GRID 排除・キメ隊形優遇など、演出意図を直接反映する。
 */
export function evaluateSectionContextScore(
  label: SectionLabelV2,
  category: string
): number {
  let score = 0;
  const cat = category.toUpperCase();

  switch (label) {
    case "OUTRO":
      // ラストシーンはキメ隊形（V字・ピラミッド・ダイヤ・大扇）を大優遇
      if (
        ["V_SHAPE", "PYRAMID", "DIAMOND", "ARC", "W_SHAPE"].includes(cat)
      ) {
        score += 0.4;
      } else if (["GRID", "TWO_ROWS", "PARALLEL"].includes(cat)) {
        score -= 0.35; // 意図のわからない平坦な四角形や並列は排除
      }
      break;

    case "INTRO":
      if (["DIAMOND", "PYRAMID", "V_SHAPE", "ARC"].includes(cat)) {
        score += 0.3;
      }
      break;

    case "CHORUS":
      if (
        ["V_SHAPE", "STAGGERED", "ARC", "W_SHAPE", "PYRAMID"].includes(cat)
      ) {
        score += 0.25;
      }
      break;

    case "BREAKDOWN":
      if (["GRID", "COMPACT", "CIRCLE"].includes(cat)) {
        score += 0.2;
      }
      break;

    default:
      break;
  }

  return Number(score.toFixed(3));
}

/**
 * 黄金ファミリー／雛形 ID をセクション演出ルール用カテゴリへ正規化。
 */
export function resolveSectionRuleCategory(
  familyOrCategory: string,
  layoutId?: string
): string {
  const id = (layoutId ?? "").toLowerCase();
  if (/pyramid/.test(id) && !/inverse/.test(id)) return "PYRAMID";
  if (/diamond/.test(id)) return "DIAMOND";
  if (/(?:^|_)arc|arc_tight|semicircle/.test(id)) return "ARC";
  if (/w_shape|wedge/.test(id)) return "W_SHAPE";
  if (/^grid|columns_|rows_/.test(id)) return "GRID";
  if (/two_rows|stagger/.test(id)) return "STAGGERED";
  if (/circle|ring|oval/.test(id)) return "CIRCLE";
  if (/cluster|compact|scatter_center/.test(id)) return "COMPACT";
  if (/^(?:line|line_front|line_back)/.test(id)) return "PARALLEL";

  const fam = familyOrCategory.toUpperCase();
  if (fam === "STAGGERED_GRID") return "STAGGERED";
  if (fam === "DIAMOND_BOX") return "DIAMOND";
  if (fam === "TIGHT_CLUSTER") return "COMPACT";
  if (fam === "WING_SPREAD") return "W_SHAPE";
  if (fam === "HORIZON_LINE") return "PARALLEL";
  if (fam === "V_SHAPE") return "V_SHAPE";
  return fam;
}

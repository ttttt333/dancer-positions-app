export const ANNOTATION_INSTRUCTIONS = [
  "AIを正解として評価しない。自分ならどう振付するかを基準にする。",
  "Human First: 最初は Blind（AI非表示）で注釈する。",
  "Formation は正解を1つにせず Top 3 まで選ぶ。",
  "Cue には importance（0-100）を付ける。90+ Major / 70-89 Strong / 40-69 Moderate / 0-39 Minor。",
  "「良いけど実行できない」は execution を低くし、overall だけで隠さない。",
  "人間同士の意見の違いはエラーではない。",
  "AI-Assisted の結果は Ground Truth に混ぜない。",
].join("\n");

export const FORMATION_RUBRIC = {
  musicFit: "曲との一致",
  visualImpact: "観客から見た強さ",
  transitionQuality: "前の形から自然につながるか",
  execution: "実際に踊れるか",
  originality: "ありきたり過ぎないか",
};

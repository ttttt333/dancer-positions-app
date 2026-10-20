import type { ChoreographyProjectJson } from "../types/choreography";

/**
 * 名前の表示位置をプロジェクト全体に即時適用する。
 * 「丸の内」時は表情スタンプがあると名前が下に固定されるため、スタンプを外して見た目を一致させる。
 */
export function withDancerLabelPosition(
  project: ChoreographyProjectJson,
  pos: "inside" | "below"
): ChoreographyProjectJson {
  if (pos === "below") {
    if (project.dancerLabelPosition === "below") return project;
    return { ...project, dancerLabelPosition: "below" };
  }

  let formationsChanged = false;
  const formations = project.formations.map((f) => {
    let dancersChanged = false;
    const dancers = f.dancers.map((d) => {
      if (d.faceStamp == null) return d;
      dancersChanged = true;
      const { faceStamp: _removed, ...rest } = d;
      return rest;
    });
    if (!dancersChanged) return f;
    formationsChanged = true;
    return { ...f, dancers };
  });

  if (project.dancerLabelPosition === "inside" && !formationsChanged) {
    return project;
  }

  return {
    ...project,
    dancerLabelPosition: "inside",
    ...(formationsChanged ? { formations } : {}),
  };
}

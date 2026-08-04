import type { ChoreographyProjectJson } from "../types/choreography";

const DEFAULT_UNTITLED = new Set([
  "",
  "無題の作品",
  "Untitled project",
  "제목 없는 작품",
  "未命名作品",
]);

/** 新規作成直後で、まだ作品名が決まっていないか */
export function projectNeedsInitialName(
  project: ChoreographyProjectJson | null | undefined,
  projectName: string
): boolean {
  if (!project) return true;
  const name = projectName.trim() || project.pieceTitle?.trim() || "";
  if (!DEFAULT_UNTITLED.has(name)) return false;

  if (project.cues.length > 0) return false;
  if (project.formations.some((f) => (f.dancers?.length ?? 0) > 0)) return false;
  if (project.audio?.kind) return false;
  return true;
}

import type { ChoreographyProjectJson } from "../types/choreography";

const DEFAULT_UNTITLED = new Set([
  "",
  "無題の作品",
  "Untitled project",
  "제목 없는 작품",
  "未命名作品",
]);

export function isUntitledProjectName(name: string | null | undefined): boolean {
  return DEFAULT_UNTITLED.has((name ?? "").trim());
}

/** 新規作成直後で、まだ作品名が決まっていないか */
export function projectNeedsInitialName(
  project: ChoreographyProjectJson | null | undefined,
  projectName: string
): boolean {
  if (!project) return true;
  const title = project.pieceTitle?.trim() ?? "";
  const listed = projectName.trim();
  if (!isUntitledProjectName(title) && title) return false;
  if (!isUntitledProjectName(listed) && listed) return false;
  return true;
}

/**
 * クラウドに保存した作品（projectId）向けの共有 URL。
 * エディタの `ShareLinksSheetContent` と同じ形。
 */
export function projectShareLinks(projectId: number): { collab: string; view: string } {
  if (typeof window === "undefined") {
    return { collab: "", view: "" };
  }
  const o = window.location.origin;
  return {
    collab: `${o}/editor/${projectId}?collab=1`,
    view: `${o}/view/${projectId}`,
  };
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      window.prompt("コピーする内容", text);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * クラウドに保存した作品（projectId）向けの共有 URL。
 * 閲覧用は `viewToken` がある場合は推奨の `/view/s/{token}`（生徒はログイン不要）。
 */
export function projectShareLinks(
  projectId: number,
  viewToken?: string | null
): { collab: string; view: string } {
  if (typeof window === "undefined") {
    return { collab: "", view: "" };
  }
  const o = window.location.origin;
  const t = viewToken && String(viewToken).trim() !== "" ? String(viewToken).trim() : null;
  return {
    collab: `${o}/editor/${projectId}?collab=1`,
    view: t ? `${o}/view/s/${t}` : `${o}/view/${projectId}`,
  };
}

export function buildSingleShareUrlTextFileContent(options: {
  pieceTitle: string;
  kind: "collab" | "view";
  url: string;
}): string {
  const title = (options.pieceTitle || "無題の作品").trim() || "無題の作品";
  const whenStr = new Date().toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  if (options.kind === "collab") {
    return `ChoreoCore 共有リンク（共同編集用）
================================================================================

作品名: ${title}
保存日時: ${whenStr}

【先生・振り付けし・チーム用】
他の先生やチームは、この URL から同じ作品データを編集できます（ChoreoCore にログインが必要です）。

${options.url}

---
このファイルは共有用のメモです。
ChoreoCore
`;
  }
  return `ChoreoCore 共有リンク（閲覧用）
================================================================================

作品名: ${title}
保存日時: ${whenStr}

【生徒用】閲覧モードだけ
生徒はこの URL から立ち位置の閲覧・パート表示のみ行えます（編集はできません）。

${options.url}

---
このファイルは共有用のメモです。
ChoreoCore
`;
}

/** ファイル名に使えるよう簡易サニタイズ */
export function shareLinksSafeFilenameBase(pieceTitle: string): string {
  const t = (pieceTitle || "work").trim() || "work";
  return t
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 48) || "work";
}

export function downloadTextFile(
  filename: string,
  text: string,
  mime: string = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function copyViaHiddenTextarea(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (copyViaHiddenTextarea(text)) return true;
    try {
      window.prompt("コピーする内容（OK で閉じます）", text);
      return true;
    } catch {
      return false;
    }
  }
}

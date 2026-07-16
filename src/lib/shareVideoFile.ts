/**
 * 動画ファイルを端末の共有シートで送る。未対応なら false。
 */
export async function shareVideoFile(
  blob: Blob,
  fileName: string,
  title?: string
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return false;
  }
  try {
    const file = new File([blob], fileName, { type: blob.type || "video/mp4" });
    const n = navigator as Navigator & {
      canShare?: (x: { files: File[] }) => boolean;
    };
    if (n.canShare && !n.canShare({ files: [file] })) {
      return false;
    }
    await navigator.share({
      files: [file],
      title: title ?? "ステージ動画",
    });
    return true;
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      (e as { name?: string }).name === "AbortError"
    ) {
      return true;
    }
    return false;
  }
}

export function downloadVideoBlob(blob: Blob, fileName: string): void {
  // download 属性が効かないと blob URL へ遷移する。即 revoke すると真っ白になるため、
  // DOM に載せてからクリックし、ダウンロード開始後に遅延 revoke する。
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function safeVideoBaseName(name: string): string {
  return name.replace(/[^\w\u3000-\u30ff\u4e00-\u9faf-]+/g, "_").slice(0, 80) || "choreogrid";
}

import { toPng } from "html-to-image";

const STAGE_ROOT_ID = "stage-export-root";

export function getStageExportElement(): HTMLElement | null {
  return document.getElementById(STAGE_ROOT_ID);
}

function safeFileBase(name: string) {
  return (
    name.replace(/[^\w\u3000-\u9faf-]+/g, "_").slice(0, 80) || "choreogrid"
  );
}

/**
 * 現在表示中の 2D ステージ枠（#stage-export-root）を PNG としてダウンロード。
 */
export async function getStagePngDataUrl(): Promise<string> {
  const el = getStageExportElement();
  if (!el) {
    throw new Error("2D ステージのエリアが見つかりません。平面表示（2D）に切り替えてからお試しください。");
  }
  return toPng(el, { pixelRatio: 2, cacheBust: true });
}

export async function downloadStagePngFile(pieceName: string): Promise<void> {
  const dataUrl = await getStagePngDataUrl();
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${safeFileBase(pieceName)}-stage.png`;
  a.click();
}

const pngFileName = (piece: string) =>
  `${safeFileBase(piece || "stage")}-stage.png`;

/**
 * 画像を端末の共有（対応端末）で送る。失敗 / 未対応なら false。
 */
export async function sharePngDataUrl(
  dataUrl: string,
  fileName: string
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return false;
  }
  try {
    const res = await fetch(dataUrl);
    const buf = await res.arrayBuffer();
    const file = new File([buf], fileName, { type: "image/png" });
    const n = navigator as Navigator & {
      canShare?: (x: { files: File[] }) => boolean;
    };
    if (n.canShare && !n.canShare({ files: [file] })) {
      return false;
    }
    await navigator.share({ files: [file], title: "ステージ画像" });
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

/**
 * 共有のあと、ダウンロード用。
 */
export async function downloadFromDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

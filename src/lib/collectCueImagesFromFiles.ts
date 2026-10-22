import { unzipSync } from "fflate";
import { isParseableImageFile } from "./prepareImageForParse";
import { sortCueExportImageFiles } from "./cueExportImageMeta";

function isZipFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".zip") || file.type === "application/zip";
}

/**
 * PNG 群またはキュー図 ZIP から、解析対象の画像 File を番号順で返す。
 */
export async function collectCueImagesFromFiles(
  files: readonly File[]
): Promise<File[]> {
  const images: File[] = [];

  for (const file of files) {
    if (isZipFile(file)) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const unzipped = unzipSync(buf);
      for (const [path, data] of Object.entries(unzipped)) {
        if (path.endsWith("/") || path.includes("__MACOSX")) continue;
        const base = path.split("/").pop() || path;
        if (!/\.(png|jpe?g|webp|gif)$/i.test(base)) continue;
        const copy = new Uint8Array(data.byteLength);
        copy.set(data);
        const mime = base.toLowerCase().endsWith(".png")
          ? "image/png"
          : base.toLowerCase().endsWith(".webp")
            ? "image/webp"
            : "image/jpeg";
        images.push(new File([copy], base, { type: mime }));
      }
      continue;
    }
    if (isParseableImageFile(file)) {
      images.push(file);
    }
  }

  return sortCueExportImageFiles(images);
}

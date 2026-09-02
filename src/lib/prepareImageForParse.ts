/** 解析 API へ送る画像の最大辺（px） */
/** Vision API タイムアウト回避のため 1024px 上限 */
const PARSE_IMAGE_MAX_PX = 1024;
const PARSE_IMAGE_JPEG_QUALITY = 0.88;

/**
 * ファイル選択ダイアログ用。
 * `image/*` を先頭に置くと iOS の写真アプリで HEIC が出る。
 * 拡張子は Files / Android 用の保険。
 */
export const PARSE_IMAGE_FILE_ACCEPT = [
  "image/*",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  ".heic",
  ".heif",
  ".heics",
  ".heifs",
  ".hif",
  ".avif",
  ".jpg",
  ".jpeg",
  ".jpe",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
].join(",");

const IMAGE_EXT_RE =
  /\.(jpe?g|jpe|png|webp|gif|bmp|tiff?|heic|heics|heif|heifs|hif|avif)$/i;

const HEIF_EXT_RE = /\.(heic|heics|heif|heifs|hif)$/i;

/** ISO BMFF `ftyp` の major brand（HEIF/HEIC 系） */
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "heif",
  "mif1",
  "msf1",
]);

export type PreparedParseImage = {
  base64: string;
  mimeType: "image/jpeg";
};

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function heifBrandFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (
    bytes[4] !== 0x66 ||
    bytes[5] !== 0x74 ||
    bytes[6] !== 0x79 ||
    bytes[7] !== 0x70
  ) {
    return null;
  }
  return String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
}

export function isHeifBrand(brand: string | null | undefined): boolean {
  return Boolean(brand && HEIF_BRANDS.has(brand));
}

function mimeLooksLikeHeif(type: string): boolean {
  const t = type.toLowerCase();
  if (!t) return false;
  return (
    t === "image/heic" ||
    t === "image/heif" ||
    t === "image/heic-sequence" ||
    t === "image/heif-sequence" ||
    t.includes("heic") ||
    t.includes("heif")
  );
}

export function isHeicFile(file: File): boolean {
  if (mimeLooksLikeHeif(file.type)) return true;
  return HEIF_EXT_RE.test(file.name);
}

export function isParseableImageFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  if (IMAGE_EXT_RE.test(file.name)) return true;
  if (type === "" || type === "application/octet-stream") {
    return IMAGE_EXT_RE.test(file.name);
  }
  return false;
}

async function fileLooksLikeHeif(file: File): Promise<boolean> {
  if (isHeicFile(file)) return true;
  try {
    const buf = await file.slice(0, 32).arrayBuffer();
    return isHeifBrand(heifBrandFromBytes(new Uint8Array(buf)));
  } catch {
    return false;
  }
}

function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.jpg`;
}

function heicBlobForConverter(file: File): Blob {
  if (mimeLooksLikeHeif(file.type)) return file;
  return file.slice(0, file.size, "image/heic");
}

/** Chrome 等ネイティブ非対応ブラウザ向け HEIC → JPEG */
async function convertHeicToJpegFile(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({
    blob: heicBlobForConverter(file),
    toType: "image/jpeg",
    quality: PARSE_IMAGE_JPEG_QUALITY,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  if (!blob) {
    throw new Error("HEIC の変換に失敗しました");
  }
  return new File([blob], jpegFileName(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

function wrapHeicError(e: unknown): Error {
  const detail = e instanceof Error ? e.message : "";
  const staleChunk =
    detail.includes("Failed to fetch dynamically imported module") ||
    detail.includes("Importing a module script failed");
  if (staleChunk) {
    return new Error(
      "HEIC の変換モジュールを読み込めませんでした。ページを再読み込み（更新）してからもう一度お試しください。"
    );
  }
  return new Error(
    detail ? `HEIC を読み込めませんでした: ${detail}` : "HEIC を読み込めませんでした"
  );
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を表示できませんでした"));
    };
    img.src = url;
  });
}

async function rasterizeToCanvas(file: File): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        throw new Error("画像の変換に失敗しました");
      }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas;
    } catch {
      /* fall through */
    }
  }

  const img = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("画像の変換に失敗しました");
  }
  ctx.drawImage(img, 0, 0);
  return canvas;
}

async function rasterizeImageFile(file: File): Promise<HTMLCanvasElement> {
  try {
    return await rasterizeToCanvas(file);
  } catch (nativeErr) {
    const tryHeic = await fileLooksLikeHeif(file);
    if (!tryHeic) throw nativeErr;
    try {
      const jpeg = await convertHeicToJpegFile(file);
      return await rasterizeToCanvas(jpeg);
    } catch (heicErr) {
      throw wrapHeicError(heicErr);
    }
  }
}

function canvasToJpegBase64(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像の変換に失敗しました"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          if (typeof dataUrl !== "string") {
            reject(new Error("画像の変換に失敗しました"));
            return;
          }
          const comma = dataUrl.indexOf(",");
          resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
        };
        reader.onerror = () => reject(new Error("画像の変換に失敗しました"));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      PARSE_IMAGE_JPEG_QUALITY
    );
  });
}

/**
 * 写真・スキャン・HEIC などを JPEG Base64 に正規化（リサイズ含む）。
 * OpenAI Vision へ送る前にクライアントで呼ぶ。
 */
export async function prepareImageFileForParse(file: File): Promise<PreparedParseImage> {
  if (!isParseableImageFile(file) && !(await fileLooksLikeHeif(file))) {
    throw new Error("画像ファイル（JPEG / PNG / HEIC など）を選んでください");
  }

  let sourceCanvas: HTMLCanvasElement;
  try {
    sourceCanvas = await rasterizeImageFile(file);
  } catch (e) {
    if (e instanceof Error && e.message.includes("HEIC")) throw e;
    if (isHeicFile(file) || fileExt(file.name) === "") {
      throw wrapHeicError(e);
    }
    throw new Error(
      "画像を読み込めませんでした。JPEG / PNG / HEIC（iPhone の写真）でお試しください"
    );
  }

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  if (!srcW || !srcH) {
    throw new Error("画像のサイズを取得できませんでした");
  }

  const scale = Math.min(1, PARSE_IMAGE_MAX_PX / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) {
    throw new Error("画像の変換に失敗しました");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  // 手書き・薄い字を読みやすくする簡易コントラスト強調
  ctx.filter = "grayscale(1) contrast(1.4) brightness(1.06)";
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  ctx.filter = "none";

  const base64 = await canvasToJpegBase64(out);
  return { base64, mimeType: "image/jpeg" };
}

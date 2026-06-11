/** 解析 API へ送る画像の最大辺（px） */
const PARSE_IMAGE_MAX_PX = 2048;
const PARSE_IMAGE_JPEG_QUALITY = 0.88;

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;

export type PreparedParseImage = {
  base64: string;
  mimeType: "image/jpeg";
};

export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (
    type === "image/heic" ||
    type === "image/heif" ||
    type.includes("heic") ||
    type.includes("heif")
  ) {
    return true;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "heic" || ext === "heif";
}

export function isParseableImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT_RE.test(file.name);
}

function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.jpg`;
}

/** Chrome 等ネイティブ非対応ブラウザ向け HEIC → JPEG（heic2any は初回のみ動的読込） */
async function convertHeicToJpegFile(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({
    blob: file,
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

async function decodeFileForRasterize(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  return convertHeicToJpegFile(file);
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
  if (!isParseableImageFile(file)) {
    throw new Error("画像ファイル（JPEG / PNG / HEIC など）を選んでください");
  }

  let sourceCanvas: HTMLCanvasElement;
  try {
    const decoded = await decodeFileForRasterize(file);
    sourceCanvas = await rasterizeToCanvas(decoded);
  } catch (e) {
    if (isHeicFile(file)) {
      const detail = e instanceof Error ? e.message : "";
      throw new Error(
        detail
          ? `HEIC を読み込めませんでした: ${detail}`
          : "HEIC を読み込めませんでした"
      );
    }
    throw new Error("画像を読み込めませんでした。別の形式（JPEG / PNG）でお試しください");
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

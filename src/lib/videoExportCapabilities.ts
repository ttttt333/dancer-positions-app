export type VideoExportCaptureMode = "offscreen" | "html-canvas";

export type VideoExportCapabilityCheck = {
  supported: boolean;
  captureMode: VideoExportCaptureMode | null;
  mediaRecorderMimeType: string | null;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  warnings: string[];
  blockReason: string | null;
};

function canCaptureFromOffscreenCanvas(): boolean {
  if (typeof OffscreenCanvas === "undefined") return false;
  try {
    const canvas = new OffscreenCanvas(2, 2);
    return typeof (canvas as OffscreenCanvas & { captureStream?: unknown })
      .captureStream === "function";
  } catch {
    return false;
  }
}

function canCaptureFromHtmlCanvas(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  return typeof canvas.captureStream === "function";
}

export function getSupportedRecorderMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm",
    "video/mp4",
  ];
  return (
    candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIos && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

/**
 * 動画エクスポート前のブラウザ互換性診断。
 * UI の無効化・警告表示に使う。
 */
export function checkVideoExportCapabilities(): VideoExportCapabilityCheck {
  const warnings: string[] = [];

  if (typeof window === "undefined") {
    return {
      supported: false,
      captureMode: null,
      mediaRecorderMimeType: null,
      sharedArrayBuffer: false,
      crossOriginIsolated: false,
      warnings,
      blockReason: "ブラウザ環境ではありません",
    };
  }

  const crossOriginIsolated = Boolean(
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated
  );
  const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";

  let captureMode: VideoExportCaptureMode | null = null;
  if (canCaptureFromOffscreenCanvas()) {
    captureMode = "offscreen";
  } else if (canCaptureFromHtmlCanvas()) {
    captureMode = "html-canvas";
    warnings.push(
      "この端末では HTML Canvas 録画モードを使用します（iOS Safari 等）"
    );
  }

  const mediaRecorderMimeType = getSupportedRecorderMimeType();

  if (!crossOriginIsolated) {
    warnings.push(
      "FFmpeg 変換が遅い、または失敗する場合があります（COOP/COEP 未設定）"
    );
  } else if (!sharedArrayBuffer) {
    warnings.push("SharedArrayBuffer が利用できません（変換が遅くなる可能性）");
  }

  if (isIosSafari()) {
    warnings.push(
      "iOS では共有の代わりにダウンロード／別タブで開く場合があります"
    );
  }

  let blockReason: string | null = null;
  if (!captureMode) {
    blockReason =
      "このブラウザでは動画キャプチャ（captureStream）に対応していません";
  } else if (!mediaRecorderMimeType) {
    blockReason =
      "このブラウザでは MediaRecorder による録画に対応していません";
  }

  return {
    supported: blockReason == null,
    captureMode,
    mediaRecorderMimeType: mediaRecorderMimeType || null,
    sharedArrayBuffer,
    crossOriginIsolated,
    warnings,
    blockReason,
  };
}

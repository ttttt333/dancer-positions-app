/**
 * レイアウト／ブレークポイント判定用のビューポート寸法。
 * `document.documentElement.clientWidth` を優先（縦スクロールバー幅を除く）。
 * 要素の実寸は `getBoundingClientRect` を使うこと。
 */
export function readLayoutViewportSize(): { width: number; height: number } {
  if (typeof document === "undefined") {
    return { width: 0, height: 0 };
  }
  const root = document.documentElement;
  const vv = window.visualViewport;
  return {
    width: root.clientWidth || vv?.width || window.innerWidth,
    height: root.clientHeight || vv?.height || window.innerHeight,
  };
}

/** 開発時: innerWidth と clientWidth の差をログ（Windows スクロールバー切り分け用） */
export function logLayoutViewportWidthDelta(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const { width, height } = readLayoutViewportSize();
  const dw = window.innerWidth - width;
  const dh = window.innerHeight - height;
  if (dw !== 0 || dh !== 0) {
    console.info(
      "[viewport] innerWidth−clientWidth:",
      dw,
      "innerHeight−clientHeight:",
      dh,
      { innerWidth: window.innerWidth, clientWidth: width }
    );
  }
}

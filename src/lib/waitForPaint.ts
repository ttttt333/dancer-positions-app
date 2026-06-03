/** React の DOM 更新後、1〜2 フレーム待ってからキャプチャする */
export function waitForPaint(extraMs = 20): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, extraMs);
      });
    });
  });
}

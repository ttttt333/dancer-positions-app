/** 重い同期処理の前に描画・入力応答を返す */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });
  });
}

/** confirm 直後など: クリックハンドラを抜けてから重い処理を走らせる（INP 対策） */
export function deferAfterUserGesture(work: () => void | Promise<void>): void {
  window.setTimeout(() => {
    void work();
  }, 0);
}

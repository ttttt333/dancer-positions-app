/**
 * IME 変換中の Enter / 確定キーかどうか。
 * true のときは「確定」だけで、アプリ側の保存・コミットを走らせない。
 */
export function isImeComposingKey(e: {
  nativeEvent?: { isComposing?: boolean };
  isComposing?: boolean;
  keyCode?: number;
}): boolean {
  if (e.nativeEvent?.isComposing || e.isComposing) return true;
  // 一部ブラウザは変換中の Enter を keyCode 229 で送る
  return e.keyCode === 229;
}

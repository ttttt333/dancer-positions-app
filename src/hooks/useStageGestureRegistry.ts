/**
 * ステージ板のポインタージェスチャー（ドラッグ／リサイズ／回転／マーキー）の
 * 「今どれが進行中か」と pointer capture の寿命を一箇所で管理する。
 *
 * - start() 冒頭で必ず forceEnd()（防御的リセット／自己修復）
 * - capture の解放は forceEnd() 内の一箇所だけ
 * - ペイロード本体は呼び出し側の ref に置き、onForceEnd でまとめて消す
 */

export type StageGestureType =
  | "drag"
  | "groupDrag"
  | "setPieceDrag"
  | "setPieceResize"
  | "setPieceRotate"
  | "markerResize"
  | "nameBelowFontResize"
  | "markerRotate"
  | "marquee"
  | "floorTextDrag"
  | "floorTextResize"
  | "floorTextPlace"
  | "floorTextMultiDrag"
  | "floorTextTapOrDrag";

export type StageGestureState = {
  type: StageGestureType;
  pointerId: number;
  targetEl: HTMLElement;
  startedAt: number;
};

export type StageGestureRegistry = {
  start: (state: StageGestureState) => void;
  end: (pointerId: number) => void;
  forceEnd: () => void;
  getCurrent: () => StageGestureState | null;
};

export function createStageGestureRegistry(options?: {
  /** forceEnd のたびに呼ばれる（ペイロード ref / UI draft の一括クリア用） */
  onForceEnd?: () => void;
}): StageGestureRegistry {
  let current: StageGestureState | null = null;

  function forceEnd() {
    if (current) {
      const { targetEl, pointerId } = current;
      try {
        if (
          typeof targetEl.hasPointerCapture === "function" &&
          targetEl.hasPointerCapture(pointerId)
        ) {
          targetEl.releasePointerCapture(pointerId);
        }
      } catch {
        // 要素が既に DOM から外れている等
      }
    }
    current = null;
    options?.onForceEnd?.();
  }

  function start(state: StageGestureState) {
    // 前のジェスチャーの終了が漏れていても、次の開始で必ずクリーンにする
    forceEnd();
    current = state;
    try {
      state.targetEl.setPointerCapture(state.pointerId);
    } catch {
      // 失敗しても致命的ではない（window リスナー側で追従できる）
    }
  }

  function end(pointerId: number) {
    if (current && current.pointerId === pointerId) {
      forceEnd();
    }
  }

  function getCurrent() {
    return current;
  }

  return { start, end, forceEnd, getCurrent };
}

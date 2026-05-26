import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";

/** ref コールバックで同じ要素の setState を繰り返さない（React #185 防止） */
export function useSafeElementRef<T extends HTMLElement>(
  setElement: Dispatch<SetStateAction<T | null>>
) {
  return useCallback(
    (el: T | null) => {
      setElement((prev) => (prev === el ? prev : el));
    },
    [setElement]
  );
}

/** mutable ref だけを更新（コールバック identity を固定して ref の null→el ループを防ぐ） */
export function useAssignRef<T>(
  target: RefObject<T | null> | MutableRefObject<T | null>
) {
  return useCallback(
    (el: T | null) => {
      target.current = el;
    },
    [target]
  );
}

/** mutable ref + state を同時に更新（editorPane 等） */
export function useAttachElementRef<T extends HTMLElement>(
  setElement: Dispatch<SetStateAction<T | null>>,
  target: RefObject<T | null> | MutableRefObject<T | null>
) {
  return useCallback(
    (el: T | null) => {
      target.current = el;
      setElement((prev) => (prev === el ? prev : el));
    },
    [setElement, target]
  );
}

import { useCallback, type Dispatch, type SetStateAction } from "react";

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

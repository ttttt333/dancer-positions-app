export type LoadAbort = {
  signal: AbortSignal;
  isAborted: () => boolean;
  throwIfAborted: () => void;
};

export function createLoadAbort(): { loadAbort: LoadAbort; cancel: () => void } {
  const controller = new AbortController();
  const loadAbort: LoadAbort = {
    signal: controller.signal,
    isAborted: () => controller.signal.aborted,
    throwIfAborted: () => {
      if (controller.signal.aborted) {
        throw new DOMException("Remote audio load aborted", "AbortError");
      }
    },
  };
  return { loadAbort, cancel: () => controller.abort() };
}

/** await 後に abort されていれば AbortError を投げる */
export async function awaitUnlessAborted<T>(
  loadAbort: LoadAbort,
  promise: Promise<T>
): Promise<T> {
  loadAbort.throwIfAborted();
  const value = await promise;
  loadAbort.throwIfAborted();
  return value;
}

/** useEffect 内の非同期ロードを AbortController で束ねる */
export function runLoadTask(
  task: (loadAbort: LoadAbort) => Promise<void>
): () => void {
  const { loadAbort, cancel } = createLoadAbort();
  void task(loadAbort).catch((err) => {
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error("[remoteAudio] load task failed:", err);
  });
  return cancel;
}

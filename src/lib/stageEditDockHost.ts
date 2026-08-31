/** 右メニュー内の編集ドック差込口。StageBoard から portal する。 */

let host: HTMLElement | null = null;
const listeners = new Set<() => void>();

export function registerStageEditDockHost(el: HTMLElement | null): void {
  host = el;
  listeners.forEach((fn) => fn());
}

export function subscribeStageEditDockHost(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getStageEditDockHost(): HTMLElement | null {
  return host;
}

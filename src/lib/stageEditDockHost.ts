/** 右メニュー内の編集ドック差込口。StageBoard から portal する。 */

let host: HTMLElement | null = null;
const listeners = new Set<() => void>();
const openRightPaneListeners = new Set<() => void>();

export type StageDockQuickSection = "shape" | "display" | "sort";

type DockSectionRequest = {
  requestId: number;
  section: StageDockQuickSection;
};

let dockSectionRequestId = 0;
const dockSectionListeners = new Set<(req: DockSectionRequest) => void>();

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

/** ステージ選択ドックを右側に出すため、折りたたみ右ペインを開くよう依頼する */
export function requestStageEditRightPane(): void {
  openRightPaneListeners.forEach((fn) => fn());
}

export function subscribeStageEditRightPaneRequest(
  onRequest: () => void
): () => void {
  openRightPaneListeners.add(onRequest);
  return () => {
    openRightPaneListeners.delete(onRequest);
  };
}

/** タイムライン等から雛形／表示／並び替えドックを開く */
export function requestStageDockSection(section: StageDockQuickSection): void {
  requestStageEditRightPane();
  dockSectionRequestId += 1;
  const req: DockSectionRequest = {
    requestId: dockSectionRequestId,
    section,
  };
  dockSectionListeners.forEach((fn) => fn(req));
}

export function subscribeStageDockSectionRequest(
  onRequest: (req: DockSectionRequest) => void
): () => void {
  dockSectionListeners.add(onRequest);
  return () => {
    dockSectionListeners.delete(onRequest);
  };
}

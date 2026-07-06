import type { LoadAbort } from "./loadAbort";

/** ロードタスク中に作った blob URL を abort 時にまとめて破棄する */
export class LoadScopedBlobUrls {
  private pending = new Set<string>();

  constructor(loadAbort: LoadAbort) {
    loadAbort.signal.addEventListener("abort", () => this.revokePending(), {
      once: true,
    });
  }

  create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.pending.add(url);
    return url;
  }

  /** 外部（fetch 等）で生成済みの URL を abort 対象に含める */
  adoptPending(url: string) {
    this.pending.add(url);
  }

  /** 永続化済み URL は abort 時に revoke しない */
  commit(url: string) {
    this.pending.delete(url);
  }

  private revokePending() {
    for (const url of this.pending) {
      URL.revokeObjectURL(url);
    }
    this.pending.clear();
  }
}

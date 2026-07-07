import type { LoadAbort } from "./loadAbort";
import {
  registerActiveBlobUrl,
  unregisterActiveBlobUrl,
} from "../activeBlobUrlRegistry";

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
    registerActiveBlobUrl(url);
    this.pending.add(url);
    return url;
  }

  /** 外部（fetch 等）で生成済みの URL を abort 対象に含める */
  adoptPending(url: string) {
    registerActiveBlobUrl(url);
    this.pending.add(url);
  }

  /** 永続化済み URL は abort 時に revoke しない */
  commit(url: string) {
    this.pending.delete(url);
  }

  private revokePending() {
    for (const url of this.pending) {
      unregisterActiveBlobUrl(url);
      URL.revokeObjectURL(url);
    }
    this.pending.clear();
  }
}

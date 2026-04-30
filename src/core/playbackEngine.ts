/**
 * 再生の単一窓口（HTMLAudioElement への橋渡し）。
 *
 * 目的: TimelinePanel / 将来のストアと「UI・座標・キュー編集」を分離し、
 * 再生時刻の参照・シーク・再生/一時停止をここに集約していく。
 *
 * 移行方針（段階的でよい）:
 * 1. `<audio>` を `attachMediaElement` で登録（既存 ref パターンと併用可）
 * 2. play / pause / seek は本クラス経由に寄せる
 * 3. 再生時刻の「真実」は element.currentTime とし、UI は subscribe で同期
 */

export type PlaybackTimeListener = (currentTimeSec: number) => void;
/** true = 再生中、false = 一時停止など */
export type PlaybackPlayingListener = (playing: boolean) => void;
export type PlaybackMetaListener = () => void;

export class PlaybackEngine {
  private media: HTMLAudioElement | null = null;

  private readonly timeListeners = new Set<PlaybackTimeListener>();
  private readonly playStateListeners = new Set<PlaybackPlayingListener>();
  private readonly metaListeners = new Set<PlaybackMetaListener>();

  private readonly onTimeLike = () => {
    this.emitTime();
  };

  private readonly onPlayEvent = () => {
    this.emitPlaying(true);
  };

  private readonly onPauseEvent = () => {
    this.emitPlaying(false);
  };

  private readonly onMeta = () => {
    this.emitMeta();
    this.emitTime();
  };

  private clearElementListeners() {
    const el = this.media;
    if (!el) return;
    el.removeEventListener("timeupdate", this.onTimeLike);
    el.removeEventListener("seeked", this.onTimeLike);
    el.removeEventListener("play", this.onPlayEvent);
    el.removeEventListener("pause", this.onPauseEvent);
    el.removeEventListener("loadedmetadata", this.onMeta);
    el.removeEventListener("durationchange", this.onMeta);
  }

  /** 非 null で登録、null で紐付け解除 */
  attachMediaElement(el: HTMLAudioElement | null) {
    if (this.media === el) return;
    this.clearElementListeners();
    this.media = el;
    if (!el) {
      this.emitPlaying(false);
      this.emitTime();
      return;
    }
    el.addEventListener("timeupdate", this.onTimeLike);
    el.addEventListener("seeked", this.onTimeLike);
    el.addEventListener("play", this.onPlayEvent);
    el.addEventListener("pause", this.onPauseEvent);
    el.addEventListener("loadedmetadata", this.onMeta);
    el.addEventListener("durationchange", this.onMeta);
    this.emitPlaying(!el.paused);
    this.emitMeta();
    this.emitTime();
  }

  getMediaElement(): HTMLAudioElement | null {
    return this.media;
  }

  play(): Promise<void> {
    const p = this.media?.play();
    return p ?? Promise.resolve();
  }

  pause(): void {
    this.media?.pause();
  }

  /**
   * シーク。duration が取れていれば [0, duration] に clamp。
   */
  seek(seconds: number): void {
    const el = this.media;
    if (!el) return;
    const d = el.duration;
    let t = seconds;
    if (Number.isFinite(d) && d > 0) {
      t = Math.min(Math.max(0, t), d);
    } else if (!Number.isFinite(t)) {
      return;
    }
    el.currentTime = t;
    this.emitTime();
  }

  getCurrentTime(): number {
    const el = this.media;
    if (!el || !Number.isFinite(el.currentTime)) return 0;
    return el.currentTime;
  }

  getDuration(): number {
    const el = this.media;
    const d = el?.duration;
    return Number.isFinite(d) && (d ?? 0) > 0 ? d! : 0;
  }

  isPaused(): boolean {
    return this.media?.paused ?? true;
  }

  setPlaybackRate(rate: number): void {
    if (!this.media || !Number.isFinite(rate)) return;
    this.media.playbackRate = rate;
  }

  onTimeUpdate(cb: PlaybackTimeListener): () => void {
    this.timeListeners.add(cb);
    return () => {
      this.timeListeners.delete(cb);
    };
  }

  onPlayingChange(cb: PlaybackPlayingListener): () => void {
    this.playStateListeners.add(cb);
    return () => {
      this.playStateListeners.delete(cb);
    };
  }

  /** 尺・ソース変更などメタ更新（duration 再取得用） */
  onMetaChange(cb: PlaybackMetaListener): () => void {
    this.metaListeners.add(cb);
    return () => {
      this.metaListeners.delete(cb);
    };
  }

  /** 外部（デコード直後など）から明示的に時刻通知したいとき */
  notifyTimeFromExternal(): void {
    this.emitTime();
  }

  private emitTime() {
    const t = this.getCurrentTime();
    for (const cb of this.timeListeners) {
      try {
        cb(t);
      } catch {
        /** 購読側の例外は切り離す */
      }
    }
  }

  private emitPlaying(playing: boolean) {
    for (const cb of this.playStateListeners) {
      try {
        cb(playing);
      } catch {
        /** ignore */
      }
    }
  }

  private emitMeta() {
    for (const cb of this.metaListeners) {
      try {
        cb();
      } catch {
        /** ignore */
      }
    }
  }
}

/** アプリ単位で 1 インスタンス（タブ内共有） */
export const playbackEngine = new PlaybackEngine();

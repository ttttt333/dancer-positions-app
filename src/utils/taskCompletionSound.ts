/**
 * タスク完了時に「ポン」という音を再生するユーティリティ
 */

export class TaskCompletionSound {
  private static audioContext: AudioContext | null = null;
  private static isEnabled: boolean = true;

  /**
   * AudioContextを初期化
   */
  private static getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * 「ポン」という音を生成して再生
   */
  static play(): void {
    if (!this.isEnabled) return;

    try {
      const context = this.getAudioContext();
      
      // 現在の時間を取得
      const currentTime = context.currentTime;
      
      // オシレーターを作成（サイン波）
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      // オシレーターの設定
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, currentTime); // 高めの音程
      oscillator.frequency.exponentialRampToValueAtTime(400, currentTime + 0.1); // 少し下げる
      
      // 音量の設定（アタックとリリース）
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, currentTime + 0.01); // 立ち上がり
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.2); // フェードアウト
      
      // 接続
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      // 再生
      oscillator.start(currentTime);
      oscillator.stop(currentTime + 0.2);
      
    } catch (error) {
      console.warn('タスク完了音の再生に失敗しました:', error);
    }
  }

  /**
   * 音を有効/無効にする
   */
  static setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * 音が有効かどうかを確認
   */
  static isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * AudioContextをクリーンアップ
   */
  static cleanup(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

/**
 * タスク完了時に音を再生する便利関数
 */
export function playTaskCompletionSound(): void {
  TaskCompletionSound.play();
}

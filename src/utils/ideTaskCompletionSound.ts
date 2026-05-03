/**
 * IDEタスク完了時に「PON!」という効果音を再生するユーティリティ
 */

export class IdeTaskCompletionSound {
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
   * 「PON!」という効果音を生成して再生
   */
  static play(): void {
    if (!this.isEnabled) return;

    try {
      const context = this.getAudioContext();
      const currentTime = context.currentTime;
      
      // メインの「ポン」音（低めの周波数）
      const mainOscillator = context.createOscillator();
      const mainGainNode = context.createGain();
      
      mainOscillator.type = 'sine';
      mainOscillator.frequency.setValueAtTime(200, currentTime); // 低めの音程
      
      // 音量の設定（アタックとリリース）
      mainGainNode.gain.setValueAtTime(0, currentTime);
      mainGainNode.gain.linearRampToValueAtTime(0.4, currentTime + 0.02); // 立ち上がり
      mainGainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.3); // フェードアウト
      
      // ハーモニクス（音に厚みを出す）
      const harmonicOscillator = context.createOscillator();
      const harmonicGainNode = context.createGain();
      
      harmonicOscillator.type = 'sine';
      harmonicOscillator.frequency.setValueAtTime(400, currentTime); // 1オクターブ上
      
      harmonicGainNode.gain.setValueAtTime(0, currentTime);
      harmonicGainNode.gain.linearRampToValueAtTime(0.15, currentTime + 0.02);
      harmonicGainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.2);
      
      // 高域の「キラ」音
      const sparkleOscillator = context.createOscillator();
      const sparkleGainNode = context.createGain();
      
      sparkleOscillator.type = 'sine';
      sparkleOscillator.frequency.setValueAtTime(800, currentTime); // 高めの音程
      
      sparkleGainNode.gain.setValueAtTime(0, currentTime);
      sparkleGainNode.gain.linearRampToValueAtTime(0.1, currentTime + 0.01);
      sparkleGainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.15);
      
      // 接続
      mainOscillator.connect(mainGainNode);
      harmonicOscillator.connect(harmonicGainNode);
      sparkleOscillator.connect(sparkleGainNode);
      
      mainGainNode.connect(context.destination);
      harmonicGainNode.connect(context.destination);
      sparkleGainNode.connect(context.destination);
      
      // 再生
      mainOscillator.start(currentTime);
      mainOscillator.stop(currentTime + 0.3);
      
      harmonicOscillator.start(currentTime);
      harmonicOscillator.stop(currentTime + 0.2);
      
      sparkleOscillator.start(currentTime);
      sparkleOscillator.stop(currentTime + 0.15);
      
    } catch (error) {
      console.warn('IDEタスク完了音の再生に失敗しました:', error);
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
 * IDEタスク完了時に効果音を再生する便利関数
 */
export function playIdeTaskCompletionSound(): void {
  IdeTaskCompletionSound.play();
}

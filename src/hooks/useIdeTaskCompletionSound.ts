import { useCallback, useEffect } from 'react';
import { IdeTaskCompletionSound } from '../utils/ideTaskCompletionSound';

/**
 * IDEタスク完了音を管理するフック
 */
export function useIdeTaskCompletionSound() {
  /**
   * タスク完了時に効果音を再生する関数
   */
  const playSound = useCallback(() => {
    IdeTaskCompletionSound.play();
  }, []);

  /**
   * 音を有効/無効にする関数
   */
  const setSoundEnabled = useCallback((enabled: boolean) => {
    IdeTaskCompletionSound.setEnabled(enabled);
  }, []);

  /**
   * 音が有効かどうかを確認する関数
   */
  const isSoundEnabled = useCallback(() => {
    return IdeTaskCompletionSound.isSoundEnabled();
  }, []);

  /**
   * コンポーネントのアンマウント時にクリーンアップ
   */
  useEffect(() => {
    return () => {
      IdeTaskCompletionSound.cleanup();
    };
  }, []);

  return {
    playSound,
    setSoundEnabled,
    isSoundEnabled,
  };
}

/**
 * タスク完了時に自動で効果音を再生するフック
 * @param shouldPlay 音を再生する条件
 */
export function useAutoIdeTaskCompletionSound(shouldPlay: boolean) {
  const { playSound } = useIdeTaskCompletionSound();

  useEffect(() => {
    if (shouldPlay) {
      // 少し遅延して再生することで、UIの更新が完了してから音が鳴るようにする
      const timer = setTimeout(() => {
        playSound();
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [shouldPlay, playSound]);
}

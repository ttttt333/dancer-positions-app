import { useCallback, useEffect } from 'react';
import { TaskCompletionSound } from '../utils/taskCompletionSound';

/**
 * タスク完了音を管理するフック
 */
export function useTaskCompletionSound() {
  /**
   * タスク完了時に音を再生する関数
   */
  const playSound = useCallback(() => {
    TaskCompletionSound.play();
  }, []);

  /**
   * 音を有効/無効にする関数
   */
  const setSoundEnabled = useCallback((enabled: boolean) => {
    TaskCompletionSound.setEnabled(enabled);
  }, []);

  /**
   * 音が有効かどうかを確認する関数
   */
  const isSoundEnabled = useCallback(() => {
    return TaskCompletionSound.isSoundEnabled();
  }, []);

  /**
   * コンポーネントのアンマウント時にクリーンアップ
   */
  useEffect(() => {
    return () => {
      TaskCompletionSound.cleanup();
    };
  }, []);

  return {
    playSound,
    setSoundEnabled,
    isSoundEnabled,
  };
}

/**
 * タスク完了時に自動で音を再生するフック
 * @param shouldPlay 音を再生する条件
 */
export function useAutoTaskCompletionSound(shouldPlay: boolean) {
  const { playSound } = useTaskCompletionSound();

  useEffect(() => {
    if (shouldPlay) {
      // 少し遅延して再生することで、UIの更新が完了してから音が鳴るようにする
      const timer = setTimeout(() => {
        playSound();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [shouldPlay, playSound]);
}

import { useCallback, useMemo } from "react";
import type { MutableRefObject } from "react";
import { usePlaybackUiStore } from "../../store/usePlaybackUiStore";
import { defaultAudioPlayer } from "../../lib/remoteAudio/audioPlayer";
import type { IAudioPlayer } from "../../lib/remoteAudio/audioPlayer";

/** Server / Supabase / Flow ローダーで共有するセッション状態 */
export function useRemoteAudioSession(
  _blobUrlRef: MutableRefObject<string | null>,
  _publicShareView: boolean
) {
  const clearPlaybackTrustedDurationSec = useCallback(
    () => usePlaybackUiStore.getState().setTrustedAudioDurationSec(null),
    []
  );
  const audioPlayer: IAudioPlayer = useMemo(() => defaultAudioPlayer, []);

  return { clearPlaybackTrustedDurationSec, audioPlayer };
}

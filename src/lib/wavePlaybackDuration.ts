import { playbackEngine } from "../core/playbackEngine";
import { waitForAudioElementReady } from "./audioElementReady";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

/**
 * 波形ピークのデコード尺をタイムライン・再生ヘッドの基準にする。
 * HTMLAudioElement の metadata 尺は MP3 等でずれることがあるため、表示は decode 尺で統一する。
 */
export async function alignPlaybackDurationWithWaveform(
  decodeDurationSec: number
): Promise<number> {
  if (!Number.isFinite(decodeDurationSec) || decodeDurationSec <= 0) {
    return usePlaybackUiStore.getState().durationSec;
  }

  await waitForAudioElementReady(playbackEngine.getMediaElement()).catch(() => {});

  const mediaDur = playbackEngine.getDuration();
  const store = usePlaybackUiStore.getState();
  store.setTrustedAudioDurationSec(decodeDurationSec);
  store.setDurationSec(decodeDurationSec);

  if (mediaDur > 0 && Math.abs(mediaDur - decodeDurationSec) > 0.25) {
    console.info(
      `[waveform] timeline uses decode ${decodeDurationSec.toFixed(2)}s (media metadata ${mediaDur.toFixed(2)}s)`
    );
  }

  return decodeDurationSec;
}

/** メタデータ同期時: 既に波形尺があればそれを優先する */
export function resolveTimelineDurationSec(fallbackSec: number): number {
  const ui = usePlaybackUiStore.getState();
  if (ui.trustedAudioDurationSec != null && ui.trustedAudioDurationSec > 0) {
    return ui.trustedAudioDurationSec;
  }
  return fallbackSec;
}

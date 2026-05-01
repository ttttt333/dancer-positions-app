import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { expandShortCuesAfterAudioLoad } from "../core/timelineController";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  setPeaks: Dispatch<SetStateAction<number[] | null>>;
};

/**
 * ArrayBuffer をデコードして波形ピークと再生 UI の長さを更新する。
 */
export function useTimelineWaveDecode({ setProject, setPeaks }: Params) {
  const setDuration = usePlaybackUiStore((s) => s.setDurationSec);

  const decodePeaksFromBuffer = useCallback(
    async (buf: ArrayBuffer) => {
      usePlaybackUiStore.getState().setTrustedAudioDurationSec(null);
      const ctx = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(buf.slice(0));
      /** `<audio>` の loadedmetadata より確実。立ち位置→後から音源のとき duration が 0 のままだと波形が一切描画されない */
      const durSec = audioBuf.duration;
      if (Number.isFinite(durSec) && durSec > 0) {
        usePlaybackUiStore.getState().setTrustedAudioDurationSec(durSec);
        setDuration(durSec);
        setProject((p) => expandShortCuesAfterAudioLoad(p, durSec));
      }
      const ch = audioBuf.getChannelData(0);
      const len = 400;
      const block = Math.floor(ch.length / len) || 1;
      const out: number[] = [];
      for (let i = 0; i < len; i++) {
        let s = 0;
        for (let j = 0; j < block; j++) {
          s += Math.abs(ch[i * block + j] ?? 0);
        }
        out.push(s / block);
      }
      const max = Math.max(...out, 1e-6);
      setPeaks(out.map((x) => x / max));
      await ctx.close();
    },
    [setDuration, setProject, setPeaks]
  );

  return { decodePeaksFromBuffer };
}

import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  expandShortCuesAfterAudioLoad,
  cueActiveAtTime,
  isPlaybackBeforeTrimStart,
  isPlaybackPastTrimEnd,
  PLAYBACK_HEAD_STORE_MIN_INTERVAL_MS,
  roundPlaybackHeadSec,
} from "../core/timelineController";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { useWavePeaksStore } from "../store/wavePeaksStore";
import { bindPlaybackOrientationResume } from "../lib/playbackOrientationResume";
import { reportWaveLoadError } from "../lib/waveLoadProgress";
import {
  hasViewerPendingPlay,
  hasViewerPlayIntent,
} from "../lib/playbackViewerIntent";
import {
  advanceViewerPlaybackHead,
  syncViewerDurationFromProject,
} from "../lib/viewerPlayback";
import type { ChoreographyProjectJson } from "../types/choreography";

type Params = {
  projectRef: MutableRefObject<ChoreographyProjectJson | null>;
  setProjectSafe: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  projectId: string | undefined;
  shareToken: string | undefined;
  choreoPublicView: boolean;
  wideEditorLayout: boolean;
  stageZenFullscreen: boolean;
  playbackRateSig: number | undefined;
  onPlaybackActiveCueChangeRef?: MutableRefObject<
    ((cueId: string) => void) | null
  >;
};

/**
 * 編集ルートの再生まわりをまとめる。
 * `<audio>` は playbackEngine シングルトンが document.body に 1 つだけ保持する。
 */
export function useEditorPlaybackSync(p: Params): {
  playbackAudioElement: ReactNode;
} {
  const {
    projectRef,
    setProjectSafe,
    projectId,
    shareToken,
    choreoPublicView,
    wideEditorLayout,
    stageZenFullscreen,
    playbackRateSig,
    onPlaybackActiveCueChangeRef,
  } = p;

  useEffect(() => {
    playbackEngine.ensureDomMediaElement();
  }, []);

  useEffect(() => {
    usePlaybackUiStore.getState().resetPlaybackUi();
    return subscribePlaybackEngineToPlaybackUiStore(
      setProjectSafe,
      choreoPublicView
    );
  }, [projectId, shareToken, choreoPublicView, setProjectSafe]);

  useEffect(() => bindPlaybackOrientationResume(), []);

  useEffect(() => playbackEngine.onLoadError(reportWaveLoadError), []);

  useEffect(() => {
    const cur = projectRef.current;
    if (!cur) return;
    const r = cur.playbackRate;
    if (typeof r === "number" && Number.isFinite(r)) {
      playbackEngine.setPlaybackRate(r);
    }
  }, [
    playbackRateSig,
    projectId,
    shareToken,
    choreoPublicView,
    wideEditorLayout,
    stageZenFullscreen,
    projectRef,
  ]);

  usePlaybackHeadRafSync(projectRef, choreoPublicView, onPlaybackActiveCueChangeRef);

  useEffect(() => {
    if (!choreoPublicView) return;
    syncViewerDurationFromProject(projectRef.current);
  }, [choreoPublicView, projectId, shareToken, projectRef]);

  return { playbackAudioElement: null };
}

/** `useEditorPlaybackSync` 内だけで使う。タイムライン列のマウント有無に依存しない RAF 同期 */
function usePlaybackHeadRafSync(
  projectRef: MutableRefObject<ChoreographyProjectJson | null>,
  choreoPublicView: boolean,
  onPlaybackActiveCueChangeRef?: MutableRefObject<
    ((cueId: string) => void) | null
  >
) {
  const isPlaying = usePlaybackUiStore((s) => s.isPlaying);
  const rafRef = useRef(0);
  const lastPlaybackStateEmitRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const lastFollowCueIdRef = useRef<string | null>(null);
  const lastViewerClockMsRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    const p = projectRef.current;
    const storePlaying = usePlaybackUiStore.getState().isPlaying;
    const enginePlaying = !playbackEngine.isPaused();
    const useViewerClock =
      choreoPublicView && storePlaying && !enginePlaying;

    if (p && (enginePlaying || useViewerClock)) {
      const trimStartSec = p.trimStartSec;
      const trimEndSec = p.trimEndSec;
      const { durationSec: duration, setCurrentTimeSec, setIsPlaying } =
        usePlaybackUiStore.getState();

      if (useViewerClock) {
        const now = performance.now();
        const prev = lastViewerClockMsRef.current ?? now;
        lastViewerClockMsRef.current = now;
        const dt = (now - prev) / 1000;
        if (dt > 0 && dt < 0.5) {
          advanceViewerPlaybackHead(p, dt);
        }
      } else {
        lastViewerClockMsRef.current = null;
        let t = playbackEngine.getCurrentTime();
        if (isPlaybackBeforeTrimStart(t, trimStartSec)) {
          playbackEngine.seek(trimStartSec);
          t = trimStartSec;
        }
        if (
          isPlaybackPastTrimEnd({
            t,
            trimEndSec,
            durationSec: duration,
            durationFallbackSec: duration,
          })
        ) {
          playbackEngine.pause();
          playbackEngine.seek(trimStartSec);
          setCurrentTimeSec(trimStartSec);
          setIsPlaying(false);
          return;
        }
        const rounded = roundPlaybackHeadSec(t);
        const now = performance.now();
        if (
          now - lastPlaybackStateEmitRef.current >=
          PLAYBACK_HEAD_STORE_MIN_INTERVAL_MS
        ) {
          lastPlaybackStateEmitRef.current = now;
          setCurrentTimeSec(rounded);
        }
      }

      const tHead = usePlaybackUiStore.getState().currentTimeSec;
      const onCueFollow = onPlaybackActiveCueChangeRef?.current;
      if (onCueFollow && p.cues.length > 0) {
        const active = cueActiveAtTime(p.cues, tHead);
        const nextId = active?.id ?? null;
        if (nextId && nextId !== lastFollowCueIdRef.current) {
          lastFollowCueIdRef.current = nextId;
          onCueFollow(nextId);
        }
      }
    } else {
      lastViewerClockMsRef.current = null;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [projectRef, choreoPublicView, onPlaybackActiveCueChangeRef]);

  useEffect(() => {
    if (isPlaying) {
      lastPlaybackStateEmitRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      lastFollowCueIdRef.current = null;
      lastViewerClockMsRef.current = null;
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tick]);

  useEffect(() => {
    if (isPlaying) {
      wasPlayingRef.current = true;
      return;
    }
    if (!wasPlayingRef.current) return;
    wasPlayingRef.current = false;
    if (
      !playbackEngine.getMediaSourceUrl() ||
      !Number.isFinite(playbackEngine.getCurrentTime())
    ) {
      return;
    }
    usePlaybackUiStore
      .getState()
      .setCurrentTimeSec(
        roundPlaybackHeadSec(playbackEngine.getCurrentTime()),
      );
  }, [isPlaying]);
}

function subscribePlaybackEnginePlayingToStore(
  choreoPublicView: boolean
): () => void {
  const unsub = playbackEngine.onPlayingChange((playing) => {
    if (
      choreoPublicView &&
      !playing &&
      (hasViewerPlayIntent() || hasViewerPendingPlay())
    ) {
      return;
    }
    usePlaybackUiStore.getState().setIsPlaying(playing);
  });
  usePlaybackUiStore.getState().setIsPlaying(!playbackEngine.isPaused());
  return unsub;
}

function subscribePlaybackEngineMetaToProject(
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>,
): () => void {
  const syncDurationFromEngine = () => {
    const dur = playbackEngine.getDuration();
    if (!Number.isFinite(dur) || dur <= 0) return;
    const ui = usePlaybackUiStore.getState();
    if (ui.trustedAudioDurationSec != null) {
      return;
    }
    const peaksDur = useWavePeaksStore.getState().peaksDurationSec;
    if (peaksDur != null && peaksDur > 0) {
      ui.setTrustedAudioDurationSec(peaksDur);
      ui.setDurationSec(peaksDur);
      setProject((p) => expandShortCuesAfterAudioLoad(p, peaksDur));
      return;
    }
    ui.setDurationSec(dur);
    setProject((p) => expandShortCuesAfterAudioLoad(p, dur));
  };
  const unsubMeta = playbackEngine.onMetaChange(syncDurationFromEngine);
  syncDurationFromEngine();
  return unsubMeta;
}

function subscribePlaybackEngineToPlaybackUiStore(
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>,
  choreoPublicView: boolean
): () => void {
  const unsubPlay = subscribePlaybackEnginePlayingToStore(choreoPublicView);
  const unsubMeta = subscribePlaybackEngineMetaToProject(setProject);
  return () => {
    unsubPlay();
    unsubMeta();
  };
}

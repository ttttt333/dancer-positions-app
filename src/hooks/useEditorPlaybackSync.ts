import { createElement, useCallback, useEffect, useMemo, useRef } from "react";
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
  /** 依存用。実値は `projectRef` から読む */
  playbackRateSig: number | undefined;
  /** 再生中にアクティブキューが変わったとき（選択枠追従） */
  onPlaybackActiveCueChangeRef?: MutableRefObject<
    ((cueId: string) => void) | null
  >;
};

/**
 * 編集ルートの再生まわりをまとめる:
 * 非表示 `<audio>`、ルート切替時のストア初期化、エンジン購読（再生フラグ・メタ尺）、倍速、再生ヘッド RAF。
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

  const bindPlaybackAudioElementRef = useCallback(
    (node: HTMLAudioElement | null) => {
      playbackEngine.attachMediaElement(node);
    },
    []
  );

  const playbackAudioElement = useMemo(
    () =>
      createElement("audio", {
        ref: bindPlaybackAudioElementRef,
        style: { display: "none" },
        controls: false,
        crossOrigin: "anonymous",
        preload: "auto",
        playsInline: true,
        "aria-hidden": true,
      }),
    [bindPlaybackAudioElementRef]
  );

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

  return { playbackAudioElement };
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

/** `<audio>` の play/pause とストアの `isPlaying` を同期（単一購読） */
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

/**
 * `loadedmetadata` / durationchange からストアの尺とプロジェクトのキュー伸長を同期。
 * `trustedAudioDurationSec` は Timeline のデコード経路が設定する。
 */
function subscribePlaybackEngineMetaToProject(
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>,
): () => void {
  const syncDurationFromEngine = () => {
    const dur = playbackEngine.getDuration();
    if (!Number.isFinite(dur) || dur <= 0) return;
    const trusted = usePlaybackUiStore.getState().trustedAudioDurationSec;
    if (trusted != null && Math.abs(dur - trusted) < 0.25) {
      return;
    }
    usePlaybackUiStore.getState().setDurationSec(dur);
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

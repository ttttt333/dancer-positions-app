import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../core/playbackEngine", () => ({
  playbackEngine: {
    getMediaSourceUrl: vi.fn(() => null),
    isPaused: vi.fn(() => true),
    seek: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
  },
}));

vi.mock("./playbackCountIn", () => ({
  cancelPlaybackCountIn: vi.fn(),
  isPlaybackCountInActive: vi.fn(() => false),
}));

vi.mock("../store/practicePlaybackStore", () => ({
  usePracticePlaybackStore: {
    getState: () => ({
      isCountingIn: false,
      setIsCountingIn: vi.fn(),
    }),
  },
}));

vi.mock("../store/usePlaybackUiStore", () => {
  let isPlaying = false;
  let currentTimeSec = 0;
  return {
    usePlaybackUiStore: {
      getState: () => ({
        isPlaying,
        currentTimeSec,
        setIsPlaying: (v: boolean) => {
          isPlaying = v;
        },
        setCurrentTimeSec: (t: number) => {
          currentTimeSec = t;
        },
        __setPlaying: (v: boolean) => {
          isPlaying = v;
        },
        __getPlaying: () => isPlaying,
        __getCurrentTimeSec: () => currentTimeSec,
      }),
    },
  };
});

import { playbackEngine } from "../core/playbackEngine";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import {
  isLivePlaybackActive,
  notifyFormationChosenWhenStopped,
  stopOrRewindPlayback,
  syncPlaybackHeadAfterCueEditWhenStopped,
} from "./playbackTransport";

describe("playback continuity during cue edits", () => {
  beforeEach(() => {
    (usePlaybackUiStore.getState() as { __setPlaying: (v: boolean) => void }).__setPlaying(
      false
    );
    vi.mocked(playbackEngine.getMediaSourceUrl).mockReturnValue(null);
    vi.mocked(playbackEngine.isPaused).mockReturnValue(true);
    vi.mocked(playbackEngine.seek).mockClear();
  });

  it("isLivePlaybackActive follows UI isPlaying", () => {
    expect(isLivePlaybackActive()).toBe(false);
    (usePlaybackUiStore.getState() as { __setPlaying: (v: boolean) => void }).__setPlaying(
      true
    );
    expect(isLivePlaybackActive()).toBe(true);
  });

  it("skips head sync and formation notify while playing", () => {
    (usePlaybackUiStore.getState() as { __setPlaying: (v: boolean) => void }).__setPlaying(
      true
    );
    vi.mocked(playbackEngine.getMediaSourceUrl).mockReturnValue("blob:x");
    vi.mocked(playbackEngine.isPaused).mockReturnValue(false);

    const onChosen = vi.fn();
    syncPlaybackHeadAfterCueEditWhenStopped({
      t: 12,
      durationSec: 60,
      trimStartSec: 0,
      trimEndSec: null,
    });
    notifyFormationChosenWhenStopped(onChosen);

    expect(playbackEngine.seek).not.toHaveBeenCalled();
    expect(onChosen).not.toHaveBeenCalled();
  });

  it("seeks and notifies when stopped", () => {
    vi.mocked(playbackEngine.getMediaSourceUrl).mockReturnValue("blob:x");
    vi.mocked(playbackEngine.isPaused).mockReturnValue(true);
    const onChosen = vi.fn();

    syncPlaybackHeadAfterCueEditWhenStopped({
      t: 5,
      durationSec: 60,
      trimStartSec: 0,
      trimEndSec: null,
    });
    notifyFormationChosenWhenStopped(onChosen);

    expect(playbackEngine.seek).toHaveBeenCalled();
    expect(onChosen).toHaveBeenCalledTimes(1);
  });

  it("stopOrRewindPlayback pauses in place while playing", () => {
    (usePlaybackUiStore.getState() as { __setPlaying: (v: boolean) => void }).__setPlaying(
      true
    );
    vi.mocked(playbackEngine.getMediaSourceUrl).mockReturnValue("blob:x");
    vi.mocked(playbackEngine.isPaused).mockReturnValue(false);
    vi.mocked(playbackEngine.getCurrentTime).mockReturnValue(12.5);
    vi.mocked(playbackEngine.pause).mockClear();
    vi.mocked(playbackEngine.seek).mockClear();

    stopOrRewindPlayback(0);

    expect(playbackEngine.pause).toHaveBeenCalledTimes(1);
    expect(playbackEngine.seek).not.toHaveBeenCalled();
    expect(
      (usePlaybackUiStore.getState() as { __getPlaying: () => boolean }).__getPlaying()
    ).toBe(false);
    expect(
      (
        usePlaybackUiStore.getState() as { __getCurrentTimeSec: () => number }
      ).__getCurrentTimeSec()
    ).toBe(12.5);
  });

  it("stopOrRewindPlayback seeks to trim start when already stopped", () => {
    (usePlaybackUiStore.getState() as { __setPlaying: (v: boolean) => void }).__setPlaying(
      false
    );
    vi.mocked(playbackEngine.getMediaSourceUrl).mockReturnValue("blob:x");
    vi.mocked(playbackEngine.isPaused).mockReturnValue(true);
    vi.mocked(playbackEngine.pause).mockClear();
    vi.mocked(playbackEngine.seek).mockClear();

    stopOrRewindPlayback(1.5);

    expect(playbackEngine.seek).toHaveBeenCalledWith(1.5);
    expect(
      (
        usePlaybackUiStore.getState() as { __getCurrentTimeSec: () => number }
      ).__getCurrentTimeSec()
    ).toBe(1.5);
  });
});

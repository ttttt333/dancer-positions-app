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
});

import { create } from "zustand";
import type { MusicSectionOverlaySegment } from "../lib/musicSectionOverlay";

type MusicSectionOverlayState = {
  segments: MusicSectionOverlaySegment[];
  durationSec: number;
  sourceLabel: string | null;
  setSegments: (
    segments: MusicSectionOverlaySegment[],
    durationSec: number,
    sourceLabel?: string | null
  ) => void;
  clear: () => void;
};

export const useMusicSectionOverlayStore = create<MusicSectionOverlayState>(
  (set) => ({
    segments: [],
    durationSec: 0,
    sourceLabel: null,
    setSegments: (segments, durationSec, sourceLabel = null) =>
      set({ segments, durationSec, sourceLabel }),
    clear: () => set({ segments: [], durationSec: 0, sourceLabel: null }),
  })
);

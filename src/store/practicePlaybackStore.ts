import { create } from "zustand";

export const PRACTICE_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type PracticePlaybackRate = (typeof PRACTICE_PLAYBACK_RATES)[number];

const COUNT_IN_KEY = "choreocore.practice.countInEnabled";

type PracticePlaybackState = {
  countInEnabled: boolean;
  /** カウントイン再生中（音源はまだ再生していない） */
  isCountingIn: boolean;
  setCountInEnabled: (v: boolean) => void;
  setIsCountingIn: (v: boolean) => void;
};

export const usePracticePlaybackStore = create<PracticePlaybackState>((set) => ({
  countInEnabled: false,
  isCountingIn: false,
  setCountInEnabled: (_v) => {
    try {
      localStorage.setItem(COUNT_IN_KEY, "0");
    } catch {
      /* ignore */
    }
    // 4カウント（ピッピッ）ビープは廃止
    set({ countInEnabled: false });
  },
  setIsCountingIn: (v) => set({ isCountingIn: Boolean(v) }),
}));

export function normalizePracticePlaybackRate(rate: number): PracticePlaybackRate {
  const allowed = PRACTICE_PLAYBACK_RATES;
  let best: PracticePlaybackRate = 1;
  let bestD = Infinity;
  for (const r of allowed) {
    const d = Math.abs(r - rate);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

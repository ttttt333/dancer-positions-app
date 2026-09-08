import { create } from "zustand";

export const PRACTICE_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25] as const;
export type PracticePlaybackRate = (typeof PRACTICE_PLAYBACK_RATES)[number];

const COUNT_IN_KEY = "choreocore.practice.countInEnabled";

function readCountInEnabled(): boolean {
  try {
    const v = localStorage.getItem(COUNT_IN_KEY);
    if (v == null) return true; // ダンサー向け既定 ON
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

type PracticePlaybackState = {
  countInEnabled: boolean;
  /** カウントイン再生中（音源はまだ再生していない） */
  isCountingIn: boolean;
  setCountInEnabled: (v: boolean) => void;
  setIsCountingIn: (v: boolean) => void;
};

export const usePracticePlaybackStore = create<PracticePlaybackState>((set) => ({
  countInEnabled: typeof window !== "undefined" ? readCountInEnabled() : true,
  isCountingIn: false,
  setCountInEnabled: (v) => {
    try {
      localStorage.setItem(COUNT_IN_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ countInEnabled: Boolean(v) });
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

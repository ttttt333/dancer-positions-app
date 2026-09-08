import { create } from "zustand";
import type { MusicSectionOverlaySegment } from "../lib/musicSectionOverlay";
import type { AudioAnalysisResult, BeatInfo } from "../types/audioAnalysis";
import { snapToNearestBeat } from "../lib/audioAnalysis/snapToDownbeat";

type MusicSectionOverlayState = {
  segments: MusicSectionOverlaySegment[];
  durationSec: number;
  sourceLabel: string | null;
  /** 最新の解析結果（ドラッグ微調整のソース） */
  analysis: AudioAnalysisResult | null;
  /** マグネット用ビート */
  beats: BeatInfo[];
  analyzing: boolean;
  analyzeStatus: string | null;
  /** 境界ドラッグ等でユーザーが触ったか（自動解析の上書き防止） */
  userEdited: boolean;
  setSegments: (
    segments: MusicSectionOverlaySegment[],
    durationSec: number,
    sourceLabel?: string | null
  ) => void;
  setFromAnalysis: (
    analysis: AudioAnalysisResult,
    segments: MusicSectionOverlaySegment[],
    opts?: { force?: boolean }
  ) => void;
  setAnalyzing: (analyzing: boolean, status?: string | null) => void;
  /** 境界ドラッグ: edge を rawTime へ。ビートへマグネット吸着 */
  updateBoundary: (
    index: number,
    edge: "start" | "end",
    rawTime: number
  ) => void;
  clear: () => void;
};

function segmentsToAnalysisSections(
  segments: MusicSectionOverlaySegment[],
  prev: AudioAnalysisResult | null
): AudioAnalysisResult["sections"] {
  return segments.map((seg, i) => {
    const prevSec = prev?.sections[i];
    return {
      id: prevSec?.id ?? `seg-${i}-${seg.startSec}`,
      type: prevSec?.type ?? "unknown",
      label: seg.label,
      startTime: seg.startSec,
      endTime: seg.endSec,
      color: seg.color,
      bpm: prevSec?.bpm,
    };
  });
}

export const useMusicSectionOverlayStore = create<MusicSectionOverlayState>(
  (set, get) => ({
    segments: [],
    durationSec: 0,
    sourceLabel: null,
    analysis: null,
    beats: [],
    analyzing: false,
    analyzeStatus: null,
    userEdited: false,
    setSegments: (segments, durationSec, sourceLabel = null) =>
      set({
        segments,
        durationSec,
        sourceLabel,
        analysis: null,
        beats: [],
        userEdited: false,
      }),
    setFromAnalysis: (analysis, segments, opts) => {
      if (get().userEdited && !opts?.force) {
        set({ analyzing: false, analyzeStatus: null });
        return;
      }
      set({
        analysis,
        segments,
        durationSec: analysis.duration,
        sourceLabel: analysis.sourceLabel ?? null,
        beats: analysis.beats,
        analyzing: false,
        analyzeStatus: null,
        userEdited: false,
      });
    },
    setAnalyzing: (analyzing, status = null) =>
      set({ analyzing, analyzeStatus: status }),
    updateBoundary: (index, edge, rawTime) => {
      const state = get();
      const seg = state.segments[index];
      if (!seg) return;
      const snapped =
        state.beats.length > 0
          ? snapToNearestBeat(rawTime, state.beats)
          : rawTime;
      const clamped = Math.max(
        0,
        Math.min(state.durationSec || snapped, snapped)
      );
      const next = state.segments.map((s, i) => {
        if (i !== index) return s;
        if (edge === "start") {
          const startSec = Math.min(clamped, s.endSec - 0.05);
          return { ...s, startSec: Math.max(0, startSec) };
        }
        const endSec = Math.max(clamped, s.startSec + 0.05);
        const maxEnd = state.durationSec > 0 ? state.durationSec : endSec;
        return { ...s, endSec: Math.min(maxEnd, endSec) };
      });

      if (edge === "start" && index > 0) {
        const prev = next[index - 1]!;
        const cur = next[index]!;
        if (prev.endSec > cur.startSec) {
          next[index - 1] = { ...prev, endSec: cur.startSec };
        }
      }
      if (edge === "end" && index < next.length - 1) {
        const cur = next[index]!;
        const nxt = next[index + 1]!;
        if (nxt.startSec < cur.endSec) {
          next[index + 1] = { ...nxt, startSec: cur.endSec };
        }
      }

      const analysis = state.analysis
        ? {
            ...state.analysis,
            sections: segmentsToAnalysisSections(next, state.analysis),
          }
        : null;
      set({ segments: next, analysis, userEdited: true });
    },
    clear: () =>
      set({
        segments: [],
        durationSec: 0,
        sourceLabel: null,
        analysis: null,
        beats: [],
        analyzing: false,
        analyzeStatus: null,
        userEdited: false,
      }),
  })
);

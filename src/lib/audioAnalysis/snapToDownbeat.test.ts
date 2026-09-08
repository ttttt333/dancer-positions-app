import { describe, expect, it } from "vitest";
import type { BeatInfo, MusicSection } from "../../types/audioAnalysis";
import {
  applyDownbeatSnapToAnalysis,
  snapSectionsToDownbeats,
  snapToNearestBeat,
  snapToNearestDownbeat,
} from "./snapToDownbeat";

const beats: BeatInfo[] = [
  { timestamp: 0, isDownbeat: true, beatNumber: 1 },
  { timestamp: 0.5, isDownbeat: false, beatNumber: 2 },
  { timestamp: 1.0, isDownbeat: false, beatNumber: 3 },
  { timestamp: 1.5, isDownbeat: false, beatNumber: 4 },
  { timestamp: 2.0, isDownbeat: true, beatNumber: 1 },
  { timestamp: 2.5, isDownbeat: false, beatNumber: 2 },
  { timestamp: 4.0, isDownbeat: true, beatNumber: 1 },
];

describe("snapToNearestDownbeat", () => {
  it("snaps to the closest downbeat", () => {
    expect(snapToNearestDownbeat(0.1, beats)).toBe(0);
    expect(snapToNearestDownbeat(1.1, beats)).toBe(2.0);
    expect(snapToNearestDownbeat(1.9, beats)).toBe(2.0);
    expect(snapToNearestDownbeat(3.1, beats)).toBe(4.0);
  });

  it("returns raw when no downbeats exist", () => {
    const none: BeatInfo[] = [
      { timestamp: 1, isDownbeat: false, beatNumber: 2 },
    ];
    expect(snapToNearestDownbeat(1.2, none)).toBe(1.2);
    expect(snapToNearestDownbeat(1.2, [])).toBe(1.2);
  });
});

describe("snapToNearestBeat", () => {
  it("snaps to any nearest beat timestamp", () => {
    expect(snapToNearestBeat(0.6, beats)).toBe(0.5);
    expect(snapToNearestBeat(1.4, beats)).toBe(1.5);
  });
});

describe("snapSectionsToDownbeats", () => {
  it("aligns section boundaries to downbeats", () => {
    const sections: MusicSection[] = [
      {
        id: "a",
        type: "verse",
        label: "Aメロ",
        startTime: 0.12,
        endTime: 1.88,
        color: "#3B82F6",
      },
      {
        id: "b",
        type: "chorus",
        label: "サビ",
        startTime: 2.1,
        endTime: 3.9,
        color: "#EF4444",
      },
    ];
    const snapped = snapSectionsToDownbeats(sections, beats, 8);
    expect(snapped[0]!.startTime).toBe(0);
    expect(snapped[0]!.endTime).toBe(2);
    expect(snapped[1]!.startTime).toBe(2);
    expect(snapped[1]!.endTime).toBe(4);
  });

  it("applyDownbeatSnapToAnalysis preserves beats and duration", () => {
    const result = applyDownbeatSnapToAnalysis({
      duration: 8,
      beats,
      sections: [
        {
          id: "x",
          type: "intro",
          label: "イントロ",
          startTime: 0.3,
          endTime: 1.7,
          color: "#6B7280",
        },
      ],
    });
    expect(result.duration).toBe(8);
    expect(result.beats).toBe(beats);
    expect(result.sections[0]!.startTime).toBe(0);
    expect(result.sections[0]!.endTime).toBe(2);
  });
});

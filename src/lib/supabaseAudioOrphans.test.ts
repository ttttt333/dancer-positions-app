import { describe, expect, it } from "vitest";
import {
  collectReferencedAudioPaths,
  keepPathsForReferencedAudio,
  selectOrphanAudioObjects,
} from "./supabaseAudioOrphans";

describe("collectReferencedAudioPaths", () => {
  it("reads audioSupabasePath from projects and nested flow mementos", () => {
    const paths = collectReferencedAudioPaths([
      { audioSupabasePath: " uid/1/live.mp3 " },
      { audioSupabasePath: "" },
      { audioSupabasePath: null },
      {
        memento: { audioSupabasePath: "uid/2/flow.mp3" },
        cues: [{ audioSupabasePath: "uid/3/cue.mp3" }],
      },
    ]);
    expect([...paths].sort()).toEqual([
      "uid/1/live.mp3",
      "uid/2/flow.mp3",
      "uid/3/cue.mp3",
    ]);
  });
});

describe("selectOrphanAudioObjects", () => {
  it("drops unreferenced files and keeps the live file plus its waveform sidecar", () => {
    const keep = keepPathsForReferencedAudio(["uid/1/live.mp3"]);
    const orphans = selectOrphanAudioObjects(
      [
        { path: "uid/1/old.mp3", bytes: 5_000_000 },
        { path: "uid/1/old.mp3.wavepeaks.json", bytes: 20_000 },
        { path: "uid/1/live.mp3", bytes: 3_000_000 },
        { path: "uid/1/live.mp3.wavepeaks.json", bytes: 12_000 },
        { path: "  ", bytes: 10 },
      ],
      keep
    );
    expect(orphans).toEqual([
      { path: "uid/1/old.mp3", bytes: 5_000_000 },
      { path: "uid/1/old.mp3.wavepeaks.json", bytes: 20_000 },
    ]);
  });
});

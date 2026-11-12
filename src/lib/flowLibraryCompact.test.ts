import { describe, expect, it } from "vitest";
import type { Formation } from "../types/choreography";
import {
  FLOW_LIBRARY_STORED_PEAKS_MAX,
  compactFlowLibraryItemForPersist,
  downsamplePeaksForStorage,
  rawFlowItemHasStorageWaste,
} from "./flowLibraryCompact";
import type { FlowLibraryItem } from "./flowLibrary";

function fullFormation(): Formation {
  return {
    id: "fm1",
    name: "A",
    dancers: [
      {
        id: "d1",
        label: "みわ",
        xPct: 12.345678,
        yPct: 40.987654,
        colorIndex: 3,
        crewMemberId: "crew-1",
      },
      {
        id: "d2",
        label: "えま",
        xPct: 70.2,
        yPct: 10.1,
        colorIndex: 5,
        crewMemberId: "crew-2",
      },
    ],
  };
}

function bundledItem(): FlowLibraryItem {
  const formation = fullFormation();
  return {
    id: "flow-20th",
    name: "20th 木6 LOCK",
    hasTiming: true,
    dancerCount: 2,
    cueCount: 1,
    formations: [
      {
        id: "fm1",
        name: "A",
        dancers: [
          { label: "みわ", xPct: 12.345678, yPct: 40.987654, colorIndex: 3 },
          { label: "えま", xPct: 70.2, yPct: 10.1, colorIndex: 5 },
        ],
      },
    ],
    cues: [
      {
        id: "c1",
        tStartSec: 0,
        tEndSec: 8,
        formationIdRef: "fm1",
      },
    ],
    createdAt: 1,
    updatedAt: 2,
    bundleVersion: 2,
    formationsFull: [formation],
    cuesFull: [
      {
        id: "c1",
        formationId: "fm1",
        tStartSec: 0,
        tEndSec: 8,
      },
    ],
    memento: {
      crews: [],
      savedSpotLayouts: [],
      pieceDancerCount: 2,
      audioAssetId: null,
      playbackRate: 1,
      trimStartSec: 0,
      trimEndSec: null,
      wavePeaks: Array.from({ length: 20000 }, (_, i) => (i === 100 ? 1 : (i % 10) / 10)),
      flowEmbeddedAudioBase64: "AAAA",
      flowEmbeddedAudioMimeType: "audio/mpeg",
      flowEmbeddedAudioKey: "audio-keep",
    },
  };
}

describe("flow library compaction", () => {
  it("drops duplicate snapshots and long peaks without dropping dancer ids", () => {
    const stored = compactFlowLibraryItemForPersist(bundledItem());
    expect(stored.id).toBe("flow-20th");
    expect(stored.name).toBe("20th 木6 LOCK");
    expect(stored.formations).toEqual([]);
    expect(stored.cues).toEqual([]);
    expect(stored.formationsFull?.[0]?.dancers.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(stored.formationsFull?.[0]?.dancers.map((d) => d.colorIndex)).toEqual([3, 5]);
    expect(stored.formationsFull?.[0]?.dancers.map((d) => d.crewMemberId)).toEqual([
      "crew-1",
      "crew-2",
    ]);
    expect(stored.formationsFull?.[0]?.dancers[0]).toMatchObject({
      label: "みわ",
      xPct: 12.346,
      yPct: 40.988,
    });
    expect(stored.memento?.flowEmbeddedAudioKey).toBe("audio-keep");
    expect(stored.memento?.flowEmbeddedAudioBase64).toBeUndefined();
    expect(stored.memento?.wavePeaks?.length).toBe(FLOW_LIBRARY_STORED_PEAKS_MAX);
    expect(Math.max(...(stored.memento?.wavePeaks ?? []))).toBe(1);
  });

  it("keeps the light snapshot when the item has no full bundle", () => {
    const legacy = bundledItem();
    delete legacy.formationsFull;
    delete legacy.cuesFull;
    delete legacy.bundleVersion;
    const stored = compactFlowLibraryItemForPersist(legacy);
    expect(stored.formations).toHaveLength(1);
    expect(stored.formations[0]?.dancers.map((d) => d.label)).toEqual(["みわ", "えま"]);
    expect(stored.name).toBe("20th 木6 LOCK");
  });

  it("flags stored duplicates and oversized peaks as waste", () => {
    const item = bundledItem();
    expect(rawFlowItemHasStorageWaste(item)).toBe(true);
    const stored = compactFlowLibraryItemForPersist(item);
    expect(rawFlowItemHasStorageWaste(stored)).toBe(false);
  });

  it("downsamples by envelope instead of truncating the tail", () => {
    const peaks = new Array(8000).fill(0);
    peaks[7900] = 0.8;
    const out = downsamplePeaksForStorage(peaks);
    expect(out?.length).toBe(FLOW_LIBRARY_STORED_PEAKS_MAX);
    expect(Math.max(...(out ?? []))).toBe(0.8);
  });
});

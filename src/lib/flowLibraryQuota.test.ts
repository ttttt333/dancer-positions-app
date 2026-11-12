import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChoreographyProjectJson } from "../types/choreography";
import { createEmptyProject } from "./projectDefaults";
import {
  FLOW_LIBRARY_STORAGE_KEY,
  listFlowLibraryItems,
  resetFlowLibraryPersistForTests,
  saveFlowFromProjectAsync,
  setFlowLibraryCatalogWriterForTests,
  type FlowLibraryItem,
} from "./flowLibrary";

function quotaError(): Error {
  const err = new Error("The quota has been exceeded.");
  err.name = "QuotaExceededError";
  return err;
}

function projectWithOneCue(): ChoreographyProjectJson {
  const p = createEmptyProject();
  const fid = p.formations[0]!.id;
  p.pieceTitle = "20th 木6 LOCK";
  p.formations[0] = {
    ...p.formations[0]!,
    dancers: [
      { id: "d1", label: "みわ", xPct: 20, yPct: 30, colorIndex: 2 },
      { id: "d2", label: "えま", xPct: 40, yPct: 50, colorIndex: 4 },
    ],
  };
  p.cues = [
    {
      id: "c1",
      formationId: fid,
      tStartSec: 0,
      tEndSec: 8,
    },
  ];
  return p;
}

beforeEach(() => {
  resetFlowLibraryPersistForTests();
  localStorage.removeItem(FLOW_LIBRARY_STORAGE_KEY);
});

describe("flow library quota", () => {
  it("retries after QuotaExceeded and keeps the named flow with dancer ids", async () => {
    const written: unknown[][] = [];
    let calls = 0;
    setFlowLibraryCatalogWriterForTests(async (items) => {
      calls += 1;
      written.push(items);
      if (calls === 1) throw quotaError();
    });

    const peaks = Array.from({ length: 12000 }, (_, i) => (i === 50 ? 1 : 0.2));
    const saved = await saveFlowFromProjectAsync("20th 木6 LOCK", projectWithOneCue(), {
      includeTiming: true,
      wavePeaks: peaks,
    });

    expect(saved.ok).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(2);
    const last = written.at(-1) as FlowLibraryItem[];
    expect(last).toHaveLength(1);
    expect(last[0]?.name).toBe("20th 木6 LOCK");
    expect(last[0]?.formations).toEqual([]);
    expect(last[0]?.formationsFull?.[0]?.dancers.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(last[0]?.formationsFull?.[0]?.dancers.map((d) => d.colorIndex)).toEqual([2, 4]);
    expect(last[0]?.memento?.wavePeaks?.length).toBeLessThanOrEqual(4096);

    const listed = listFlowLibraryItems();
    expect(listed.map((item) => item.name)).toContain("20th 木6 LOCK");
    expect(listed[0]?.formations[0]?.dancers.map((d) => d.label)).toEqual(["みわ", "えま"]);
  });

  it("treats a localStorage fallback as saved when IndexedDB stays over quota", async () => {
    setFlowLibraryCatalogWriterForTests(async () => {
      throw quotaError();
    });
    const saved = await saveFlowFromProjectAsync("20th FINALE", projectWithOneCue(), {
      includeTiming: true,
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.item.name).toBe("20th FINALE");
    const raw = localStorage.getItem(FLOW_LIBRARY_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "[]") as { name: string }[];
    expect(parsed.map((item) => item.name)).toContain("20th FINALE");
    expect(listFlowLibraryItems().map((item) => item.name)).toContain("20th FINALE");
  });

  it("reports quota when IndexedDB and localStorage both reject the write", async () => {
    setFlowLibraryCatalogWriterForTests(async () => {
      throw quotaError();
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw quotaError();
    });
    const saved = await saveFlowFromProjectAsync("20th 木8", projectWithOneCue(), {
      includeTiming: true,
    });
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.reason).toBe("quota");
    expect(listFlowLibraryItems().map((item) => item.name)).not.toContain("20th 木8");
  });
});

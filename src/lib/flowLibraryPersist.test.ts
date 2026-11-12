import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { clearFlowLibraryCatalogRaw, readFlowLibraryCatalogRaw } from "./flowLibraryCatalog";
import {
  FLOW_LIBRARY_STORAGE_KEY,
  ensureFlowLibraryReady,
  listFlowLibraryItems,
  resetFlowLibraryPersistForTests,
  saveFlowFromProjectAsync,
} from "./flowLibrary";
import type { ChoreographyProjectJson } from "../types/choreography";
import { FLOW_LIBRARY_STORED_PEAKS_MAX } from "./flowLibraryCompact";

function projectWithOneCue(): ChoreographyProjectJson {
  const p = createEmptyProject();
  const fid = p.formations[0]!.id;
  p.pieceTitle = "保存領域テスト";
  p.formations[0] = {
    ...p.formations[0]!,
    dancers: [
      { id: "d1", label: "A", xPct: 20, yPct: 30, colorIndex: 0 },
      { id: "d2", label: "B", xPct: 40, yPct: 50, colorIndex: 1 },
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

beforeEach(async () => {
  resetFlowLibraryPersistForTests();
  localStorage.removeItem(FLOW_LIBRARY_STORAGE_KEY);
  await clearFlowLibraryCatalogRaw();
});

describe("flow library persist", () => {
  it("migrates the old localStorage catalog and then accepts a new save", async () => {
    const legacy = [
      {
        id: "legacy-1",
        name: "金lock 鎌信公祭",
        hasTiming: true,
        dancerCount: 2,
        cueCount: 1,
        formations: [
          {
            id: "fm1",
            name: "A",
            dancers: [
              { label: "1", xPct: 20, yPct: 30 },
              { label: "2", xPct: 40, yPct: 50 },
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
      },
    ];
    localStorage.setItem(FLOW_LIBRARY_STORAGE_KEY, JSON.stringify(legacy));

    await ensureFlowLibraryReady();
    expect(listFlowLibraryItems().map((x) => x.id)).toContain("legacy-1");

    const saved = await saveFlowFromProjectAsync(
      "AI提案テスト",
      projectWithOneCue(),
      { includeTiming: true }
    );
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.item.name).toBe("AI提案テスト");
    }
    expect(listFlowLibraryItems().length).toBe(2);
  });

  it("compacts peaks on save and still lists the named flow after reload", async () => {
    const peaks = Array.from({ length: 20000 }, (_, i) => (i === 100 ? 1 : (i % 10) / 10));
    const saved = await saveFlowFromProjectAsync("20th 木6 LOCK", projectWithOneCue(), {
      includeTiming: true,
      wavePeaks: peaks,
    });
    expect(saved.ok).toBe(true);

    resetFlowLibraryPersistForTests();
    await ensureFlowLibraryReady();

    const listed = listFlowLibraryItems().find((item) => item.name === "20th 木6 LOCK");
    expect(listed?.formations[0]?.dancers.map((d) => d.label)).toEqual(["A", "B"]);
    expect(listed?.formationsFull?.[0]?.dancers.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(listed?.formationsFull?.[0]?.dancers.map((d) => d.colorIndex)).toEqual([0, 1]);
    expect((listed?.memento?.wavePeaks?.length ?? 0) <= FLOW_LIBRARY_STORED_PEAKS_MAX).toBe(true);

    const stored = await readStoredNamedFlow("20th 木6 LOCK");
    expect(stored).toBeTruthy();
    expect(stored?.formations).toEqual([]);
    const storedPeaks = (stored?.memento as { wavePeaks?: number[] } | undefined)?.wavePeaks;
    expect(storedPeaks?.length).toBeLessThanOrEqual(FLOW_LIBRARY_STORED_PEAKS_MAX);
    const full = stored?.formationsFull as { dancers: { id: string }[] }[] | undefined;
    expect(full?.[0]?.dancers.map((d) => d.id)).toEqual(["d1", "d2"]);
  });
});

async function readStoredNamedFlow(name: string): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = await readFlowLibraryCatalogRaw();
    const hit = (raw ?? []).find(
      (item) => item != null && typeof item === "object" && (item as { name?: string }).name === name
    );
    if (hit && typeof hit === "object") return hit as Record<string, unknown>;
  } catch {
    /** IndexedDB が使えない環境では localStorage の圧縮形を見る */
  }
  const ls = localStorage.getItem(FLOW_LIBRARY_STORAGE_KEY);
  if (!ls) return undefined;
  const parsed = JSON.parse(ls) as unknown[];
  const hit = parsed.find(
    (item) => item != null && typeof item === "object" && (item as { name?: string }).name === name
  );
  return hit && typeof hit === "object" ? (hit as Record<string, unknown>) : undefined;
}

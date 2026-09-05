import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import {
  FLOW_LIBRARY_STORAGE_KEY,
  ensureFlowLibraryReady,
  listFlowLibraryItems,
  resetFlowLibraryPersistForTests,
  saveFlowFromProjectAsync,
} from "./flowLibrary";
import type { ChoreographyProjectJson } from "../types/choreography";

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

beforeEach(() => {
  resetFlowLibraryPersistForTests();
  localStorage.removeItem(FLOW_LIBRARY_STORAGE_KEY);
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
});

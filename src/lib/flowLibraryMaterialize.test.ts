import { describe, expect, it } from "vitest";
import {
  materializeFlowLibraryItemAsProject,
  type FlowLibraryItem,
} from "./flowLibrary";

function sampleItem(over: Partial<FlowLibraryItem> = {}): FlowLibraryItem {
  return {
    id: "flow-1",
    name: "K-POP水 7",
    hasTiming: true,
    dancerCount: 2,
    cueCount: 1,
    formations: [
      {
        id: "fm1",
        name: "A",
        dancers: [
          { label: "1", xPct: 20, yPct: 30, colorIndex: 0 },
          { label: "2", xPct: 40, yPct: 50, colorIndex: 1 },
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
    ...over,
  };
}

describe("materializeFlowLibraryItemAsProject", () => {
  it("turns a device-library item into an editor project with the same title and spots", () => {
    const project = materializeFlowLibraryItemAsProject(sampleItem());
    expect(project.pieceTitle).toBe("K-POP水 7");
    expect(project.cues).toHaveLength(1);
    expect(project.formations).toHaveLength(1);
    expect(project.formations[0]?.dancers).toHaveLength(2);
    expect(project.formations[0]?.dancers[0]).toMatchObject({
      label: "1",
      xPct: 20,
      yPct: 30,
    });
    expect(project.activeFormationId).toBe(project.formations[0]?.id);
  });
});

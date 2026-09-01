import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import {
  defaultWorkCueFormationName,
  groupFormationBoxByDateAndWork,
  listFormationBoxItems,
  renameFormationBoxItem,
  renameFormationBoxWorkTitle,
  saveAllWorkFormationsToBox,
  workFormationSnapshotsFromProject,
  type FormationBoxItem,
} from "./formationBox";
import type { DancerSpot } from "../types/choreography";

function spot(id: string, x: number, y: number): DancerSpot {
  return { id, label: id, xPct: x, yPct: y, colorIndex: 0 };
}

describe("work formation box save-all", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("names items as work title plus cue number", () => {
    expect(defaultWorkCueFormationName("春公演", 2)).toBe("春公演 キュー2");
    expect(defaultWorkCueFormationName("  ", 1)).toBe("無題の作品 キュー1");
  });

  it("takes one snapshot per cue with dancers, in cue order", () => {
    const project = createEmptyProject();
    const f1 = project.formations[0]!;
    f1.dancers = [spot("a", 20, 40), spot("b", 80, 40)];
    const f2 = {
      ...f1,
      id: "f2",
      dancers: [spot("c", 50, 50)],
    };
    const empty = { ...f1, id: "f3", dancers: [] };
    project.formations = [f1, f2, empty];
    project.cues = [
      { id: "c2", tStartSec: 10, tEndSec: 20, formationId: f2.id },
      { id: "c1", tStartSec: 0, tEndSec: 8, formationId: f1.id },
      { id: "c3", tStartSec: 22, tEndSec: 30, formationId: empty.id },
    ];
    const snaps = workFormationSnapshotsFromProject(project);
    expect(snaps.map((s) => s.cueOrdinal)).toEqual([1, 2]);
    expect(snaps[0]?.dancers).toHaveLength(2);
    expect(snaps[1]?.dancers).toHaveLength(1);
  });

  it("saves all cues and groups them by date and work name", () => {
    const project = createEmptyProject();
    project.pieceTitle = "春公演";
    const f = project.formations[0]!;
    f.dancers = [spot("a", 30, 50), spot("b", 70, 50)];
    const f2 = { ...f, id: "f2", dancers: [spot("c", 50, 60)] };
    project.formations = [f, f2];
    project.cues = [
      { id: "c1", tStartSec: 0, tEndSec: 8, formationId: f.id },
      { id: "c2", tStartSec: 10, tEndSec: 18, formationId: f2.id },
    ];
    const result = saveAllWorkFormationsToBox({
      pieceTitle: "春公演",
      snapshots: workFormationSnapshotsFromProject(project),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.saved).toBe(2);

    const items = listFormationBoxItems();
    expect(items.map((x) => x.name).sort()).toEqual([
      "春公演 キュー1",
      "春公演 キュー2",
    ]);
    expect(items.every((x) => x.sourcePieceTitle === "春公演")).toBe(true);

    const groups = groupFormationBoxByDateAndWork(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.workTitle).toBe("春公演");
    expect(groups[0]?.items.map((x) => x.sourceCueOrdinal)).toEqual([1, 2]);
  });

  it("lets a saved name be renamed later", () => {
    saveAllWorkFormationsToBox({
      pieceTitle: "春公演",
      snapshots: [
        { cueOrdinal: 1, dancers: [spot("a", 40, 50)] },
      ],
    });
    const item = listFormationBoxItems()[0] as FormationBoxItem;
    expect(renameFormationBoxItem(item.id, "オープニングV")).toBe(true);
    expect(listFormationBoxItems()[0]?.name).toBe("オープニングV");
  });

  it("renames the work title and follows auto cue names in bulk", () => {
    saveAllWorkFormationsToBox({
      pieceTitle: "春公演",
      snapshots: [
        { cueOrdinal: 1, dancers: [spot("a", 40, 50)] },
        { cueOrdinal: 2, dancers: [spot("b", 60, 50)] },
      ],
    });
    const items = listFormationBoxItems();
    renameFormationBoxItem(items.find((x) => x.sourceCueOrdinal === 2)!.id, "サビ");
    const n = renameFormationBoxWorkTitle(
      items.map((x) => x.id),
      "夏フェス"
    );
    expect(n).toBe(2);
    const next = listFormationBoxItems().sort(
      (a, b) => (a.sourceCueOrdinal ?? 0) - (b.sourceCueOrdinal ?? 0)
    );
    expect(next[0]?.sourcePieceTitle).toBe("夏フェス");
    expect(next[0]?.name).toBe("夏フェス キュー1");
    expect(next[1]?.name).toBe("サビ");
    expect(next[1]?.sourcePieceTitle).toBe("夏フェス");
  });
});

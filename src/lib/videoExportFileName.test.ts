import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { resolveVideoExportFileName } from "./videoExportFileName";

describe("resolveVideoExportFileName", () => {
  it("uses pieceTitle when set", () => {
    const project = { ...createEmptyProject(), pieceTitle: "春の公演" };
    expect(resolveVideoExportFileName(project, "無題の作品")).toBe("春の公演-choreo");
  });

  it("falls back to projectName when pieceTitle is empty", () => {
    const project = createEmptyProject();
    expect(resolveVideoExportFileName(project, "Team Alpha")).toBe("Team_Alpha-choreo");
  });

  it("uses dated ChoreoCore name when only generic labels", () => {
    const project = { ...createEmptyProject(), pieceTitle: "無題の作品" };
    const name = resolveVideoExportFileName(project, "無題の作品");
    expect(name).toMatch(/^ChoreoCore-choreo-\d{8}$/);
  });
});

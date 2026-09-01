import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import {
  isUntitledProjectName,
  projectNeedsInitialName,
} from "./projectNeedsInitialName";

describe("projectNeedsInitialName", () => {
  it("asks for a name on a brand-new empty project", () => {
    expect(projectNeedsInitialName(createEmptyProject(), "無題の作品")).toBe(
      true
    );
    expect(projectNeedsInitialName(createEmptyProject(), "")).toBe(true);
  });

  it("still asks for a name if leftover draft already has dancers", () => {
    const project = createEmptyProject();
    project.formations[0] = {
      ...project.formations[0]!,
      dancers: [
        {
          id: "d1",
          label: "A",
          xPct: 40,
          yPct: 50,
          colorIndex: 0,
        },
      ],
    };
    expect(projectNeedsInitialName(project, "無題の作品")).toBe(true);
  });

  it("does not ask again after a real name is set", () => {
    const project = createEmptyProject();
    project.pieceTitle = "春公演";
    expect(projectNeedsInitialName(project, "無題の作品")).toBe(false);
    expect(projectNeedsInitialName(createEmptyProject(), "春公演")).toBe(false);
  });
});

describe("isUntitledProjectName", () => {
  it("treats locale untitled defaults as empty", () => {
    expect(isUntitledProjectName("無題の作品")).toBe(true);
    expect(isUntitledProjectName("Untitled project")).toBe(true);
    expect(isUntitledProjectName("  ")).toBe(true);
    expect(isUntitledProjectName("春公演")).toBe(false);
  });
});

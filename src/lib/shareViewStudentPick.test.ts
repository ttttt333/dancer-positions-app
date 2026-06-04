import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { resolveAutoStudentPick } from "./shareViewStudentPick";

describe("resolveAutoStudentPick", () => {
  it("returns all when roster is empty", () => {
    const project = createEmptyProject();
    expect(resolveAutoStudentPick(project, null)).toEqual({ kind: "all" });
  });

  it("returns sole member when roster has one entry", () => {
    const project = createEmptyProject();
    project.crews = [
      {
        id: "c1",
        label: "A",
        members: [{ id: "m1", label: "太郎" }],
      },
    ];
    expect(resolveAutoStudentPick(project, null)).toEqual({
      kind: "member",
      id: "m1",
      label: "太郎",
    });
  });

  it("returns null when multiple members and no storage", () => {
    const project = createEmptyProject();
    project.crews = [
      {
        id: "c1",
        label: "A",
        members: [
          { id: "m1", label: "太郎" },
          { id: "m2", label: "花子" },
        ],
      },
    ];
    expect(resolveAutoStudentPick(project, null)).toBeNull();
  });
});

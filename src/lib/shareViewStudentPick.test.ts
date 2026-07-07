import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import {
  resolveAutoStudentPick,
  toggleStudentPickMode,
} from "./shareViewStudentPick";

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

describe("toggleStudentPickMode", () => {
  const entries = [
    { id: "m1", label: "太郎" },
    { id: "m2", label: "花子" },
  ];

  it("switches from all to last member", () => {
    expect(
      toggleStudentPickMode(
        { kind: "all" },
        entries,
        { kind: "member", id: "m2", label: "花子" }
      )
    ).toEqual({ kind: "member", id: "m2", label: "花子" });
  });

  it("switches from all to first member when no last member", () => {
    expect(toggleStudentPickMode({ kind: "all" }, entries, null)).toEqual({
      kind: "member",
      id: "m1",
      label: "太郎",
    });
  });

  it("switches from member to all", () => {
    expect(
      toggleStudentPickMode(
        { kind: "member", id: "m1", label: "太郎" },
        entries,
        null
      )
    ).toEqual({ kind: "all" });
  });
});

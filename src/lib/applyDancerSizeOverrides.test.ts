import { describe, expect, it } from "vitest";
import { applyDancerFieldOverridesToFormations } from "./applyDancerSizeOverrides";
import type { Formation } from "../types/choreography";

function form(
  id: string,
  dancers: Array<{ id: string; sizePx?: number; nameBelowFontPx?: number }>
): Formation {
  return {
    id,
    name: id,
    dancers: dancers.map((d) => ({
      id: d.id,
      label: d.id,
      xPct: 50,
      yPct: 50,
      colorIndex: 0,
      ...(d.sizePx != null ? { sizePx: d.sizePx } : {}),
      ...(d.nameBelowFontPx != null
        ? { nameBelowFontPx: d.nameBelowFontPx }
        : {}),
    })),
  };
}

describe("applyDancerFieldOverridesToFormations", () => {
  const formations = [
    form("f1", [{ id: "a", sizePx: 18 }, { id: "b", sizePx: 18 }]),
    form("f2", [{ id: "a", sizePx: 18 }, { id: "b", sizePx: 20 }]),
    form("f3", [{ id: "c", sizePx: 18 }]),
  ];

  it("applies only to the current formation when scope is cue", () => {
    const next = applyDancerFieldOverridesToFormations(formations, {
      scope: "cue",
      currentFormationId: "f1",
      overrides: new Map([["a", 30]]),
      field: "sizePx",
    });
    expect(next[0]!.dancers.find((d) => d.id === "a")?.sizePx).toBe(30);
    expect(next[0]!.dancers.find((d) => d.id === "b")?.sizePx).toBe(18);
    expect(next[1]!.dancers.find((d) => d.id === "a")?.sizePx).toBe(18);
    expect(next[2]!.dancers.find((d) => d.id === "c")?.sizePx).toBe(18);
  });

  it("applies matching dancer ids across all formations when scope is all", () => {
    const next = applyDancerFieldOverridesToFormations(formations, {
      scope: "all",
      currentFormationId: "f1",
      overrides: new Map([["a", 40]]),
      field: "sizePx",
    });
    expect(next[0]!.dancers.find((d) => d.id === "a")?.sizePx).toBe(40);
    expect(next[1]!.dancers.find((d) => d.id === "a")?.sizePx).toBe(40);
    expect(next[1]!.dancers.find((d) => d.id === "b")?.sizePx).toBe(20);
    expect(next[2]!.dancers.find((d) => d.id === "c")?.sizePx).toBe(18);
  });

  it("writes nameBelowFontPx when that field is requested", () => {
    const next = applyDancerFieldOverridesToFormations(formations, {
      scope: "all",
      currentFormationId: "f1",
      overrides: new Map([["b", 14]]),
      field: "nameBelowFontPx",
    });
    expect(next[0]!.dancers.find((d) => d.id === "b")?.nameBelowFontPx).toBe(14);
    expect(next[1]!.dancers.find((d) => d.id === "b")?.nameBelowFontPx).toBe(14);
  });
});

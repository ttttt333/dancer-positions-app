import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import {
  gatherDancersToEdge,
  gatherSelectedDancersToEdge,
} from "./gatherDancers";

function spot(id: string, xPct: number, yPct: number): DancerSpot {
  return {
    id,
    label: id,
    xPct,
    yPct,
    colorIndex: 0,
    crewMemberId: `crew-${id}`,
  };
}

describe("gatherSelectedDancersToEdge", () => {
  it("packs only selected dancers to kamite (right) and leaves others", () => {
    const dancers = [
      spot("a", 20, 30),
      spot("b", 40, 50),
      spot("c", 110, 40),
      spot("keep", 55, 55),
    ];
    const next = gatherSelectedDancersToEdge(dancers, ["a", "b", "c"], "kamite");
    const byId = Object.fromEntries(next.map((d) => [d.id, d]));
    expect(byId.keep!.xPct).toBe(55);
    expect(byId.keep!.yPct).toBe(55);
    // 上手 = 右寄り
    expect(byId.a!.xPct).toBeGreaterThan(80);
    expect(byId.b!.xPct).toBeGreaterThan(80);
    expect(byId.c!.xPct).toBeGreaterThan(80);
  });

  it("packs selected to shimote (left)", () => {
    const dancers = [spot("a", 80, 20), spot("b", 90, 80)];
    const next = gatherSelectedDancersToEdge(dancers, ["a", "b"], "shimote");
    for (const d of next) {
      expect(d.xPct).toBeLessThan(20);
    }
  });

  it("no-op when selection empty", () => {
    const dancers = [spot("a", 50, 50)];
    expect(gatherSelectedDancersToEdge(dancers, [], "kamite")).toEqual(dancers);
  });
});

describe("gatherDancersToEdge", () => {
  it("moves all to front (large y)", () => {
    const dancers = [spot("a", 10, 10), spot("b", 90, 20)];
    const next = gatherDancersToEdge(dancers, "front");
    for (const d of next) {
      expect(d.yPct).toBeGreaterThan(80);
    }
  });
});

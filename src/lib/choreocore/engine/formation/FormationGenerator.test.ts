/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { defaultFormationTemplateRegistry } from "./FormationTemplateRegistry";
import { buildFormation, generateSlots } from "./FormationGenerator";
import { makeRequest } from "./formationFixtures";

describe("FormationGenerator", () => {
  it("builds a formation with matching dancer count", () => {
    const template = defaultFormationTemplateRegistry.getTemplate("wide-v")!;
    const request = makeRequest(12, "EXPAND");
    const slots = generateSlots(template, 12, { spread: 0.9 });
    const formation = buildFormation(template, slots, request, "default");
    expect(Object.keys(formation.positions)).toHaveLength(12);
    expect(formation.type).toBe("WIDE_V");
    expect(formation.tags).toContain("wide");
  });

  it("caches geometry for the same template and count", () => {
    const template = defaultFormationTemplateRegistry.getTemplate("line")!;
    const a = generateSlots(template, 10, { spread: 0.7 });
    const b = generateSlots(template, 10, { spread: 0.7 });
    expect(a).toEqual(b);
  });
});

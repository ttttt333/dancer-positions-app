import { describe, expect, it } from "vitest";
import {
  applyCategoryToSectionType,
  categoriesForMode,
  categoryFromLabel,
} from "./cueCategories";

describe("cueCategories", () => {
  it("returns clean vs edit option lists", () => {
    expect(categoriesForMode("clean").some((c) => c.label === "サビ")).toBe(
      true
    );
    expect(categoriesForMode("edit").some((c) => c.label === "きっかけ")).toBe(
      true
    );
  });

  it("maps category to section type + label", () => {
    const hit = applyCategoryToSectionType("hit", "edit");
    expect(hit.label).toBe("きっかけ");
    expect(hit.type).toBe("bridge");
  });

  it("resolves category from existing label", () => {
    expect(categoryFromLabel("サビ", "clean").id).toBe("chorus");
    expect(categoryFromLabel("効果音", "edit").id).toBe("se");
  });
});

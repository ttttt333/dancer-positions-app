import { describe, expect, it } from "vitest";
import { computeEditorViewportKey } from "./editorViewport";

describe("editorViewport", () => {
  it("detects mobile stack when short side < 768", () => {
    expect(computeEditorViewportKey(390, 844)).toBe("10");
    expect(computeEditorViewportKey(844, 390)).toBe("11");
  });

  it("detects desktop when short side >= 768", () => {
    expect(computeEditorViewportKey(1280, 800)).toBe("01");
    expect(computeEditorViewportKey(800, 1280)).toBe("00");
  });
});

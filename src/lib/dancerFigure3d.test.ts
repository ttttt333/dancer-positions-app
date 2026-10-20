import { describe, expect, it } from "vitest";
import {
  normalizeDancerFigure3d,
  resolveDancerFigure3dId,
} from "./dancerFigure3d";

describe("normalizeDancerFigure3d", () => {
  it("keeps known ids", () => {
    expect(normalizeDancerFigure3d("dog")).toBe("dog");
    expect(normalizeDancerFigure3d("elephant")).toBe("elephant");
    expect(normalizeDancerFigure3d("rabbit")).toBe("rabbit");
    expect(normalizeDancerFigure3d("kirin")).toBe("kirin");
    expect(normalizeDancerFigure3d("penguin")).toBe("penguin");
    expect(normalizeDancerFigure3d("bear")).toBe("bear");
  });

  it("maps legacy ids", () => {
    expect(normalizeDancerFigure3d("monkey")).toBe("bear");
    expect(normalizeDancerFigure3d("pig")).toBe("bear");
  });

  it("drops unknown", () => {
    expect(normalizeDancerFigure3d("dragon")).toBeUndefined();
    expect(normalizeDancerFigure3d(1)).toBeUndefined();
  });
});

describe("resolveDancerFigure3dId", () => {
  it("defaults to human", () => {
    expect(resolveDancerFigure3dId(undefined)).toBe("human");
    expect(resolveDancerFigure3dId("cat")).toBe("cat");
  });
});

import { describe, expect, it } from "vitest";
import {
  drawChoreographicGapCross,
  resolveWaveGapConnectorStyle,
} from "./drawWaveGapConnector";

describe("resolveWaveGapConnectorStyle", () => {
  it("keeps unconfigured gaps nearly transparent", () => {
    const s = resolveWaveGapConnectorStyle({
      ownedBySelection: false,
      configuredGapMovement: false,
      waveBitmapPxPerCssPx: 1,
    });
    expect(s.fillStyle).toMatch(/0\.0[0-3]/);
  });

  it("uses a stronger cross when selected", () => {
    const plain = resolveWaveGapConnectorStyle({
      ownedBySelection: false,
      configuredGapMovement: false,
      waveBitmapPxPerCssPx: 1,
    });
    const sel = resolveWaveGapConnectorStyle({
      ownedBySelection: true,
      configuredGapMovement: false,
      waveBitmapPxPerCssPx: 1,
    });
    expect(sel.crossStyle).not.toBe(plain.crossStyle);
  });
});

describe("drawChoreographicGapCross", () => {
  it("strokes two bezier paths for an X", () => {
    const calls: string[] = [];
    const g = {
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      beginPath: () => calls.push("begin"),
      moveTo: () => calls.push("move"),
      bezierCurveTo: () => calls.push("bezier"),
      stroke: () => calls.push("stroke"),
      strokeStyle: "",
      lineWidth: 0,
      lineCap: "",
      lineJoin: "",
    } as unknown as CanvasRenderingContext2D;

    drawChoreographicGapCross(g, 0, 0, 40, 40, {
      crossStyle: "#fff",
      lineWidth: 2,
    });

    expect(calls.filter((c) => c === "bezier")).toHaveLength(2);
    expect(calls).toContain("stroke");
  });
});

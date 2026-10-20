import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { withDancerLabelPosition } from "./withDancerLabelPosition";

describe("withDancerLabelPosition", () => {
  it("sets below without touching dancers", () => {
    const p = createEmptyProject();
    p.formations = [
      {
        id: "f1",
        name: "A",
        dancers: [
          {
            id: "d1",
            label: "あ",
            xPct: 50,
            yPct: 50,
            colorIndex: 0,
            faceStamp: "smile",
          },
        ],
      },
    ];
    const next = withDancerLabelPosition(p, "below");
    expect(next.dancerLabelPosition).toBe("below");
    expect(next.formations[0]?.dancers[0]?.faceStamp).toBe("smile");
  });

  it("sets inside and clears face stamps so names can show in the circle", () => {
    const p = createEmptyProject();
    p.dancerLabelPosition = "below";
    p.formations = [
      {
        id: "f1",
        name: "A",
        dancers: [
          {
            id: "d1",
            label: "あ",
            xPct: 50,
            yPct: 50,
            colorIndex: 0,
            faceStamp: "smile",
          },
        ],
      },
    ];
    const next = withDancerLabelPosition(p, "inside");
    expect(next.dancerLabelPosition).toBe("inside");
    expect(next.formations[0]?.dancers[0]?.faceStamp).toBeUndefined();
    expect(next.formations[0]?.dancers[0]?.label).toBe("あ");
  });
});

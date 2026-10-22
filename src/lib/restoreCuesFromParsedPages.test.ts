import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { restoreCuesFromParsedPages } from "./restoreCuesFromParsedPages";

describe("restoreCuesFromParsedPages", () => {
  it("creates cues with time ranges and stable dancer ids by name", () => {
    const base = createEmptyProject();
    const result = restoreCuesFromParsedPages(
      base,
      [
        {
          title: "キュー 1",
          timeRange: { startSec: 0, endSec: 10 },
          positions: [
            { name: "あ", x: 40, y: 50 },
            { name: "い", x: 60, y: 50 },
          ],
        },
        {
          title: "キュー 2",
          timeRange: { startSec: 10, endSec: 20 },
          positions: [
            { name: "あ", x: 45, y: 55 },
            { name: "い", x: 55, y: 55 },
          ],
        },
      ],
      { replaceExistingCues: true, durationSec: 60 }
    );
    expect(result).not.toBeNull();
    expect(result!.cueCount).toBe(2);
    expect(result!.dancerPeak).toBe(2);
    expect(result!.project.cues).toHaveLength(2);
    expect(result!.project.cues[0]?.tStartSec).toBe(0);
    expect(result!.project.cues[0]?.tEndSec).toBe(10);

    const f0 = result!.project.formations.find(
      (f) => f.id === result!.project.cues[0]?.formationId
    );
    const f1 = result!.project.formations.find(
      (f) => f.id === result!.project.cues[1]?.formationId
    );
    const idA0 = f0?.dancers.find((d) => d.label === "あ")?.id;
    const idA1 = f1?.dancers.find((d) => d.label === "あ")?.id;
    expect(idA0).toBeTruthy();
    expect(idA1).toBe(idA0);
  });
});

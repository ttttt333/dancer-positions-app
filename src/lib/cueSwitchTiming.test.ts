import { describe, expect, it } from "vitest";
import { floorMarkupAtTime, setPiecesAtTime } from "./interpolateSetPieces";
import { clearDancersAtTimeCache, dancersAtTime } from "./interpolatePlayback";
import { activeStageLightsAtTime } from "./stageLighting";
import type { Cue, Formation, StageLightFixture } from "../types/choreography";

const formations: Formation[] = [
  {
    id: "f1",
    name: "A",
    dancers: [{ id: "d1", label: "1", xPct: 0, yPct: 50, colorIndex: 0 }],
    floorMarkup: [{ id: "t1", kind: "text", xPct: 50, yPct: 50, text: "前" }],
    setPieces: [
      {
        id: "p",
        kind: "rect",
        xPct: 10,
        yPct: 10,
        wPct: 10,
        hPct: 10,
        fillColor: "#ff0000",
        interpolateInGaps: true,
      } as Formation["setPieces"] extends (infer T)[] | undefined ? T : never,
    ],
  },
  {
    id: "f2",
    name: "B",
    dancers: [{ id: "d1", label: "1", xPct: 100, yPct: 50, colorIndex: 4 }],
    floorMarkup: [{ id: "t2", kind: "text", xPct: 50, yPct: 50, text: "次" }],
    setPieces: [
      {
        id: "p",
        kind: "rect",
        xPct: 80,
        yPct: 10,
        wPct: 10,
        hPct: 10,
        fillColor: "#0000ff",
        interpolateInGaps: true,
      } as Formation["setPieces"] extends (infer T)[] | undefined ? T : never,
    ],
  },
];

const lights = [
  { id: "L1", cueId: "c1", enabled: true },
  { id: "L2", cueId: "c2", enabled: true },
] as unknown as StageLightFixture[];

function snapshot(cues: Cue[], t: number) {
  clearDancersAtTimeCache();
  const text = floorMarkupAtTime(t, cues, formations, "f1")
    .map((m) => (m.kind === "text" ? m.text : ""))
    .join();
  const d = dancersAtTime(t, cues, formations, "f1")[0]!;
  const piece = setPiecesAtTime(t, cues, formations, "f1")[0]!;
  const light = activeStageLightsAtTime(lights, t, { cues })
    .map((L) => L.id)
    .join();
  return { text, color: d.colorIndex, fill: piece.fillColor, light };
}

describe("キュー間の移動で直前テキストは残り、色は次のキューに変わる", () => {
  it("すき間（移動）があるとき: 直前キューの文字は残り、色と照明は次のキュー", () => {
    const cues: Cue[] = [
      { id: "c1", tStartSec: 0, tEndSec: 10, formationId: "f1" },
      { id: "c2", tStartSec: 12, tEndSec: 20, formationId: "f2" },
    ];
    expect(snapshot(cues, 10)).toEqual({ text: "前", color: 0, fill: "#ff0000", light: "L1" });
    for (const t of [10.01, 10.5, 11, 11.5, 11.99]) {
      expect(snapshot(cues, t)).toEqual({ text: "前", color: 4, fill: "#0000ff", light: "L2" });
    }
    expect(snapshot(cues, 12)).toEqual({ text: "次", color: 4, fill: "#0000ff", light: "L2" });
  });

  it("showDuringGaps の次キューテキストは移動中から先出しできる", () => {
    const withGapFlag: Formation[] = [
      {
        ...formations[0]!,
        floorMarkup: [
          { id: "t1", kind: "text", xPct: 50, yPct: 50, text: "前" },
        ],
      },
      {
        ...formations[1]!,
        floorMarkup: [
          { id: "t2", kind: "text", xPct: 50, yPct: 50, text: "次" },
          {
            id: "t2g",
            kind: "text",
            xPct: 40,
            yPct: 40,
            text: "移動注記",
            showDuringGaps: true,
          },
        ],
      },
    ];
    const cues: Cue[] = [
      { id: "c1", tStartSec: 0, tEndSec: 10, formationId: "f1" },
      { id: "c2", tStartSec: 12, tEndSec: 20, formationId: "f2" },
    ];
    clearDancersAtTimeCache();
    const mid = floorMarkupAtTime(11, cues, withGapFlag, "f1")
      .map((m) => (m.kind === "text" ? m.text : ""))
      .filter(Boolean)
      .sort();
    expect(mid).toEqual(["前", "移動注記"]);
  });

  it("キューがくっついているとき: 境目で全部同時に切り替わる", () => {
    const cues: Cue[] = [
      { id: "c1", tStartSec: 0, tEndSec: 10, formationId: "f1" },
      { id: "c2", tStartSec: 10, tEndSec: 20, formationId: "f2" },
    ];
    expect(snapshot(cues, 9.99)).toEqual({ text: "前", color: 0, fill: "#ff0000", light: "L1" });
    expect(snapshot(cues, 10)).toEqual({ text: "次", color: 4, fill: "#0000ff", light: "L2" });
  });
});

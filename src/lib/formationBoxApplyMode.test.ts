import { describe, expect, it } from "vitest";
import {
  applyFormationBoxItemToStage,
  applyFormationBoxPositionsOnly,
  type FormationBoxItem,
} from "./formationBox";
import type { DancerSpot } from "../types/choreography";

function boxItem(partial?: Partial<FormationBoxItem>): FormationBoxItem {
  return {
    id: "box1",
    name: "V形",
    dancerCount: 2,
    dancers: [
      {
        xPct: 30,
        yPct: 40,
        label: "保存A",
        colorIndex: 3,
        crewMemberId: "crew-a",
      },
      {
        xPct: 70,
        yPct: 40,
        label: "保存B",
        colorIndex: 5,
        crewMemberId: "crew-b",
      },
    ],
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

function stageSpot(
  id: string,
  label: string,
  xPct: number,
  yPct: number,
  extra?: Partial<DancerSpot>
): DancerSpot {
  return {
    id,
    label,
    xPct,
    yPct,
    colorIndex: 1,
    crewMemberId: `crew-${id}`,
    note: "舞台メモ",
    ...extra,
  };
}

describe("formation box apply mode", () => {
  it("positions mode keeps stage names/colors/crew and only moves coords", () => {
    const stage = [
      stageSpot("s1", "はな", 10, 10, { colorIndex: 2 }),
      stageSpot("s2", "たろう", 90, 10, { colorIndex: 4 }),
    ];
    const next = applyFormationBoxPositionsOnly(boxItem(), stage);
    expect(next).toHaveLength(2);
    const hana = next.find((d) => d.id === "s1")!;
    const taro = next.find((d) => d.id === "s2")!;
    expect(hana.label).toBe("はな");
    expect(hana.colorIndex).toBe(2);
    expect(hana.crewMemberId).toBe("crew-s1");
    expect(hana.note).toBe("舞台メモ");
    expect(taro.label).toBe("たろう");
    expect([hana.xPct, hana.yPct, taro.xPct, taro.yPct].every(Number.isFinite)).toBe(
      true
    );
    /** 座標は保存形のスロットのどちらかに寄っている */
    const xs = [hana.xPct, taro.xPct].sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(30, 0);
    expect(xs[1]).toBeCloseTo(70, 0);
  });

  it("full mode prefers saved labels and crew when present", () => {
    const stage = [
      stageSpot("s1", "はな", 10, 10),
      stageSpot("s2", "たろう", 90, 10),
    ];
    const next = applyFormationBoxItemToStage(boxItem(), stage, "full");
    expect(next.map((d) => d.label)).toEqual(["保存A", "保存B"]);
    expect(next[0]!.crewMemberId).toBe("crew-a");
    expect(next[1]!.crewMemberId).toBe("crew-b");
    expect(next[0]!.xPct).toBeCloseTo(30, 5);
    expect(next[1]!.xPct).toBeCloseTo(70, 5);
  });

  it("positions mode keeps unmatched stage dancers when box has fewer spots", () => {
    const stage = [
      stageSpot("s1", "一", 10, 10),
      stageSpot("s2", "二", 50, 10),
      stageSpot("s3", "三", 90, 10),
    ];
    const item = boxItem({
      dancerCount: 1,
      dancers: [{ xPct: 50, yPct: 80, label: "箱", colorIndex: 0 }],
    });
    const next = applyFormationBoxItemToStage(item, stage, "positions");
    expect(next).toHaveLength(3);
    expect(next.map((d) => d.id).sort()).toEqual(["s1", "s2", "s3"]);
    expect(next.every((d) => ["一", "二", "三"].includes(d.label))).toBe(true);
  });
});

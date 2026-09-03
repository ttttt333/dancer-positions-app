import { describe, expect, it } from "vitest";
import { ALL_LAYOUT_PRESET_IDS } from "../../formationLayouts";
import { CLASS_ADVANCED_MON7 } from "./classProfiles";
import {
  buildLayoutMemberPositions,
  pickLayoutPreset,
} from "./layoutPresetBridge";
import { resolveSuggestTaste } from "./suggestTaste";

describe("layoutPresetBridge", () => {
  it("picks a real editor layout id", () => {
    const id = pickLayoutPreset({
      family: "vee",
      sectionType: "chorus",
      salt: 0,
      dancerCount: 8,
      allowCross: true,
    });
    expect(ALL_LAYOUT_PRESET_IDS).toContain(id);
  });

  it("lyric 円 prefers the circle layout", () => {
    const taste = resolveSuggestTaste({ lyrics: "大きな円になって" });
    const id = pickLayoutPreset({
      family: "split_lr",
      sectionType: "verse",
      salt: 0,
      dancerCount: 8,
      allowCross: true,
      taste,
    });
    expect(id).toBe("circle");
  });

  it("wave style can pick flowing layouts", () => {
    const taste = resolveSuggestTaste({ style: "wave" });
    const ids = [0, 1, 2, 3, 4, 5].map((salt) =>
      pickLayoutPreset({
        family: "wide_spread",
        sectionType: "chorus",
        salt,
        dancerCount: 8,
        allowCross: true,
        taste,
        recent: [],
      })
    );
    expect(
      ids.some((id) =>
        ["wave", "wave_double", "sine_deep", "s_curve", "arc", "spiral", "circle"].includes(
          id
        )
      )
    ).toBe(true);
  });

  it("keeps member ids when transferring from the previous frame", () => {
    const ids = ["a", "b", "c", "d"];
    const first = buildLayoutMemberPositions(
      "line",
      ids,
      CLASS_ADVANCED_MON7,
      null
    );
    expect(first.map((p) => p.memberId).sort()).toEqual([...ids].sort());
    const second = buildLayoutMemberPositions(
      "vee",
      ids,
      CLASS_ADVANCED_MON7,
      first
    );
    expect(second.map((p) => p.memberId).sort()).toEqual([...ids].sort());
    expect(second).toHaveLength(ids.length);
  });

  it("skips high row counts when the cast is small", () => {
    const id = pickLayoutPreset({
      family: "silhouette_line",
      sectionType: "verse",
      salt: 0,
      dancerCount: 4,
      allowCross: false,
    });
    expect(id).not.toMatch(/rows_1[0-9]/);
    expect(id).not.toMatch(/columns_1[0-9]/);
  });
});

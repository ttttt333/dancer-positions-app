import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { buildStageExportAppearance } from "./stageExportAppearance";
import { createDefaultSleeveCurtain } from "./stageSleeveCurtains";

describe("buildStageExportAppearance overlays", () => {
  it("copies heso, sleeve curtains, and global floor markup", () => {
    const base = createEmptyProject();
    const curtain = createDefaultSleeveCurtain(2000, "袖");
    const project = {
      ...base,
      stageHesoVisible: true,
      stageCenterMarks: [{ id: "h1", xPct: 50, yPct: 50 }],
      stageSleeveCurtains: [curtain],
      globalFloorMarkup: [
        {
          id: "t1",
          kind: "text" as const,
          xPct: 20,
          yPct: 30,
          text: "メモ",
        },
      ],
    };
    const appearance = buildStageExportAppearance(project);
    expect(appearance.stageHesoVisible).toBe(true);
    expect(appearance.stageCenterMarks).toHaveLength(1);
    expect(appearance.stageSleeveCurtains).toHaveLength(1);
    expect(appearance.globalFloorMarkup?.[0]?.kind).toBe("text");
  });
});

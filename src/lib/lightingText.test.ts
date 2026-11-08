import { describe, expect, it } from "vitest";
import {
  applyLightingTextStyle,
  lightingSelectionIsBold,
  lightingTextRuns,
  normalizeLightingTextMarks,
  presentLightingRequest,
} from "./lightingText";

describe("lighting text marks", () => {
  it("bolds and colors only the selected span", () => {
    const text = "赤系でお願いします";
    const bold = applyLightingTextStyle(text, undefined, 0, 2, { bold: true });
    expect(bold).toEqual([{ start: 0, end: 2, bold: true }]);
    const colored = applyLightingTextStyle(text, bold, 2, 3, { color: "#1d4ed8" });
    expect(colored).toEqual([
      { start: 0, end: 2, bold: true },
      { start: 2, end: 3, color: "#1d4ed8" },
    ]);
    expect(lightingSelectionIsBold(text, colored, 0, 2)).toBe(true);
    expect(lightingSelectionIsBold(text, colored, 0, 3)).toBe(false);
  });

  it("applies a size to the whole line when nothing is selected", () => {
    const text = "サビ";
    expect(applyLightingTextStyle(text, undefined, 1, 1, { size: 40 })).toEqual([
      { start: 0, end: 2, size: 40 },
    ]);
  });

  it("drops unknown colors and sizes", () => {
    expect(
      normalizeLightingTextMarks(
        [
          { start: 0, end: 2, color: "red", size: 15, bold: true },
          { start: 2, end: 4, color: "#dc2626" },
        ],
        4
      )
    ).toEqual([
      { start: 0, end: 2, bold: true },
      { start: 2, end: 4, color: "#dc2626" },
    ]);
  });

  it("shifts marks when leading space is trimmed", () => {
    expect(
      presentLightingRequest("  赤系  ", [{ start: 2, end: 3, bold: true, color: "#dc2626" }])
    ).toEqual({
      text: "赤系",
      marks: [{ start: 0, end: 1, bold: true, color: "#dc2626" }],
    });
  });

  it("splits runs for the printer", () => {
    const runs = lightingTextRuns("赤で青", [{ start: 1, end: 2, bold: true, size: 28 }], {
      size: 16,
      color: "#111111",
    });
    expect(runs).toEqual([
      { text: "赤", bold: false, size: 16, color: "#111111" },
      { text: "で", bold: true, size: 28, color: "#111111" },
      { text: "青", bold: false, size: 16, color: "#111111" },
    ]);
  });
});

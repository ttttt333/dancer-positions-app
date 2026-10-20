import { describe, expect, it } from "vitest";
import {
  buildRosterCsv,
  countExportableRosterMembers,
  crewsToExportRows,
  ROSTER_EXPORT_HEADERS,
} from "./crewCsvExport";
import { rowsToCrewMembers } from "./crewCsvImport";
import type { Crew } from "../types/choreography";

function sampleCrew(): Crew {
  return {
    id: "c1",
    name: "Aクラス",
    members: [
      {
        id: "m1",
        label: "はな",
        colorIndex: 2,
        heightCm: 158.5,
        gradeLabel: "中2",
        genderLabel: "女",
        skillRankLabel: "1",
        note: "リーダー, 要サポート",
      },
      {
        id: "m2",
        label: "たろう",
        colorIndex: 0,
        skillRankLabel: "3",
      },
    ],
  };
}

describe("crewCsvExport", () => {
  it("writes headers that import recognizes and preserves skill fields", () => {
    const rows = crewsToExportRows([sampleCrew()]);
    expect(rows[0]).toEqual([...ROSTER_EXPORT_HEADERS]);
    expect(rows).toHaveLength(3);
    expect(rows[1]![0]).toBe("Aクラス");
    expect(rows[1]![1]).toBe("はな");
    expect(rows[1]![6]).toBe("1");
    expect(rows[1]![7]).toContain("リーダー");
  });

  it("round-trips through rowsToCrewMembers including gender and note", () => {
    const csvRows = crewsToExportRows([sampleCrew()]);
    const members = rowsToCrewMembers(csvRows, { nameMode: "full" });
    expect(members).toHaveLength(2);
    const hana = members.find((m) => m.label.includes("はな"));
    expect(hana?.heightCm).toBe(158.5);
    expect(hana?.gradeLabel).toBe("中2");
    expect(hana?.genderLabel).toBe("女");
    expect(hana?.skillRankLabel).toBe("1");
    expect(hana?.note).toContain("リーダー");
  });

  it("builds BOM-friendly CSV with escaped commas in notes", () => {
    const csv = buildRosterCsv([sampleCrew()]);
    expect(csv.startsWith("名簿,名前")).toBe(true);
    expect(csv).toContain('"リーダー, 要サポート"');
  });

  it("counts exportable members across crews", () => {
    expect(countExportableRosterMembers([sampleCrew(), { id: "c2", name: "空", members: [] }])).toBe(
      2
    );
  });
});

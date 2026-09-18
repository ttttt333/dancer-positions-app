import type {
  ChoreographyProjectJson,
  DancerSpot,
} from "../types/choreography";
import { modDancerColorIndex } from "./dancerColorPalette";

export const MEMBER_ROSTER_GRADE_OPTIONS = [
  "小1",
  "小2",
  "小3",
  "小4",
  "小5",
  "小6",
  "中1",
  "中2",
  "中3",
  "高1",
  "高2",
  "高3",
  "大学",
  "社会人",
] as const;

export const MEMBER_ROSTER_SKILL_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "A",
  "B",
  "C",
  "S",
] as const;

export const MEMBER_ROSTER_HEIGHT_OPTIONS_CM: readonly number[] = Array.from(
  { length: 51 },
  (_, i) => 140 + i
);

export function memberRosterSelectOptions(
  preset: readonly string[],
  current: string | undefined
): string[] {
  const cur = (current ?? "").trim();
  if (!cur) return [...preset];
  if (preset.includes(cur as (typeof preset)[number])) return [...preset];
  return [cur, ...preset];
}

export function memberRosterHeightSelectOptions(
  current: number | undefined
): number[] {
  if (
    typeof current === "number" &&
    Number.isFinite(current) &&
    current > 0 &&
    current < 300 &&
    !MEMBER_ROSTER_HEIGHT_OPTIONS_CM.includes(Math.round(current))
  ) {
    return [Math.round(current), ...MEMBER_ROSTER_HEIGHT_OPTIONS_CM].sort(
      (a, b) => a - b
    );
  }
  return [...MEMBER_ROSTER_HEIGHT_OPTIONS_CM];
}

/** 名簿紐付け時は名簿側の身長・学年・スキルを優先表示 */
export function resolveMemberRosterFields(
  dancer: DancerSpot,
  project: ChoreographyProjectJson
): {
  heightCm: number | undefined;
  gradeLabel: string | undefined;
  skillRankLabel: string | undefined;
} {
  if (!dancer.crewMemberId) {
    return {
      heightCm: dancer.heightCm,
      gradeLabel: dancer.gradeLabel,
      skillRankLabel: dancer.skillRankLabel,
    };
  }
  for (const crew of project.crews) {
    const m = crew.members.find((x) => x.id === dancer.crewMemberId);
    if (!m) continue;
    return {
      heightCm:
        typeof m.heightCm === "number" && Number.isFinite(m.heightCm)
          ? m.heightCm
          : dancer.heightCm,
      gradeLabel: m.gradeLabel?.trim() || dancer.gradeLabel,
      skillRankLabel: m.skillRankLabel?.trim() || dancer.skillRankLabel,
    };
  }
  return {
    heightCm: dancer.heightCm,
    gradeLabel: dancer.gradeLabel,
    skillRankLabel: dancer.skillRankLabel,
  };
}

export type MemberRosterDancerPatch = {
  label?: string;
  colorIndex?: number;
  heightCm?: number | undefined;
  gradeLabel?: string | undefined;
  skillRankLabel?: string | undefined;
};

/** アクティブ隊形のダンサーを更新し、名簿紐付けがあれば名簿も同期 */
export function patchMemberRosterDancerInProject(
  p: ChoreographyProjectJson,
  formationId: string,
  dancerId: string,
  patch: MemberRosterDancerPatch
): ChoreographyProjectJson {
  let crewMemberId: string | undefined;
  const formations = p.formations.map((f) => {
    if (f.id !== formationId) return f;
    return {
      ...f,
      dancers: f.dancers.map((d) => {
        if (d.id !== dancerId) return d;
        crewMemberId = d.crewMemberId;
        let next: DancerSpot = { ...d };
        if (patch.label !== undefined) {
          next = { ...next, label: patch.label.slice(0, 120) };
        }
        if (patch.colorIndex !== undefined) {
          next = {
            ...next,
            colorIndex: modDancerColorIndex(patch.colorIndex),
          };
        }
        if ("heightCm" in patch) {
          next = { ...next, heightCm: patch.heightCm };
        }
        if (patch.gradeLabel !== undefined) {
          const g = patch.gradeLabel.slice(0, 32).trim();
          next = { ...next, gradeLabel: g ? g : undefined };
        }
        if (patch.skillRankLabel !== undefined) {
          const s = patch.skillRankLabel.slice(0, 24).trim();
          next = { ...next, skillRankLabel: s ? s : undefined };
        }
        return next;
      }),
    };
  });

  if (!crewMemberId) {
    return { ...p, formations };
  }

  const crews = p.crews.map((c) => ({
    ...c,
    members: c.members.map((m) => {
      if (m.id !== crewMemberId) return m;
      let nm = { ...m };
      if (patch.label !== undefined) {
        const t = patch.label.trim().slice(0, 120);
        nm = { ...nm, label: t || nm.label };
      }
      if (patch.colorIndex !== undefined) {
        nm = { ...nm, colorIndex: modDancerColorIndex(patch.colorIndex) };
      }
      if ("heightCm" in patch) {
        nm = { ...nm, heightCm: patch.heightCm };
      }
      if (patch.gradeLabel !== undefined) {
        const g = patch.gradeLabel.slice(0, 32).trim();
        nm = { ...nm, gradeLabel: g ? g : undefined };
      }
      if (patch.skillRankLabel !== undefined) {
        const s = patch.skillRankLabel.slice(0, 24).trim();
        nm = { ...nm, skillRankLabel: s ? s : undefined };
      }
      return nm;
    }),
  }));

  return { ...p, formations, crews };
}

/**
 * 名簿に紐づく印へ、名簿側の身長・学年・スキルを埋める（印側が空のとき）。
 * 並べ替え前に呼ぶと、名簿だけに入っているスキルでも前列へ正しく寄る。
 */
export function enrichDancerSpotsFromCrew(
  dancers: DancerSpot[],
  crews: ChoreographyProjectJson["crews"]
): DancerSpot[] {
  if (!crews?.length) return dancers;
  const byId = new Map<string, (typeof crews)[number]["members"][number]>();
  for (const c of crews) {
    for (const m of c.members) byId.set(m.id, m);
  }
  return dancers.map((d) => {
    if (!d.crewMemberId) return d;
    const m = byId.get(d.crewMemberId);
    if (!m) return d;
    return {
      ...d,
      heightCm: d.heightCm ?? m.heightCm,
      gradeLabel: d.gradeLabel?.trim()
        ? d.gradeLabel
        : m.gradeLabel?.trim() || d.gradeLabel,
      skillRankLabel: d.skillRankLabel?.trim()
        ? d.skillRankLabel
        : m.skillRankLabel?.trim() || d.skillRankLabel,
    };
  });
}
export function removeMemberRosterDancerFromFormation(
  p: ChoreographyProjectJson,
  formationId: string,
  dancerId: string
): ChoreographyProjectJson {
  const target = p.formations.find((f) => f.id === formationId);
  const removed = target?.dancers.find((d) => d.id === dancerId);
  const crewId = removed?.crewMemberId;

  return {
    ...p,
    formations: p.formations.map((f) => {
      if (f.id !== formationId) return f;
      const dancers = f.dancers.filter((d) => {
        if (d.id === dancerId) return false;
        /** 同一名簿メンバーの重複印もまとめて消す */
        if (crewId && d.crewMemberId === crewId) return false;
        return true;
      });
      if (dancers.length === f.dancers.length) return f;
      return {
        ...f,
        dancers,
        confirmedDancerCount: dancers.length,
      };
    }),
  };
}

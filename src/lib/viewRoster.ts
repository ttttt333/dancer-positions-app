import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import { dancerCircleInnerBelowLabel } from "./stageBoardModelHelpers";

/**
 * 閲覧モードのメンバー候補（生徒が自分の名前を選ぶための一覧）。
 * ステージ上の表示優先度に合わせて 1 人 1 行にまとめる。
 */
export type ViewRosterEntry = {
  id: string;
  label: string;
  source: "crew" | "dancer";
};

export type StageViewerLabelOpts = {
  dancerLabelBelow: boolean;
  stageWidthMm?: number | null;
};

function normLabel(s: string) {
  return s.trim();
}

/** ステージの「名前」（○の下・人名）として扱うラベルか */
function looksLikeStagePersonName(label: string): boolean {
  const t = normLabel(label);
  if (!t || t === "?") return false;
  if (/[a-zA-Z]/.test(t)) return true;
  if (/[^\d\s\p{P}\p{S}]/u.test(t)) return true;
  return false;
}

function innerCircleLabelOpts(
  d: DancerSpot,
  stageWidthMm?: number | null
) {
  if (typeof stageWidthMm === "number" && stageWidthMm > 0) {
    return { effXPct: d.xPct, stageWidthMm };
  }
  return undefined;
}

/**
 * 閲覧メンバー一覧・個人ハイライト共通:
 * 1. ステージ上の名前（○の下）
 * 2. 名前がなければ ○の外側（下）の数字
 * 3. それもなければ ○内の数字
 */
export function resolveStageViewerDisplayLabel(
  d: DancerSpot,
  formationIndex: number,
  opts: StageViewerLabelOpts
): string {
  const below = normLabel(d.label);
  const inner = dancerCircleInnerBelowLabel(
    d,
    formationIndex,
    innerCircleLabelOpts(d, opts.stageWidthMm)
  );

  if (!opts.dancerLabelBelow) {
    return below || inner || String(formationIndex + 1);
  }

  if (looksLikeStagePersonName(below)) return below;
  if (below && /^\d+$/.test(below)) return below;
  if (inner) return inner;
  return String(formationIndex + 1);
}

function labelPickScore(label: string): number {
  const t = normLabel(label);
  if (!t) return 0;
  if (looksLikeStagePersonName(t)) return 3;
  if (/^\d+$/.test(t)) return 1;
  return 2;
}

function identityKey(d: DancerSpot): string {
  const crewId = d.crewMemberId?.trim();
  if (crewId) return `crew:${crewId}`;
  return `dancer:${d.id}`;
}

function rosterEntryId(d: DancerSpot, displayLabel: string): string {
  const crewId = d.crewMemberId?.trim();
  if (crewId) return crewId;
  return `label:${displayLabel.toLowerCase()}`;
}

function mergeDancerEntry(
  byIdentity: Map<string, ViewRosterEntry>,
  d: DancerSpot,
  displayLabel: string
) {
  const key = identityKey(d);
  const entry: ViewRosterEntry = {
    id: rosterEntryId(d, displayLabel),
    label: displayLabel,
    source: "dancer",
  };
  const existing = byIdentity.get(key);
  if (!existing || labelPickScore(displayLabel) > labelPickScore(existing.label)) {
    byIdentity.set(key, entry);
  }
}

export function getViewRosterEntries(
  project: ChoreographyProjectJson
): ViewRosterEntry[] {
  const dancerLabelBelow = project.dancerLabelPosition === "below";
  const stageWidthMm = project.stageWidthMm ?? null;
  const labelOpts: StageViewerLabelOpts = { dancerLabelBelow, stageWidthMm };
  const byIdentity = new Map<string, ViewRosterEntry>();
  const coveredCrewIds = new Set<string>();

  for (const f of project.formations) {
    f.dancers.forEach((d, fi) => {
      const displayLabel = resolveStageViewerDisplayLabel(d, fi, labelOpts);
      if (!normLabel(displayLabel)) return;
      mergeDancerEntry(byIdentity, d, displayLabel);
      const crewId = d.crewMemberId?.trim();
      if (crewId) coveredCrewIds.add(crewId);
    });
  }

  for (const crew of project.crews) {
    for (const m of crew.members) {
      if (coveredCrewIds.has(m.id)) continue;
      const label = normLabel(m.label) || m.id;
      byIdentity.set(`crew:${m.id}`, { id: m.id, label, source: "crew" });
    }
  }

  return Array.from(byIdentity.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "ja")
  );
}

/** 個人閲覧ハイライト: ステージ表示ラベルと pick を突き合わせる */
export function dancerMatchesStudentViewerPick(
  d: DancerSpot,
  formationIndex: number,
  pick: { crewMemberId: string; label: string },
  opts: StageViewerLabelOpts
): boolean {
  const crewId = d.crewMemberId?.trim();
  if (crewId && crewId === pick.crewMemberId.trim()) return true;
  const display = resolveStageViewerDisplayLabel(d, formationIndex, opts);
  return display.trim() === pick.label.trim();
}

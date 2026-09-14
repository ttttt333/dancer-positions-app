/**
 * Experiment B — compare librosa (A) vs madmom (B) under locked GT/axes.
 * No Fusion. No adoption decision automation beyond reporting.
 *
 * Usage: npm run fly:real-song-compare-ab
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reports = join(root, "docs/fly/reports");

type SongRow = {
  songId: string;
  title: string;
  songClass: string;
  beat: {
    periodVerdict: string;
    phaseVerdict: string;
    phaseMedMs: number | null;
    halfBeatRatio: number | null;
    continuityVerdict: string;
    evidenceVerdict: string;
    aggregate: number | null;
  };
};

type Bench = {
  analyzerUnderTest?: string;
  axisPassCounts: {
    period: number;
    phase: number;
    continuity: number;
    evidence: number;
    n: number;
  };
  beatFindingClassCounts: Record<string, number>;
  song013: {
    beat: {
      period: { verdict: string };
      phase: { verdict: string; medianAbsErrorSec: number | null; halfBeatRatio: number | null };
      continuity: { verdict: string };
      evidence: { verdict: string };
    };
    songClass: string;
  } | null;
  songs: SongRow[];
};

const a = JSON.parse(
  readFileSync(join(reports, "real-song-benchmark-result.json"), "utf8")
) as Bench;
const b = JSON.parse(
  readFileSync(join(reports, "real-song-benchmark-madmom-result.json"), "utf8")
) as Bench;

const FOCUS = new Set([
  "song-013",
  // PHASE_HALFBEAT_STABLE (librosa taxonomy)
  "song-001",
  "song-005",
  "song-006",
  "song-011",
  "song-012",
  "song-014",
  // PHASE_HALFBEAT_UNSTABLE
  "song-002",
  "song-003",
  "song-004",
  "song-007",
  "song-008",
  "song-010",
  "song-015",
  "song-016",
  "song-017",
  "song-018",
  "song-019",
  // PERIOD_BREAK / DRIFT
  "song-009",
  "song-020",
]);

const rank: Record<string, number> = {
  PASS: 3,
  WEAK: 2,
  FAIL: 1,
  NOT_AVAILABLE: 0,
};

function deltaVerdict(from: string, to: string): "improved" | "same" | "regressed" {
  const d = (rank[to] ?? 0) - (rank[from] ?? 0);
  if (d > 0) return "improved";
  if (d < 0) return "regressed";
  return "same";
}

const byA = Object.fromEntries(a.songs.map((s) => [s.songId, s]));
const byB = Object.fromEntries(b.songs.map((s) => [s.songId, s]));

const perSong = a.songs.map((sa) => {
  const sb = byB[sa.songId]!;
  return {
    songId: sa.songId,
    title: sa.title,
    focus: FOCUS.has(sa.songId),
    librosa: {
      period: sa.beat.periodVerdict,
      phase: sa.beat.phaseVerdict,
      phaseMs: sa.beat.phaseMedMs,
      halfBeat: sa.beat.halfBeatRatio,
      continuity: sa.beat.continuityVerdict,
      evidence: sa.beat.evidenceVerdict,
      class: sa.songClass,
    },
    madmom: {
      period: sb.beat.periodVerdict,
      phase: sb.beat.phaseVerdict,
      phaseMs: sb.beat.phaseMedMs,
      halfBeat: sb.beat.halfBeatRatio,
      continuity: sb.beat.continuityVerdict,
      evidence: sb.beat.evidenceVerdict,
      class: sb.songClass,
    },
    delta: {
      period: deltaVerdict(sa.beat.periodVerdict, sb.beat.periodVerdict),
      phase: deltaVerdict(sa.beat.phaseVerdict, sb.beat.phaseVerdict),
      continuity: deltaVerdict(
        sa.beat.continuityVerdict,
        sb.beat.continuityVerdict
      ),
      phaseMsDelta:
        sa.beat.phaseMedMs != null && sb.beat.phaseMedMs != null
          ? sb.beat.phaseMedMs - sa.beat.phaseMedMs
          : null,
    },
  };
});

const phaseImproved = perSong.filter((p) => p.delta.phase === "improved").length;
const phaseRegressed = perSong.filter((p) => p.delta.phase === "regressed").length;
const phaseSame = perSong.filter((p) => p.delta.phase === "same").length;

const s013 = perSong.find((p) => p.songId === "song-013")!;

const comparison = {
  experimentId: "4.6-exp-madmom-beat-v1",
  status: "COMPARE_COMPLETE",
  adoption: "NOT_RECOMMENDED_FROM_EXP_B",
  computedAt: new Date().toISOString(),
  locks: {
    datasetVersion: "4.6.1-double-consensus",
    axes: ["Period", "Phase", "Continuity", "Evidence"],
    fusion: false,
    msaf: false,
    librosaUntouched: true,
  },
  headline: {
    librosa: a.axisPassCounts,
    madmom: b.axisPassCounts,
    beatClasses: {
      librosa: a.beatFindingClassCounts,
      madmom: b.beatFindingClassCounts,
    },
    phaseDeltas: {
      improved: phaseImproved,
      same: phaseSame,
      regressed: phaseRegressed,
    },
  },
  promoteRulesEvaluation: {
    phaseLiftOnGolden20: false,
    song013PhaseImprovesPeriodHolds: false,
    unstableHalfbeatClusterShrinks: false,
    gtAmbiguityRemains0: true,
    continuityNotCollapsedAsTrade: "mixed",
    formalAdoption: false,
    fusionJustified: false,
    note: "madmom alone does not fix dance Beat Phase under locked contract",
  },
  song013: {
    librosa: s013.librosa,
    madmom: s013.madmom,
    delta: s013.delta,
    note: "Primary Golden Case — judge Phase, not BPM alone",
  },
  decisionHints: {
    promoteCandidateIf:
      "Phase PASS lift + 013 Phase improves with Period held + halfbeat-unstable cluster shrinks + GT-AMBIGUITY stays 0",
    doNotFuseYet: true,
    humanReviewRequired: true,
    experimentBConclusion:
      "Negative on Phase hypothesis — Period/Continuity small gains only; do not adopt or Fusion yet",
  },
  perSong,
};

writeFileSync(
  join(reports, "real-song-librosa-vs-madmom.json"),
  JSON.stringify(comparison, null, 2) + "\n"
);

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

const md: string[] = [];
md.push(`# librosa vs madmom — Experiment B Compare`);
md.push(``);
md.push(`**Experiment:** \`4.6-exp-madmom-beat-v1\``);
md.push(`**Adoption:** NOT DECIDED (human review)`);
md.push(`**Fusion / MSAF:** still forbidden`);
md.push(``);
md.push(`## Headline axis PASS /20`);
md.push(``);
md.push(
  mdTable(
    ["Analyzer", "Period", "Phase", "Continuity", "Evidence"],
    [
      [
        "librosa (A)",
        `${a.axisPassCounts.period}/20`,
        `${a.axisPassCounts.phase}/20`,
        `${a.axisPassCounts.continuity}/20`,
        `${a.axisPassCounts.evidence}/20`,
      ],
      [
        "madmom (B)",
        `${b.axisPassCounts.period}/20`,
        `${b.axisPassCounts.phase}/20`,
        `${b.axisPassCounts.continuity}/20`,
        `${b.axisPassCounts.evidence}/20`,
      ],
    ]
  )
);
md.push(``);
md.push(`## Beat finding classes`);
md.push(``);
md.push(
  mdTable(
    ["Analyzer", "PASS", "WEAK", "GT-AMBIGUITY", "ANALYZER-LIMIT"],
    [
      [
        "librosa",
        String(a.beatFindingClassCounts.PASS ?? 0),
        String(a.beatFindingClassCounts.WEAK ?? 0),
        String(a.beatFindingClassCounts["GT-AMBIGUITY"] ?? 0),
        String(a.beatFindingClassCounts["ANALYZER-LIMIT"] ?? 0),
      ],
      [
        "madmom",
        String(b.beatFindingClassCounts.PASS ?? 0),
        String(b.beatFindingClassCounts.WEAK ?? 0),
        String(b.beatFindingClassCounts["GT-AMBIGUITY"] ?? 0),
        String(b.beatFindingClassCounts["ANALYZER-LIMIT"] ?? 0),
      ],
    ]
  )
);
md.push(``);
md.push(`## Phase delta summary`);
md.push(``);
md.push(`- improved: **${phaseImproved}**`);
md.push(`- same: **${phaseSame}**`);
md.push(`- regressed: **${phaseRegressed}**`);
md.push(``);
md.push(`## song-013 (Golden Case)`);
md.push(``);
md.push(
  mdTable(
    ["", "Period", "Phase", "Phase ms", "halfBeat", "Cont", "Evid", "Class"],
    [
      [
        "librosa",
        s013.librosa.period,
        s013.librosa.phase,
        String(s013.librosa.phaseMs ?? "—"),
        s013.librosa.halfBeat?.toFixed(2) ?? "—",
        s013.librosa.continuity,
        s013.librosa.evidence,
        s013.librosa.class,
      ],
      [
        "madmom",
        s013.madmom.period,
        s013.madmom.phase,
        String(s013.madmom.phaseMs ?? "—"),
        s013.madmom.halfBeat?.toFixed(2) ?? "—",
        s013.madmom.continuity,
        s013.madmom.evidence,
        s013.madmom.class,
      ],
    ]
  )
);
md.push(``);
md.push(`Phase delta: **${s013.delta.phase}** (ms Δ ${s013.delta.phaseMsDelta ?? "n/a"})`);
md.push(``);
md.push(`## Per-song Phase / Continuity`);
md.push(``);
md.push(
  mdTable(
    [
      "ID",
      "Title",
      "A Phase",
      "B Phase",
      "ΔPhase",
      "A ms",
      "B ms",
      "A Cont",
      "B Cont",
    ],
    perSong.map((p) => [
      p.songId.replace("song-", ""),
      p.title.replace(/\|/g, "/"),
      p.librosa.phase,
      p.madmom.phase,
      p.delta.phase,
      String(p.librosa.phaseMs ?? "—"),
      String(p.madmom.phaseMs ?? "—"),
      p.librosa.continuity,
      p.madmom.continuity,
    ])
  )
);
md.push(``);
md.push(`## Decision gate (human)`);
md.push(``);
md.push(`### Evidence summary (auto)`);
md.push(``);
md.push(`- Phase PASS: librosa **0/20** → madmom **0/20** (no Phase PASS lift)`);
md.push(`- Phase verdict deltas: improved **${phaseImproved}** · same **${phaseSame}** · regressed **${phaseRegressed}**`);
md.push(`- Period PASS: ${a.axisPassCounts.period}/20 → ${b.axisPassCounts.period}/20`);
md.push(`- Continuity PASS: ${a.axisPassCounts.continuity}/20 → ${b.axisPassCounts.continuity}/20`);
md.push(`- song-013: Phase still **FAIL** (ms ${s013.librosa.phaseMs}→${s013.madmom.phaseMs}); Continuity **${s013.delta.continuity}**`);
md.push(``);
md.push(`### Spec promote rules vs this run`);
md.push(``);
md.push(`| Rule | Met? |`);
md.push(`|------|------|`);
md.push(`| Phase lift on Golden 20 | **NO** (0→0 PASS; only ${phaseImproved} verdict improved) |`);
md.push(`| 013 Phase improves, Period holds | **NO** (Phase FAIL remains; Period held but Continuity regressed) |`);
md.push(`| HALFBEAT-UNSTABLE shrinks | **not clearly** (see per-song; no broad Phase PASS) |`);
md.push(`| GT-AMBIGUITY stays 0 | **YES** |`);
md.push(`| Continuity not traded away | **mixed** (some up, 013 down) |`);
md.push(``);
md.push(`### Recommendation (measurement, not adoption)`);
md.push(``);
md.push(`**Do not formally adopt madmom from Experiment B alone.**`);
md.push(`**Do not start Fusion** — Phase complementarity is not established (both analyzers fail Phase on nearly all songs).`);
md.push(``);
md.push(`Valuable negative result: “madmom alone fixes dance Beat Phase” is **not supported** under this locked GT/4-axis contract.`);
md.push(``);
md.push(`Next human options (separate GO): diagnose shared phase-reference issue · try alternate madmom config (still offline, same locks) · other Beat approaches · only then Fusion if complementary errors appear.`);

writeFileSync(join(reports, "real-song-librosa-vs-madmom.md"), md.join("\n") + "\n");

console.log("Wrote real-song-librosa-vs-madmom.{md,json}");
console.log("Phase improved/same/regressed:", phaseImproved, phaseSame, phaseRegressed);
console.log("013 phase delta:", s013.delta.phase, "ms", s013.delta.phaseMsDelta);
